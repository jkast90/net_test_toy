"""
Network Manager - Manages Docker networks and container network connections
"""
from fastapi import HTTPException
from typing import List, Dict, Optional
import docker
import logging
from .base import BaseManager

logger = logging.getLogger("container-api")


class NetworkManager(BaseManager):
    """Manages Docker networks and container network connections"""

    # ============================================================================
    # Network Management Methods
    # ============================================================================

    def list_networks(self) -> list:
        """List all Docker networks"""
        try:
            networks = self.client.networks.list()
            network_list = [{
                "id": net.id[:12],
                "name": net.name,
                "driver": net.attrs.get('Driver', 'unknown'),
                "scope": net.attrs.get('Scope', 'unknown'),
                "subnet": net.attrs.get('IPAM', {}).get('Config', [{}])[0].get('Subnet') if net.attrs.get('IPAM', {}).get('Config') else None,
                "gateway": net.attrs.get('IPAM', {}).get('Config', [{}])[0].get('Gateway') if net.attrs.get('IPAM', {}).get('Config') else None,
            } for net in networks]

            # Filter out null, host, and none drivers
            filtered_networks = [n for n in network_list if n['driver'] not in ['null', 'host', 'none']]

            # Sort alphabetically by name
            return sorted(filtered_networks, key=lambda x: x['name'])
        except Exception as e:
            logger.error(f"[NetworkManager] Failed to list networks: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to list networks: {str(e)}")

    def create_network(self, name: str, subnet: str, gateway: str, driver: str = "bridge") -> Dict:
        """Create a new Docker network (idempotent)"""
        try:
            # Check if network already exists (idempotent operation)
            try:
                existing_network = self.client.networks.get(name)
                # Network exists - verify configuration matches
                ipam_config = existing_network.attrs.get('IPAM', {}).get('Config', [])
                if ipam_config and len(ipam_config) > 0:
                    existing_subnet = ipam_config[0].get('Subnet')
                    existing_gateway = ipam_config[0].get('Gateway')

                    if existing_subnet == subnet and existing_gateway == gateway:
                        logger.info(f"[NetworkManager] Network '{name}' already exists with correct configuration")

                        # Ensure it's in the database
                        self.db.create_network(
                            name=name,
                            subnet=subnet,
                            gateway=gateway,
                            driver=driver,
                            docker_id=existing_network.id[:12]
                        )

                        return {
                            "id": existing_network.id[:12],
                            "name": name,
                            "driver": driver,
                            "subnet": subnet,
                            "gateway": gateway,
                            "status": "exists"
                        }
                    else:
                        logger.warning(f"[NetworkManager] Network '{name}' exists but with different config (subnet: {existing_subnet} vs {subnet})")
                        raise HTTPException(
                            status_code=409,
                            detail=f"Network '{name}' exists with different configuration (subnet: {existing_subnet}, gateway: {existing_gateway})"
                        )
            except docker.errors.NotFound:
                # Network doesn't exist, proceed with creation
                pass

            ipam_pool = docker.types.IPAMPool(
                subnet=subnet,
                gateway=gateway
            )
            ipam_config = docker.types.IPAMConfig(
                pool_configs=[ipam_pool]
            )

            network = self.client.networks.create(
                name=name,
                driver=driver,
                ipam=ipam_config,
                check_duplicate=True
            )

            # Save to database
            self.db.create_network(
                name=name,
                subnet=subnet,
                gateway=gateway,
                driver=driver,
                docker_id=network.id[:12]
            )

            logger.info(f"[NetworkManager] Created network '{name}' with subnet {subnet}")

            return {
                "id": network.id[:12],
                "name": name,
                "driver": driver,
                "subnet": subnet,
                "gateway": gateway,
                "status": "created"
            }
        except HTTPException:
            raise
        except docker.errors.APIError as e:
            logger.error(f"[NetworkManager] Failed to create network: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to create network: {str(e)}")
        except Exception as e:
            logger.error(f"[NetworkManager] Failed to create network: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to create network: {str(e)}")

    def delete_network(self, name: str) -> Dict:
        """Delete a Docker network"""
        try:
            network = self.client.networks.get(name)

            # Check if network has containers
            containers = network.attrs.get('Containers', {})
            if containers:
                raise HTTPException(
                    status_code=400,
                    detail=f"Network '{name}' has {len(containers)} container(s) attached. Remove containers first."
                )

            network.remove()

            # Remove from database
            self.db.delete_network(name)

            logger.info(f"[NetworkManager] Deleted network '{name}'")

            return {"message": f"Network '{name}' deleted successfully"}
        except docker.errors.NotFound:
            raise HTTPException(status_code=404, detail=f"Network '{name}' not found")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[NetworkManager] Failed to delete network: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to delete network: {str(e)}")

    def connect_container_to_network(self, container_name: str, network_name: str, ipv4_address: str = None) -> Dict:
        """Connect a container to a Docker network with optional IP address"""
        try:
            container = self.client.containers.get(container_name)
            network = self.client.networks.get(network_name)

            # Check if already connected
            container.reload()
            current_networks = container.attrs.get('NetworkSettings', {}).get('Networks', {})
            if network_name in current_networks:
                return {
                    "message": f"Container '{container_name}' is already connected to network '{network_name}'",
                    "status": "already_connected"
                }

            # Get network subnet before connecting
            network_subnet = None
            ipam_config = network.attrs.get('IPAM', {}).get('Config', [])
            if ipam_config and len(ipam_config) > 0:
                network_subnet = ipam_config[0].get('Subnet')

            # Connect to network with optional IP address
            if ipv4_address:
                network.connect(container, ipv4_address=ipv4_address)
                logger.info(f"[NetworkManager] Connected container '{container_name}' to network '{network_name}' with IP {ipv4_address}")
            else:
                network.connect(container)
                logger.info(f"[NetworkManager] Connected container '{container_name}' to network '{network_name}'")

            # Reload to get assigned IP
            container.reload()
            labels = container.labels
            is_daemon = labels.get("netstream.daemon_type") in ["gobgp", "frr", "exabgp"]

            # Get actual IP address if not specified
            actual_ip = ipv4_address
            if not actual_ip:
                current_networks = container.attrs.get('NetworkSettings', {}).get('Networks', {})
                network_info = current_networks.get(network_name, {})
                actual_ip = network_info.get('IPAddress')

            # Save daemon-network association to database if it's a daemon
            if is_daemon:
                self.db.add_daemon_network(
                    daemon_name=container_name,
                    network_name=network_name,
                    ipv4_address=actual_ip
                )

            if is_daemon and network_subnet:
                router_id = labels.get("netstream.router_id")
                if router_id:
                    try:
                        # Advertise the network via the unified BGP API
                        import requests
                        api_url = f"http://{router_id}:5000/route/{network_subnet}"
                        response = requests.post(api_url, json={}, timeout=5)
                        if response.status_code == 200:
                            logger.info(f"[NetworkManager] Auto-advertised route {network_subnet} on {container_name}")
                        else:
                            logger.warning(f"[NetworkManager] Failed to advertise route {network_subnet}: {response.status_code}")
                    except Exception as e:
                        logger.warning(f"[NetworkManager] Could not auto-advertise route {network_subnet}: {e}")

            return {
                "message": f"Container '{container_name}' connected to network '{network_name}'",
                "status": "connected"
            }
        except docker.errors.NotFound as e:
            raise HTTPException(status_code=404, detail=str(e))
        except Exception as e:
            logger.error(f"[NetworkManager] Failed to connect container to network: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to connect container to network: {str(e)}")

    def disconnect_container_from_network(self, container_name: str, network_name: str) -> Dict:
        """Disconnect a container from a Docker network"""
        try:
            container = self.client.containers.get(container_name)
            network = self.client.networks.get(network_name)

            # Check if connected
            container.reload()
            current_networks = container.attrs.get('NetworkSettings', {}).get('Networks', {})
            if network_name not in current_networks:
                return {
                    "message": f"Container '{container_name}' is not connected to network '{network_name}'",
                    "status": "not_connected"
                }

            # Disconnect from network
            network.disconnect(container)

            # Remove from database if it's a daemon
            labels = container.labels
            is_daemon = labels.get("netstream.daemon_type") in ["gobgp", "frr", "exabgp"]
            if is_daemon:
                self.db.remove_daemon_network(container_name, network_name)

            logger.info(f"[NetworkManager] Disconnected container '{container_name}' from network '{network_name}'")

            return {
                "message": f"Container '{container_name}' disconnected from network '{network_name}'",
                "status": "disconnected"
            }
        except docker.errors.NotFound as e:
            raise HTTPException(status_code=404, detail=str(e))
        except Exception as e:
            logger.error(f"[NetworkManager] Failed to disconnect container from network: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to disconnect container from network: {str(e)}")

    def remove_ip_from_container(self, container_name: str, interface: str, ip_address: str) -> Dict:
        """
        Remove a specific IP address from a container's network interface.
        This allows removing secondary IPs without disconnecting from the network.

        Args:
            container_name: Name of the container
            interface: Network interface name (e.g., 'eth0', 'eth1')
            ip_address: IP address to remove (with or without CIDR notation)

        Returns:
            Dict with removal status
        """
        logger.info(f"[NetworkManager] Removing IP {ip_address} from {container_name}:{interface}")

        try:
            container = self.client.containers.get(container_name)

            # Normalize IP address (add /32 if no CIDR specified)
            if '/' not in ip_address:
                ip_with_cidr = f"{ip_address}/32"
            else:
                ip_with_cidr = ip_address

            # Execute ip addr del command in container
            cmd = f"ip addr del {ip_with_cidr} dev {interface}"
            exit_code, output = container.exec_run(f"sh -c '{cmd}'")

            if exit_code != 0:
                error_msg = output.decode() if output else "Unknown error"
                # Check if address doesn't exist (not an error)
                if "Cannot assign requested address" in error_msg or "not found" in error_msg.lower():
                    logger.info(f"IP address {ip_address} not found on {interface}, already removed")
                    return {
                        "container": container_name,
                        "interface": interface,
                        "ip_address": ip_address,
                        "status": "not_found",
                        "message": f"IP address {ip_address} not found on interface {interface}"
                    }
                else:
                    raise Exception(f"Failed to remove IP: {error_msg}")

            logger.info(f"[NetworkManager] Removed IP {ip_address} from {container_name}:{interface}")

            return {
                "container": container_name,
                "interface": interface,
                "ip_address": ip_address,
                "status": "removed",
                "message": f"IP address {ip_address} removed from {interface}"
            }

        except docker.errors.NotFound:
            raise HTTPException(status_code=404, detail=f"Container '{container_name}' not found")
        except Exception as e:
            logger.error(f"[NetworkManager] Failed to remove IP address: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to remove IP address: {str(e)}")

    def add_ip_to_container(self, container_name: str, interface: str, ip_address: str) -> Dict:
        """
        Add an IP address to a container's network interface.
        This allows adding secondary IPs to existing interfaces.

        Args:
            container_name: Name of the container
            interface: Network interface name (e.g., 'eth0', 'eth1')
            ip_address: IP address to add (with CIDR notation, e.g., '10.0.1.5/24')

        Returns:
            Dict with addition status
        """
        logger.info(f"[NetworkManager] Adding IP {ip_address} to {container_name}:{interface}")

        try:
            container = self.client.containers.get(container_name)

            # Ensure CIDR notation
            if '/' not in ip_address:
                raise HTTPException(
                    status_code=400,
                    detail="IP address must include CIDR notation (e.g., '10.0.1.5/24')"
                )

            # Execute ip addr add command in container (idempotent with || true)
            cmd = f"ip addr add {ip_address} dev {interface} || true"
            exit_code, output = container.exec_run(f"sh -c '{cmd}'")

            # Check if there was an actual error (not just "already exists")
            if exit_code != 0:
                error_msg = output.decode() if output else ""
                if "File exists" not in error_msg:
                    raise Exception(f"Failed to add IP: {error_msg}")
                else:
                    logger.info(f"IP address {ip_address} already exists on {interface}")
                    return {
                        "container": container_name,
                        "interface": interface,
                        "ip_address": ip_address,
                        "status": "exists",
                        "message": f"IP address {ip_address} already exists on {interface}"
                    }

            logger.info(f"[NetworkManager] Added IP {ip_address} to {container_name}:{interface}")

            return {
                "container": container_name,
                "interface": interface,
                "ip_address": ip_address,
                "status": "added",
                "message": f"IP address {ip_address} added to {interface}"
            }

        except HTTPException:
            raise
        except docker.errors.NotFound:
            raise HTTPException(status_code=404, detail=f"Container '{container_name}' not found")
        except Exception as e:
            logger.error(f"[NetworkManager] Failed to add IP address: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to add IP address: {str(e)}")

    def get_container_networks(self, container_name: str) -> list:
        """Get list of networks a container is connected to"""
        try:
            container = self.client.containers.get(container_name)
            container.reload()
            current_networks = container.attrs.get('NetworkSettings', {}).get('Networks', {})

            return list(current_networks.keys())
        except docker.errors.NotFound:
            raise HTTPException(status_code=404, detail=f"Container '{container_name}' not found")
        except Exception as e:
            logger.error(f"[NetworkManager] Failed to get container networks: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to get container networks: {str(e)}")

    def add_ip_to_interface(self, container_name: str, network_name: str, ipv4_address: str, netmask: str = "24") -> Dict:
        """Add an IP address to an already-connected network interface inside the container"""
        try:
            container = self.client.containers.get(container_name)
            container.reload()

            # Check if container is connected to this network
            current_networks = container.attrs.get('NetworkSettings', {}).get('Networks', {})
            if network_name not in current_networks:
                raise HTTPException(
                    status_code=400,
                    detail=f"Container '{container_name}' is not connected to network '{network_name}'"
                )

            # Get the network interface name for this network
            network_info = current_networks[network_name]

            # Try to find interface by MAC address first (for running containers)
            mac_address = network_info.get('MacAddress')
            interface_name = None

            if mac_address:
                # Find the interface name by MAC address
                cmd = f"sh -c 'ip -o link show | grep -i {mac_address}'"
                result = container.exec_run(cmd)
                if result.exit_code == 0:
                    # Parse the interface name from the output (format: "123: eth1@if124: ...")
                    output = result.output.decode('utf-8').strip()
                    logger.info(f"Found interface by MAC: {output}")
                    interface_name = output.split(':')[1].strip().split('@')[0]

            # Fallback: Find interface by checking IP addresses in the container
            if not interface_name:
                logger.info(f"MAC address not available, searching for interface by listing all interfaces")
                # Get configured IP from IPAMConfig if container is not running
                target_ip = network_info.get('IPAddress')
                if not target_ip:
                    ipam_config = network_info.get('IPAMConfig', {})
                    if ipam_config:
                        target_ip = ipam_config.get('IPv4Address')

                if target_ip:
                    # Try to find interface with this IP
                    cmd = f"sh -c 'ip -o addr show | grep {target_ip}'"
                    result = container.exec_run(cmd)
                    if result.exit_code == 0:
                        output = result.output.decode('utf-8').strip()
                        logger.info(f"Found interface by IP: {output}")
                        # Parse interface name (format: "2: eth0    inet 10.1.0.1/24 ...")
                        interface_name = output.split()[1]
                    else:
                        # If we can't find it by IP, list all interfaces and pick first non-loopback
                        cmd = "sh -c 'ip -o link show | grep -v \"lo:\"'"
                        result = container.exec_run(cmd)
                        if result.exit_code == 0:
                            lines = result.output.decode('utf-8').strip().split('\n')
                            # Count interfaces and use the appropriate one
                            # Usually: eth0 = first network, eth1 = second network, etc.
                            network_index = list(current_networks.keys()).index(network_name)
                            if network_index < len(lines):
                                output = lines[network_index]
                                interface_name = output.split(':')[1].strip().split('@')[0]
                                logger.info(f"Selected interface {interface_name} based on network index {network_index}")

                if not interface_name:
                    raise HTTPException(
                        status_code=500,
                        detail="Could not determine network interface. Container may not be running properly."
                    )

            # Add the IP address to the interface
            cmd = f"ip addr add {ipv4_address}/{netmask} dev {interface_name}"
            result = container.exec_run(cmd)

            if result.exit_code != 0:
                error_msg = result.output.decode('utf-8').strip()
                # Check if IP already exists
                if "File exists" in error_msg or "RTNETLINK answers: File exists" in error_msg:
                    return {
                        "message": f"IP address {ipv4_address} already exists on interface {interface_name}",
                        "status": "already_exists",
                        "interface": interface_name
                    }
                raise HTTPException(status_code=500, detail=f"Failed to add IP: {error_msg}")

            logger.info(f"[NetworkManager] Added IP {ipv4_address}/{netmask} to interface {interface_name} in container '{container_name}'")

            return {
                "message": f"IP address {ipv4_address}/{netmask} added to interface {interface_name}",
                "status": "added",
                "interface": interface_name
            }

        except docker.errors.NotFound:
            raise HTTPException(status_code=404, detail=f"Container '{container_name}' not found")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[NetworkManager] Failed to add IP to interface: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to add IP to interface: {str(e)}")
