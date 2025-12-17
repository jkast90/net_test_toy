"""
Host Manager - Manages host containers
"""
from fastapi import HTTPException
from typing import List, Dict, Optional
import docker
import logging
import ipaddress
import requests
from .base import BaseManager

logger = logging.getLogger("container-api")


class HostManager(BaseManager):
    """Manages host containers"""

    def list_hosts(self) -> List[Dict]:
        """List all host containers"""
        try:
            containers = self.client.containers.list(
                all=True,
                filters={"label": "netstream.type=host"}
            )

            hosts = []
            for container in containers:
                labels = container.labels

                # Get connected networks with IP addresses using base helper
                current_networks = container.attrs.get('NetworkSettings', {}).get('Networks', {})
                networks = []
                for network_name, network_info in current_networks.items():
                    ips = self.get_container_network_ips(container, network_info)
                    networks.append({
                        "name": network_name,
                        "ips": ips
                    })

                # Get port mappings for NetKnight API
                ports = {}
                if container.attrs.get('NetworkSettings', {}).get('Ports'):
                    for internal, external in container.attrs['NetworkSettings']['Ports'].items():
                        if external:
                            ports[internal] = external[0]['HostPort']

                hosts.append({
                    "id": container.id[:12],
                    "name": container.name,
                    "status": container.status,
                    "gateway_daemon": labels.get("netstream.gateway_daemon", ""),
                    "gateway_ip": labels.get("netstream.gateway_ip", ""),
                    "loopback_ip": labels.get("netstream.loopback_ip", ""),
                    "loopback_network": labels.get("netstream.loopback_network", ""),
                    "container_ip": labels.get("netstream.container_ip", ""),
                    "api_port": ports.get("8000/tcp", labels.get("netstream.api_port", "")),
                    "created": container.attrs.get("Created", ""),
                    "networks": networks
                })

            return hosts
        except Exception as e:
            logger.error(f"[HostManager] Failed to list hosts: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to list hosts: {str(e)}")

    def create_host(
        self,
        name: str,
        gateway_daemon: str,
        gateway_ip: str,
        loopback_ip: str,
        loopback_network: str = "24",
        container_ip: str = None,
        network: str = "netstream_lab_builder_network",
        api_port: int = None,
        get_next_available_port_func = None,
        topology_name: str = None
    ) -> Dict:
        """Create a new host container with network attached at creation time"""
        try:
            # Check if container already exists
            try:
                self.client.containers.get(name)
                raise HTTPException(status_code=409, detail=f"Host '{name}' already exists")
            except docker.errors.NotFound:
                pass

            # Determine API port for NetKnight (auto-assign if not provided)
            if api_port is None:
                if get_next_available_port_func:
                    api_port = get_next_available_port_func(start_port=8000, end_port=9000)
                else:
                    api_port = 8000

            # Create startup command
            command = [
                "sh", "-c",
                f"ip addr add {loopback_ip}/{loopback_network} dev lo && /entrypoint.sh"
            ]

            # Build network config for creation - attach network at creation time
            networks = [{"name": network, "ipv4_address": container_ip}] if container_ip else [{"name": network}]
            _, net_config = self.build_network_config(networks)

            # Create container with network already attached
            container = self.client.containers.create(
                image="host-netknight",
                name=name,
                hostname=name,
                command=command,
                detach=True,
                privileged=True,
                cap_add=["NET_ADMIN", "SYS_ADMIN", "NET_RAW"],
                labels={
                    "netstream.type": "host",
                    "netstream.gateway_daemon": gateway_daemon,
                    "netstream.gateway_ip": gateway_ip,
                    "netstream.loopback_ip": loopback_ip,
                    "netstream.loopback_network": loopback_network,
                    "netstream.container_ip": container_ip or "",
                    "netstream.api_port": str(api_port)
                },
                ports={"8000/tcp": api_port},
                restart_policy={"Name": "unless-stopped"},
                **net_config  # Network attached at creation
            )

            # Start container
            container.start()

            # Reload to get network info (needed if IP was auto-assigned)
            container.reload()

            # Get the actual assigned IP address
            actual_container_ip = container_ip
            if not actual_container_ip:
                try:
                    network_info = container.attrs.get('NetworkSettings', {}).get('Networks', {}).get(network, {})
                    actual_container_ip = network_info.get('IPAddress', 'auto')
                except Exception as e:
                    logger.warning(f"[HostManager] Could not get auto-assigned IP: {e}")
                    actual_container_ip = 'auto'

            logger.info(f"[HostManager] Created host '{name}' (container IP: {actual_container_ip}, API port: {api_port})")

            # Save to database
            self.db.create_host(
                name=name,
                gateway_daemon=gateway_daemon,
                gateway_ip=gateway_ip,
                container_ip=actual_container_ip,
                loopback_ip=loopback_ip,
                loopback_network=loopback_network,
                docker_id=container.id[:12],
                topology_name=topology_name
            )

            # Add network association to database (this is crucial for the topology map to show the link)
            self.db.add_host_network(
                host_name=name,
                network_name=network,
                ipv4_address=actual_container_ip
            )

            # Configure routing properly with correct interface detection
            try:
                logger.info(f"[HostManager] Configuring routing for host '{name}'")
                self.reset_networking(name)
            except Exception as e:
                logger.warning(f"[HostManager] Failed to configure routing for '{name}': {e}")
                # Don't fail the host creation if routing configuration fails

            # Configure BGP daemon to advertise the host's connected networks
            try:
                # Get the host's network interfaces
                host_interfaces = self.db.get_host_interfaces(name)
                for iface in host_interfaces:
                    network_name = iface.get("network") or iface.get("name")
                    ipv4_address = iface.get("ipv4") or iface.get("ipv4_address")

                    # Skip mgmt_network and other non-routing networks
                    if network_name in ["mgmt_network", "netstream_lab_builder_network", "bridge"]:
                        continue

                    if ipv4_address:
                        # Calculate the network address from the IP (e.g., 10.0.1.3/24 -> 10.0.1.0/24)
                        try:
                            network_obj = ipaddress.IPv4Network(ipv4_address, strict=False)
                            network_prefix = str(network_obj.network_address)
                            network_mask = str(network_obj.prefixlen)

                            logger.info(f"[HostManager] Advertising {network_prefix}/{network_mask} via {gateway_daemon}")
                            self._configure_daemon_route(gateway_daemon, network_prefix, network_mask)
                        except Exception as e:
                            logger.warning(f"[HostManager] Failed to advertise {network_name} ({ipv4_address}): {e}")
            except Exception as e:
                logger.warning(f"[HostManager] Failed to configure BGP routes for host '{name}': {e}")
                # Don't fail the host creation if BGP configuration fails

            return {
                "id": container.id[:12],
                "name": name,
                "gateway_daemon": gateway_daemon,
                "gateway_ip": gateway_ip,
                "loopback_ip": loopback_ip,
                "loopback_network": loopback_network,
                "container_ip": actual_container_ip,
                "api_port": api_port,
                "status": "created"
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[HostManager] Failed to create host: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to create host: {str(e)}")

    def update_host(
        self,
        name: str,
        gateway_daemon: str = None,
        gateway_ip: str = None,
        loopback_ip: str = None,
        loopback_network: str = None,
        container_ip: str = None
    ) -> Dict:
        """
        Update host configuration.
        Changes to gateway_ip/loopback_ip require host to be running.
        Changes to container_ip will disconnect/reconnect to network.
        """
        try:
            container = self.client.containers.get(name)

            if container.labels.get("netstream.type") != "host":
                raise HTTPException(
                    status_code=400,
                    detail=f"Container '{name}' is not a netstream host"
                )

            container.reload()

            # Get current configuration
            current_gateway_daemon = container.labels.get("netstream.gateway_daemon", "")
            current_gateway_ip = container.labels.get("netstream.gateway_ip", "")
            current_loopback_ip = container.labels.get("netstream.loopback_ip", "")
            current_loopback_network = container.labels.get("netstream.loopback_network", "24")
            current_container_ip = container.labels.get("netstream.container_ip", "")

            # Use provided values or keep current
            new_gateway_daemon = gateway_daemon if gateway_daemon is not None else current_gateway_daemon
            new_gateway_ip = gateway_ip if gateway_ip is not None else current_gateway_ip
            new_loopback_ip = loopback_ip if loopback_ip is not None else current_loopback_ip
            new_loopback_network = loopback_network if loopback_network is not None else current_loopback_network
            new_container_ip = container_ip if container_ip is not None else current_container_ip

            changes = []

            # Update container labels
            if new_gateway_daemon != current_gateway_daemon:
                container.labels["netstream.gateway_daemon"] = new_gateway_daemon
                changes.append(f"Gateway Daemon: {current_gateway_daemon} -> {new_gateway_daemon}")

            if new_gateway_ip != current_gateway_ip:
                container.labels["netstream.gateway_ip"] = new_gateway_ip
                changes.append(f"Gateway IP: {current_gateway_ip} -> {new_gateway_ip}")

            if new_loopback_ip != current_loopback_ip:
                container.labels["netstream.loopback_ip"] = new_loopback_ip
                changes.append(f"Loopback IP: {current_loopback_ip} -> {new_loopback_ip}")

            if new_loopback_network != current_loopback_network:
                container.labels["netstream.loopback_network"] = new_loopback_network
                changes.append(f"Loopback Network: {current_loopback_network} -> {new_loopback_network}")

            if new_container_ip != current_container_ip:
                container.labels["netstream.container_ip"] = new_container_ip
                changes.append(f"Container IP: {current_container_ip} -> {new_container_ip}")

            # Handle container IP change (requires network reconnection on mgmt_network)
            if new_container_ip != current_container_ip:
                # Get current networks
                networks = container.attrs.get('NetworkSettings', {}).get('Networks', {})
                # Only update IP on mgmt_network (the management network for container_ip)
                if 'mgmt_network' in networks:
                    network_name = 'mgmt_network'
                    try:
                        # Disconnect from mgmt_network
                        network_obj = self.client.networks.get(network_name)
                        network_obj.disconnect(container)

                        # Reconnect with new IP
                        network_obj.connect(container, ipv4_address=new_container_ip)
                        logger.info(f"[HostManager] Reconnected {name} to {network_name} with IP {new_container_ip}")
                    except Exception as e:
                        raise HTTPException(
                            status_code=500,
                            detail=f"Failed to update container IP: {str(e)}"
                        )
                else:
                    logger.warning(f"[HostManager] Host {name} not connected to mgmt_network, skipping container_ip update")

            # Apply loopback/gateway changes if host is running
            if container.status == "running":
                # Update loopback IP if changed
                if new_loopback_ip != current_loopback_ip or new_loopback_network != current_loopback_network:
                    try:
                        # Remove old loopback IP if it exists
                        if current_loopback_ip:
                            cmd = f"ip addr del {current_loopback_ip}/{current_loopback_network} dev lo || true"
                            container.exec_run(cmd)

                        # Add new loopback IP
                        cmd = f"ip addr add {new_loopback_ip}/{new_loopback_network} dev lo"
                        result = container.exec_run(cmd)
                        if result.exit_code != 0:
                            logger.warning(f"[HostManager] Failed to update loopback IP: {result.output.decode('utf-8')}")
                        else:
                            logger.info(f"[HostManager] Updated loopback IP to {new_loopback_ip}/{new_loopback_network}")
                    except Exception as e:
                        logger.error(f"[HostManager] Error updating loopback: {e}")

                # Update default gateway if changed
                if new_gateway_ip != current_gateway_ip:
                    try:
                        # Remove old default gateway
                        cmd = "ip route del default || true"
                        container.exec_run(cmd)

                        # Add new default gateway
                        cmd = f"ip route add default via {new_gateway_ip}"
                        result = container.exec_run(cmd)
                        if result.exit_code != 0:
                            logger.warning(f"[HostManager] Failed to update gateway: {result.output.decode('utf-8')}")
                        else:
                            logger.info(f"[HostManager] Updated default gateway to {new_gateway_ip}")
                    except Exception as e:
                        logger.error(f"[HostManager] Error updating gateway: {e}")
            else:
                # If not running, changes will apply on next start via labels
                logger.info(f"[HostManager] Host '{name}' is not running. Changes will apply on next start.")

            # Update database
            self.db.update_host(
                name=name,
                gateway_daemon=new_gateway_daemon,
                gateway_ip=new_gateway_ip,
                container_ip=new_container_ip,
                loopback_ip=new_loopback_ip,
                loopback_network=new_loopback_network
            )

            logger.info(f"[HostManager] Updated host '{name}': {', '.join(changes) if changes else 'no changes'}")

            return {
                "name": name,
                "gateway_daemon": new_gateway_daemon,
                "gateway_ip": new_gateway_ip,
                "loopback_ip": new_loopback_ip,
                "loopback_network": new_loopback_network,
                "container_ip": new_container_ip,
                "changes": changes,
                "status": container.status
            }

        except docker.errors.NotFound:
            raise HTTPException(status_code=404, detail=f"Host '{name}' not found")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[HostManager] Failed to update host: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to update host: {str(e)}")

    def delete_host(self, name: str) -> Dict:
        """Delete a host container"""
        try:
            container = self.client.containers.get(name)

            if container.labels.get("netstream.type") != "host":
                raise HTTPException(
                    status_code=400,
                    detail=f"Container '{name}' is not a netstream host"
                )

            # Reload to get current status
            container.reload()

            # Handle different container states
            if container.status in ["running", "restarting"]:
                try:
                    logger.info(f"[HostManager] Stopping container {name} (status: {container.status})")
                    container.kill()  # Use kill for faster stop, especially for restarting containers
                except Exception as e:
                    logger.warning(f"[HostManager] Failed to kill container: {e}, will try force remove")

            # Force remove to handle containers stuck in any state
            container.remove(force=True)

            # Remove from database
            self.db.delete_host(name)

            logger.info(f"[HostManager] Deleted host '{name}'")

            return {"message": f"Host '{name}' deleted successfully"}

        except docker.errors.NotFound:
            raise HTTPException(status_code=404, detail=f"Host '{name}' not found")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[HostManager] Failed to delete host: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to delete host: {str(e)}")

    def start_host(self, name: str) -> Dict:
        """
        Start a host container with idempotent behavior.
        - If container exists: validate/sync to topology data, ensure running
        - If container doesn't exist: create from database
        """
        try:
            # Get host config from database (source of truth)
            host_data = self.db.get_host(name)
            if not host_data:
                raise HTTPException(status_code=404, detail=f"Host '{name}' not found in database")

            db_networks = self.db.get_host_networks(name)

            # Check if container exists
            try:
                container = self.client.containers.get(name)
                self.validate_container_type(container, "host")

                # Container exists - ensure it's running first
                if container.status != 'running':
                    container.start()
                    logger.info(f"[HostManager] Started existing host container '{name}'")
                else:
                    logger.info(f"[HostManager] Host '{name}' is already running")

                # True up: sync networking to match database (networks, tunnels, routing)
                try:
                    logger.info(f"[HostManager] Syncing host '{name}' to topology data")
                    self.reset_networking(name)
                except Exception as e:
                    logger.warning(f"[HostManager] Failed to sync networking for '{name}': {e}")

                return {"message": f"Host '{name}' started and synced to topology"}

            except docker.errors.NotFound:
                # Container doesn't exist, create from database
                logger.info(f"[HostManager] Container '{name}' not found, creating from database")
                _, net_config = self.build_network_config(db_networks) if db_networks else (None, {})

                # Build startup command
                loopback_ip = host_data.get("loopback_ip", "127.0.0.1")
                loopback_network = host_data.get("loopback_network", "24")
                command = [
                    "sh", "-c",
                    f"ip addr add {loopback_ip}/{loopback_network} dev lo && /entrypoint.sh"
                ]

                # Create container with first network attached
                container = self.client.containers.create(
                    image="host-netknight",
                    name=name,
                    hostname=name,
                    command=command,
                    detach=True,
                    privileged=True,
                    cap_add=["NET_ADMIN", "SYS_ADMIN", "NET_RAW"],
                    labels={
                        "netstream.type": "host",
                        "netstream.gateway_daemon": host_data.get("gateway_daemon", ""),
                        "netstream.gateway_ip": host_data.get("gateway_ip", ""),
                        "netstream.loopback_ip": loopback_ip,
                        "netstream.loopback_network": loopback_network,
                        "netstream.container_ip": host_data.get("container_ip", ""),
                        "netstream.api_port": str(host_data.get("api_port", 8000))
                    },
                    ports={"8000/tcp": host_data.get("api_port", 8000)},
                    restart_policy={"Name": "unless-stopped"},
                    **net_config
                )

                # Connect to additional networks if any
                if db_networks and len(db_networks) > 1:
                    self.connect_additional_networks(container, db_networks, skip_first=True)

                # Start container
                container.start()
                logger.info(f"[HostManager] Recreated and started host '{name}' from database")

                # Reset networking to restore routing
                try:
                    self.reset_networking(name)
                except Exception as e:
                    logger.warning(f"[HostManager] Failed to restore networking for '{name}': {e}")

                return {"message": f"Host '{name}' recreated and started from database"}

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[HostManager] Failed to start host: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to start host: {str(e)}")

    def stop_host(self, name: str) -> Dict:
        """Stop and remove a host container (keeps it in database for redeployment)"""
        try:
            container = self.get_container_or_404(name)
            self.validate_container_type(container, "host")

            container.stop(timeout=10)
            container.remove()
            logger.info(f"[HostManager] Stopped and removed host container '{name}' (kept in database)")

            return {"message": f"Host '{name}' container removed (saved in topology)"}

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[HostManager] Failed to stop host: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to stop host: {str(e)}")

    def exec_command(self, name: str, command: str) -> Dict:
        """Execute a command in a host container"""
        try:
            container = self.client.containers.get(name)

            if container.labels.get("netstream.type") != "host":
                raise HTTPException(
                    status_code=400,
                    detail=f"Container '{name}' is not a netstream host"
                )

            if container.status != "running":
                raise HTTPException(
                    status_code=400,
                    detail=f"Container '{name}' is not running (status: {container.status})"
                )

            # Execute command and capture output
            logger.info(f"[HostManager] Executing command in {name}: {command}")

            exec_result = container.exec_run(
                cmd=command,
                stdout=True,
                stderr=True,
                tty=False
            )

            # Decode output
            stdout = exec_result.output.decode('utf-8') if exec_result.output else ""

            logger.info(f"[HostManager] Command completed with exit code: {exec_result.exit_code}")

            return {
                "exit_code": exec_result.exit_code,
                "output": stdout,
                "command": command
            }

        except docker.errors.NotFound:
            raise HTTPException(status_code=404, detail=f"Host '{name}' not found")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[HostManager] Failed to execute command: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to execute command: {str(e)}")

    def reset_networking(self, name: str) -> Dict:
        """
        Reset host's networking configuration from database.
        Applies all network connections and IP/gateway settings from the database.
        """
        try:
            container = self.client.containers.get(name)

            if container.labels.get("netstream.type") != "host":
                raise HTTPException(
                    status_code=400,
                    detail=f"Container '{name}' is not a netstream host"
                )

            if container.status != "running":
                raise HTTPException(
                    status_code=400,
                    detail=f"Host '{name}' must be running to reset networking"
                )

            results = {
                "networks_connected": [],
                "networks_disconnected": [],
                "networking_applied": [],
                "tunnels_restored": [],
                "errors": []
            }

            # Get host info from database
            host_data = self.db.get_host(name)
            if not host_data:
                raise HTTPException(status_code=404, detail=f"Host '{name}' not found in database")

            # Get host's network interfaces from database
            host_interfaces = self.db.get_host_interfaces(name)
            db_network_names = {hi["name"] for hi in host_interfaces}

            # Get the topology's management network
            active_topology = self.db.get_active_topology()
            management_network = active_topology.get('management_network') if active_topology else None

            # Add management network to allowed networks
            if management_network:
                db_network_names.add(management_network)

            # Disconnect from networks that shouldn't be there (using base helper)
            disconnect_results = self.disconnect_extra_networks(container, db_network_names)
            for dr in disconnect_results:
                if dr["action"] == "disconnected":
                    results["networks_disconnected"].append(dr["network"])
                elif dr["error"]:
                    results["errors"].append({
                        "network": dr["network"],
                        "action": "disconnect",
                        "error": dr["error"]
                    })

            # Reload container to get updated network info
            container.reload()
            current_networks = container.attrs.get('NetworkSettings', {}).get('Networks', {})

            # Apply loopback IP and gateway from database
            try:
                loopback_ip = host_data.get("loopback_ip")
                loopback_network = host_data.get("loopback_network", "24")
                gateway_ip = host_data.get("gateway_ip")

                # Apply loopback IP if configured
                # Only add to lo if it's NOT already on a physical interface (to avoid duplicates)
                if loopback_ip:
                    # Check if loopback IP is on any physical interface
                    cmd = ["sh", "-c", "ip -o addr show | grep 'inet '"]
                    result = container.exec_run(cmd)
                    has_on_physical = False
                    has_on_lo = False

                    if result.exit_code == 0:
                        output = result.output.decode('utf-8')
                        for line in output.split('\n'):
                            if not line.strip():
                                continue
                            parts = line.split()
                            if len(parts) >= 4:
                                interface = parts[1]
                                ip_with_cidr = parts[3]

                                if loopback_ip in ip_with_cidr:
                                    if interface == 'lo':
                                        has_on_lo = True
                                    else:
                                        has_on_physical = True
                                        logger.info(f"[HostManager] Found {loopback_ip} on physical interface {interface}, will not add to lo")

                    # Only add to lo if not on a physical interface
                    if not has_on_physical and not has_on_lo:
                        # Add loopback IP
                        cmd = f"ip addr add {loopback_ip}/{loopback_network} dev lo"
                        result = container.exec_run(cmd)
                        if result.exit_code == 0:
                            results["networking_applied"].append({
                                "type": "loopback",
                                "ip": loopback_ip,
                                "netmask": loopback_network
                            })
                            logger.info(f"[HostManager] Added loopback IP {loopback_ip}/{loopback_network} to lo")

                # Apply default gateway with proper interface detection (always run, independent of loopback)
                if gateway_ip:
                    # Find the interface that has the gateway in its subnet
                    # Get all interfaces with their IPs
                    cmd = ["sh", "-c", "ip -o addr show | grep 'inet '"]
                    result = container.exec_run(cmd)
                    gateway_interface = None
                    loopback_interface = None

                    if result.exit_code == 0:
                        output = result.output.decode('utf-8')

                        # Parse: "3: eth2    inet 10.0.1.3/24 ..."
                        for line in output.split('\n'):
                            if not line.strip():
                                continue
                            parts = line.split()

                            if len(parts) >= 4:
                                interface = parts[1]  # eth2
                                ip_with_cidr = parts[3]  # 10.0.1.3/24

                                try:
                                    # Check if gateway IP is in this subnet
                                    network = ipaddress.IPv4Network(ip_with_cidr, strict=False)
                                    gateway_addr = ipaddress.IPv4Address(gateway_ip)

                                    if gateway_addr in network:
                                        # Prefer physical interfaces over loopback
                                        if interface == 'lo':
                                            loopback_interface = interface
                                            logger.info(f"[HostManager] Found gateway {gateway_ip} on loopback interface")
                                        else:
                                            gateway_interface = interface
                                            logger.info(f"[HostManager] Found gateway {gateway_ip} on interface {interface}")
                                            break
                                except Exception as e:
                                    continue

                    # Use loopback only if no physical interface was found
                    if not gateway_interface and loopback_interface:
                        gateway_interface = loopback_interface
                        logger.warning(f"[HostManager] No physical interface found for gateway {gateway_ip}, using loopback")

                    # Remove existing default gateway
                    cmd = ["sh", "-c", "ip route del default || true"]
                    container.exec_run(cmd)

                    # Add new default gateway with interface specification if found
                    if gateway_interface:
                        cmd = ["sh", "-c", f"ip route add default via {gateway_ip} dev {gateway_interface}"]
                    else:
                        # Fallback to adding without device (may use loopback)
                        cmd = ["sh", "-c", f"ip route add default via {gateway_ip}"]
                        logger.warning(f"[HostManager] Could not find interface for gateway {gateway_ip}, using default routing")

                    result = container.exec_run(cmd)
                    if result.exit_code == 0:
                        results["networking_applied"].append({
                            "type": "gateway",
                            "gateway": gateway_ip,
                            "interface": gateway_interface
                        })
                        logger.info(f"[HostManager] Set default gateway to {gateway_ip}" +
                                  (f" via {gateway_interface}" if gateway_interface else ""))

            except Exception as e:
                logger.error(f"[HostManager] Failed to apply loopback/gateway for host '{name}': {e}")
                results["errors"].append({
                    "type": "loopback_gateway",
                    "error": str(e)
                })

            # Connect to networks from database (using base helper)
            for iface in host_interfaces:
                network_name = iface.get("network") or iface.get("name")
                ipv4_address = iface.get("ipv4") or iface.get("ipv4_address")

                # Skip if no valid network name
                if not network_name:
                    logger.warning(f"[HostManager] Skipping interface with no network name: {iface}")
                    continue

                conn_result = self.ensure_network_connection(container, network_name, ipv4_address)

                if conn_result["action"] in ["connected", "reconnected"]:
                    results["networks_connected"].append({
                        "network": network_name,
                        "ip": ipv4_address,
                        "action": conn_result["action"]
                    })
                elif conn_result["action"] == "ip_added":
                    results["networking_applied"].append({
                        "type": "secondary_ip",
                        "network": network_name,
                        "ip": ipv4_address
                    })
                elif conn_result["error"]:
                    results["errors"].append({
                        "network": network_name,
                        "error": conn_result["error"]
                    })

            # Also check and reconnect management network if needed (using base helper)
            if management_network:
                mgmt_result = self.ensure_network_connection(container, management_network)
                if mgmt_result["action"] in ["connected", "reconnected"]:
                    results["networks_connected"].append({
                        "network": management_network,
                        "action": f"{mgmt_result['action']} (management)"
                    })
                elif mgmt_result["error"]:
                    results["errors"].append({
                        "network": management_network,
                        "action": "management_network",
                        "error": mgmt_result["error"]
                    })

            # Restore GRE tunnels from database
            try:
                tunnels = self.db.list_gre_tunnels(container_name=name)
                logger.info(f"[HostManager] Found {len(tunnels)} GRE tunnels in database for host '{name}'")

                for tunnel in tunnels:
                    try:
                        tunnel_name = tunnel['tunnel_name']

                        # Check if tunnel already exists
                        exit_code, _ = container.exec_run(f"ip link show {tunnel_name}")
                        if exit_code == 0:
                            logger.info(f"[HostManager] Tunnel '{tunnel_name}' already exists on host '{name}'")
                            continue

                        # Build GRE tunnel creation command
                        cmd_parts = [
                            f"ip tunnel add {tunnel_name} mode gre",
                            f"local {tunnel['local_ip']}",
                            f"remote {tunnel['remote_ip']}",
                            f"ttl {tunnel.get('ttl', 64)}"
                        ]

                        if tunnel.get('gre_key') is not None:
                            cmd_parts.append(f"key {tunnel['gre_key']}")

                        create_cmd = " ".join(cmd_parts)

                        # Execute commands to create and configure tunnel
                        commands = [
                            create_cmd,
                            f"ip addr add {tunnel['tunnel_ip']}/{tunnel.get('tunnel_network', '30')} dev {tunnel_name}",
                            f"ip link set {tunnel_name} up"
                        ]

                        for cmd in commands:
                            exit_code, output = container.exec_run(f"sh -c '{cmd}'")
                            if exit_code != 0:
                                error_msg = output.decode() if output else "Unknown error"
                                raise Exception(f"Command '{cmd}' failed: {error_msg}")

                        results["tunnels_restored"].append({
                            "tunnel_name": tunnel_name,
                            "local_ip": tunnel['local_ip'],
                            "remote_ip": tunnel['remote_ip'],
                            "tunnel_ip": tunnel['tunnel_ip']
                        })
                        logger.info(f"[HostManager] Restored tunnel '{tunnel_name}' on host '{name}'")

                    except Exception as e:
                        logger.error(f"[HostManager] Failed to restore tunnel '{tunnel['tunnel_name']}' on host '{name}': {e}")
                        results["errors"].append({
                            "tunnel": tunnel['tunnel_name'],
                            "error": str(e)
                        })

            except Exception as e:
                logger.error(f"[HostManager] Failed to restore tunnels for host '{name}': {e}")
                results["errors"].append({
                    "type": "tunnels",
                    "error": str(e)
                })

            # Ensure host is connected to mgmt_network for container-manager proxy access
            try:
                mgmt_network_name = "mgmt_network"
                if mgmt_network_name not in current_networks:
                    mgmt_network = self.client.networks.get(mgmt_network_name)
                    mgmt_network.connect(container)
                    results["networks_connected"].append({
                        "network": mgmt_network_name,
                        "ip": "auto"
                    })
                    logger.info(f"[HostManager] Connected host '{name}' to '{mgmt_network_name}' for proxy access")
                else:
                    logger.info(f"[HostManager] Host '{name}' already connected to '{mgmt_network_name}'")
            except Exception as e:
                logger.error(f"[HostManager] Failed to connect host '{name}' to mgmt_network: {e}")
                results["errors"].append({
                    "network": mgmt_network_name,
                    "error": str(e)
                })

            logger.info(f"[HostManager] Reset networking for host '{name}'")

            return {
                "message": f"Host '{name}' networking reset from database",
                "results": results
            }

        except docker.errors.NotFound:
            raise HTTPException(status_code=404, detail=f"Host '{name}' not found")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[HostManager] Failed to reset host networking: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to reset host networking: {str(e)}")

    def _configure_daemon_route(self, daemon_name: str, loopback_ip: str, loopback_network: str):
        """Configure BGP daemon to advertise the host's loopback network"""
        try:
            # Get daemon container
            daemon = self.client.containers.get(daemon_name)

            # Get daemon info from labels
            daemon_type = daemon.labels.get("netstream.daemon_type")
            api_port = daemon.labels.get("netstream.api_port")
            daemon_ip = daemon.labels.get("netstream.ip_address")

            if not daemon_type or not api_port:
                raise ValueError(f"Daemon '{daemon_name}' missing required labels")

            # Calculate network address (e.g., 10.0.0.1/24 -> 10.0.0.0/24)
            network = ipaddress.IPv4Network(f"{loopback_ip}/{loopback_network}", strict=False)
            network_addr = str(network.network_address)

            logger.info(f"[HostManager] Configuring {daemon_name} ({daemon_type}) to advertise {network}")

            # Call daemon's BGP API to add route
            # The API expects prefix and cidr separately, and a next_hop
            api_host = self.get_daemon_api_host()
            api_url = f"http://{api_host}:{api_port}/route/{network_addr}/{loopback_network}"

            # Use the daemon's IP as next_hop for static route advertisement
            payload = {
                "next_hop": daemon_ip
            }

            logger.info(f"[HostManager] POST {api_url} with payload: {payload}")

            response = requests.post(api_url, json=payload, timeout=5)
            response.raise_for_status()

            logger.info(f"[HostManager] Successfully configured {daemon_name} to advertise {network}")

        except docker.errors.NotFound:
            logger.error(f"[HostManager] Daemon '{daemon_name}' not found")
            raise
        except requests.exceptions.RequestException as e:
            logger.error(f"[HostManager] Failed to call BGP API: {e}")
            raise
        except Exception as e:
            logger.error(f"[HostManager] Failed to configure route: {e}")
            raise
