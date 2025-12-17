"""
Daemon Manager - Manages BGP daemon containers
"""
from fastapi import HTTPException
from typing import List, Dict
import docker
import logging
import os
from .base import BaseManager

logger = logging.getLogger("container-api")


class DaemonManager(BaseManager):
    """Manages BGP daemon containers (GoBGP, FRR, ExaBGP)"""

    def list_daemons(self) -> List[Dict]:
        """List all BGP daemon containers"""
        try:
            containers = self.client.containers.list(
                all=True,
                filters={"label": "netstream.type=daemon"}
            )

            daemons = []
            for container in containers:
                labels = container.labels

                # Get port mappings
                ports = {}
                if container.attrs.get('NetworkSettings', {}).get('Ports'):
                    for internal, external in container.attrs['NetworkSettings']['Ports'].items():
                        if external:
                            ports[internal] = external[0]['HostPort']

                # Get connected networks with IP addresses using base helper
                current_networks = container.attrs.get('NetworkSettings', {}).get('Networks', {})
                networks = []
                for network_name, network_info in current_networks.items():
                    ips = self.get_container_network_ips(container, network_info)
                    networks.append({
                        "name": network_name,
                        "ips": ips
                    })

                daemons.append({
                    "id": container.id[:12],
                    "name": container.name,
                    "status": container.status,
                    "daemon_type": labels.get("netstream.daemon_type", ""),
                    "asn": labels.get("netstream.asn", ""),
                    "router_id": labels.get("netstream.router_id", ""),
                    "ip_address": self.get_public_host(),  # Dynamic host for browser access
                    "api_port": ports.get("5000/tcp", "5000"),  # Host port for external access
                    "created": container.attrs.get("Created", ""),
                    "networks": networks
                })

            return daemons
        except Exception as e:
            logger.error(f"[DaemonManager] Failed to list daemons: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to list daemons: {str(e)}")

    def create_daemon(
        self,
        daemon_type: str,  # gobgp, frr, exabgp
        name: str,
        asn: int,
        router_id: str,
        ip_address: str,
        api_port: int,
        network: str = "netstream_lab_builder_network"
    ) -> Dict:
        """Create a new BGP daemon container with network attached at creation time"""
        try:
            # Validate daemon type
            valid_types = ["gobgp", "frr", "exabgp"]
            if daemon_type not in valid_types:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid daemon type. Must be one of: {valid_types}"
                )

            # Check if container already exists
            try:
                self.client.containers.get(name)
                raise HTTPException(status_code=409, detail=f"Daemon '{name}' already exists")
            except docker.errors.NotFound:
                pass

            # Determine image name
            image_map = {
                "gobgp": "gobgp-unified",
                "frr": "frr-unified",
                "exabgp": "exabgp-unified"
            }
            image = image_map[daemon_type]

            # Build network config for creation - attach network at creation time
            networks = [{"name": network, "ipv4_address": ip_address}]
            _, net_config = self.build_network_config(networks)

            # Create container with network already attached
            container = self.client.containers.create(
                image=image,
                name=name,
                hostname=name,
                detach=True,
                environment={
                    "LOCAL_ASN": str(asn),
                    "LOCAL_ROUTER_ID": router_id,
                    "NETFLOW_COLLECTOR": os.getenv("NETFLOW_COLLECTOR", "")
                },
                labels={
                    "netstream.type": "daemon",
                    "netstream.daemon_type": daemon_type,
                    "netstream.asn": str(asn),
                    "netstream.router_id": router_id,
                    "netstream.ip_address": ip_address
                },
                ports={"5000/tcp": api_port},
                privileged=True,
                cap_add=["NET_ADMIN", "SYS_ADMIN", "NET_RAW"],
                sysctls={
                    "net.ipv4.ip_forward": "1",
                    "net.ipv4.conf.all.forwarding": "1"
                },
                restart_policy={"Name": "unless-stopped"},
                **net_config  # Network attached at creation
            )

            # Start container
            container.start()

            # Save to database
            self.db.create_daemon(
                name=name,
                daemon_type=daemon_type,
                asn=asn,
                router_id=router_id,
                ip_address=ip_address,
                api_port=api_port,
                docker_id=container.id[:12],
                docker_image=image
            )

            # Record network association
            self.db.add_daemon_network(
                daemon_name=name,
                network_name=network,
                ipv4_address=ip_address
            )

            # Connect to mgmt_network for container-manager proxy access
            try:
                self.reset_networking(name)
            except Exception as e:
                logger.warning(f"[DaemonManager] Failed to connect '{name}' to mgmt_network: {e}")

            # Configure NetFlow
            try:
                self._configure_netflow(name)
            except Exception as e:
                logger.warning(f"[DaemonManager] Failed to configure NetFlow on '{name}': {e}")

            logger.info(f"[DaemonManager] Created {daemon_type} daemon '{name}' (AS{asn}, {router_id})")

            return {
                "id": container.id[:12],
                "name": name,
                "daemon_type": daemon_type,
                "asn": asn,
                "router_id": router_id,
                "ip_address": ip_address,
                "api_port": api_port,
                "status": "created"
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[DaemonManager] Failed to create daemon: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to create daemon: {str(e)}")

    def update_daemon(
        self,
        name: str,
        asn: int = None,
        router_id: str = None,
        ip_address: str = None
    ) -> Dict:
        """
        Update daemon configuration.
        Note: Daemon must be stopped before updating.
        Changes to IP address will reconnect the container to the network.
        Changes to ASN/Router ID require container restart to take effect.
        """
        try:
            container = self.client.containers.get(name)

            # Verify it's a netstream daemon
            if container.labels.get("netstream.type") != "daemon":
                raise HTTPException(
                    status_code=400,
                    detail=f"Container '{name}' is not a netstream daemon"
                )

            # Container must be stopped to update
            if container.status == "running":
                raise HTTPException(
                    status_code=400,
                    detail=f"Daemon '{name}' must be stopped before updating. Stop it first."
                )

            # Get current configuration
            current_asn = int(container.labels.get("netstream.asn", "0"))
            current_router_id = container.labels.get("netstream.router_id", "")
            current_ip = container.labels.get("netstream.ip_address", "")
            daemon_type = container.labels.get("netstream.daemon_type", "")

            # Use provided values or keep current
            new_asn = asn if asn is not None else current_asn
            new_router_id = router_id if router_id is not None else current_router_id
            new_ip = ip_address if ip_address is not None else current_ip

            # Track what changed
            changes = []

            # Update container labels
            if new_asn != current_asn:
                container.labels["netstream.asn"] = str(new_asn)
                changes.append(f"ASN: {current_asn} -> {new_asn}")

            if new_router_id != current_router_id:
                container.labels["netstream.router_id"] = new_router_id
                changes.append(f"Router ID: {current_router_id} -> {new_router_id}")

            if new_ip != current_ip:
                container.labels["netstream.ip_address"] = new_ip
                changes.append(f"IP: {current_ip} -> {new_ip}")

            # Commit label changes (requires recreating container)
            # Since Docker labels can't be updated on existing containers,
            # we need to recreate the container with new labels

            # Get current configuration for recreation
            container.reload()
            config = container.attrs

            # Get network the daemon is connected to
            networks = config.get("NetworkSettings", {}).get("Networks", {})
            network_name = list(networks.keys())[0] if networks else "netstream_lab_builder_network"

            # Get port mappings
            api_port = None
            ports_config = config.get("NetworkSettings", {}).get("Ports", {})
            if "5000/tcp" in ports_config and ports_config["5000/tcp"]:
                api_port = int(ports_config["5000/tcp"][0]["HostPort"])

            # Remove old container
            container.remove(force=True)

            # Recreate with new configuration
            new_container = self.client.containers.create(
                image=config["Config"]["Image"],
                name=name,
                hostname=name,
                detach=True,
                environment={
                    "LOCAL_ASN": str(new_asn),
                    "LOCAL_ROUTER_ID": new_router_id,
                    "NETFLOW_COLLECTOR": os.getenv("NETFLOW_COLLECTOR", "")
                },
                labels={
                    "netstream.type": "daemon",
                    "netstream.daemon_type": daemon_type,
                    "netstream.asn": str(new_asn),
                    "netstream.router_id": new_router_id,
                    "netstream.ip_address": new_ip
                },
                ports={
                    "5000/tcp": api_port
                } if api_port else {},
                volumes=config["HostConfig"]["Binds"],
                privileged=True,
                cap_add=["NET_ADMIN", "SYS_ADMIN", "NET_RAW"],
                sysctls={
                    "net.ipv4.ip_forward": "1",
                    "net.ipv4.conf.all.forwarding": "1"
                },
                restart_policy={"Name": "unless-stopped"}
            )

            # Reconnect to network with potentially new IP
            try:
                network_obj = self.client.networks.get(network_name)
                network_obj.connect(new_container, ipv4_address=new_ip)
            except Exception as e:
                new_container.remove(force=True)
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to connect to network: {str(e)}"
                )

            # Update database
            self.db.update_daemon(
                name=name,
                asn=new_asn,
                router_id=new_router_id,
                ip_address=new_ip
            )

            # Update network association in database
            self.db.delete_daemon_networks(name)
            self.db.add_daemon_network(
                daemon_name=name,
                network_name=network_name,
                ipv4_address=new_ip
            )

            logger.info(f"[DaemonManager] Updated daemon '{name}': {', '.join(changes) if changes else 'no changes'}")

            return {
                "id": new_container.id[:12],
                "name": name,
                "asn": new_asn,
                "router_id": new_router_id,
                "ip_address": new_ip,
                "changes": changes,
                "status": "updated (stopped - start to apply changes)"
            }

        except docker.errors.NotFound:
            raise HTTPException(status_code=404, detail=f"Daemon '{name}' not found")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[DaemonManager] Failed to update daemon: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to update daemon: {str(e)}")

    def delete_daemon(self, name: str) -> Dict:
        """Delete a daemon container"""
        try:
            container = self.get_container_or_404(name)
            self.validate_container_type(container, "daemon")

            # Stop and remove (force remove if stuck in restarting state)
            if container.status == "running":
                try:
                    container.stop(timeout=10)
                except Exception as e:
                    logger.warning(f"[DaemonManager] Failed to stop container gracefully: {e}, forcing removal")

            # Force remove to handle containers stuck in restarting state
            container.remove(force=True)

            # Remove from database
            self.db.delete_daemon(name)

            logger.info(f"[DaemonManager] Deleted daemon '{name}'")

            return {
                "message": f"Daemon '{name}' deleted successfully"
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[DaemonManager] Failed to delete daemon: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to delete daemon: {str(e)}")

    def start_daemon(self, name: str) -> Dict:
        """
        Start a daemon container with idempotent behavior.
        - If container exists: validate/sync to topology data, ensure running
        - If container doesn't exist: create from database
        """
        try:
            # Get daemon config from database (source of truth)
            daemon = self.db.get_daemon(name)
            if not daemon:
                raise HTTPException(status_code=404, detail=f"Daemon '{name}' not found in database")

            db_networks = self.db.get_daemon_networks(name)

            # Check if container exists
            try:
                container = self.client.containers.get(name)
                self.validate_container_type(container, "daemon")

                # Container exists - ensure it's running first
                if container.status != 'running':
                    container.start()
                    logger.info(f"[DaemonManager] Started existing daemon container '{name}'")
                else:
                    logger.info(f"[DaemonManager] Daemon '{name}' is already running")

                # True up: sync networking to match database (networks, tunnels, BGP peers, routes)
                try:
                    logger.info(f"[DaemonManager] Syncing daemon '{name}' to topology data")
                    self.reset_networking(name)
                except Exception as e:
                    logger.warning(f"[DaemonManager] Failed to sync networking for '{name}': {e}")

                # Configure NetFlow after starting
                try:
                    self._configure_netflow(name)
                except Exception as e:
                    logger.warning(f"[DaemonManager] Failed to configure NetFlow on '{name}': {e}")

                return {"message": f"Daemon '{name}' started and synced to topology"}

            except docker.errors.NotFound:
                # Container doesn't exist, create from database
                logger.info(f"[DaemonManager] Container '{name}' not found, creating from database")

                # Determine image name
                image_map = {
                    "gobgp": "gobgp-unified",
                    "frr": "frr-unified",
                    "exabgp": "exabgp-unified"
                }
                image = image_map.get(daemon["daemon_type"], "gobgp-unified")

                # Build network config from DB networks (already fetched above)
                _, net_config = self.build_network_config(db_networks) if db_networks else (None, {})

                # Create container with first network attached at creation
                container = self.client.containers.create(
                    image=image,
                    name=name,
                    hostname=name,
                    detach=True,
                    environment={
                        "LOCAL_ASN": str(daemon["asn"]),
                        "LOCAL_ROUTER_ID": daemon["router_id"],
                        "NETFLOW_COLLECTOR": os.getenv("NETFLOW_COLLECTOR", "")
                    },
                    labels={
                        "netstream.type": "daemon",
                        "netstream.daemon_type": daemon["daemon_type"],
                        "netstream.asn": str(daemon["asn"]),
                        "netstream.router_id": daemon["router_id"],
                        "netstream.ip_address": daemon["ip_address"]
                    },
                    ports={"5000/tcp": daemon.get("api_port")},
                    privileged=True,
                    cap_add=["NET_ADMIN", "SYS_ADMIN", "NET_RAW"],
                    sysctls={
                        "net.ipv4.ip_forward": "1",
                        "net.ipv4.conf.all.forwarding": "1"
                    },
                    restart_policy={"Name": "unless-stopped"},
                    **net_config  # First network attached at creation
                )

                # Connect to additional networks (if any)
                if db_networks and len(db_networks) > 1:
                    self.connect_additional_networks(container, db_networks, skip_first=True)

                # Start container
                container.start()
                logger.info(f"[DaemonManager] Recreated and started daemon '{name}' from database")

                # Reset networking to restore tunnels, BGP peers, mgmt network, etc.
                try:
                    self.reset_networking(name)
                except Exception as e:
                    logger.warning(f"[DaemonManager] Failed to restore networking for '{name}': {e}")

                # Configure NetFlow
                try:
                    self._configure_netflow(name)
                except Exception as e:
                    logger.warning(f"[DaemonManager] Failed to configure NetFlow on '{name}': {e}")

                return {"message": f"Daemon '{name}' recreated and started from database"}

        except Exception as e:
            logger.error(f"[DaemonManager] Failed to start daemon: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to start daemon: {str(e)}")

    def stop_daemon(self, name: str) -> Dict:
        """Stop and remove a daemon container (keeps it in database for redeployment)"""
        try:
            container = self.get_container_or_404(name)
            self.validate_container_type(container, "daemon")

            # Stop and remove the container, but keep it in the database
            container.stop(timeout=10)
            container.remove()
            logger.info(f"[DaemonManager] Stopped and removed daemon container '{name}' (kept in database)")

            return {"message": f"Daemon '{name}' container removed (saved in topology)"}

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[DaemonManager] Failed to stop daemon: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to stop daemon: {str(e)}")

    def reset_networking(self, name: str) -> Dict:
        """
        Reset daemon's networking configuration from database.
        Applies all network connections and secondary IPs from the database.
        """
        try:
            container = self.get_container_or_404(name)
            self.validate_container_type(container, "daemon")
            self.require_running(container, name)

            results = {
                "networks_connected": [],
                "networks_disconnected": [],
                "ips_added": [],
                "tunnels_restored": [],
                "bgp_peers_restored": [],
                "routes_advertised": [],
                "errors": []
            }

            # Get daemon's networks from database
            daemon_networks = self.db.get_daemon_networks(name)
            db_network_names = {dn["name"] for dn in daemon_networks}

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

            # Connect to networks from database (using base helper)
            for dn in daemon_networks:
                network_name = dn["name"]
                ipv4_address = dn.get("ipv4_address")

                conn_result = self.ensure_network_connection(container, network_name, ipv4_address)

                if conn_result["action"] in ["connected", "reconnected"]:
                    results["networks_connected"].append({
                        "network": network_name,
                        "ip": ipv4_address,
                        "action": conn_result["action"]
                    })
                elif conn_result["action"] == "ip_added":
                    results["ips_added"].append({
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
                mgmt_result = self.ensure_management_network(container, management_network)
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

            # Restore GRE tunnels from database (using base helper)
            tunnel_results = self.restore_gre_tunnels(container, name)
            for tr in tunnel_results:
                if tr["success"]:
                    if not tr.get("already_exists"):
                        results["tunnels_restored"].append({
                            "tunnel_name": tr["tunnel_name"]
                        })
                elif tr["error"]:
                    results["errors"].append({
                        "tunnel": tr["tunnel_name"],
                        "error": tr["error"]
                    })

            # Restore BGP sessions from database (new unified model)
            try:
                sessions = self.db.list_bgp_sessions(daemon_name=name)
                logger.info(f"[DaemonManager] Found {len(sessions)} BGP sessions for daemon '{name}'")

                daemon = self.db.get_daemon(name)
                if daemon:
                    local_asn = daemon.get("asn")

                    for session in sessions:
                        # Determine if this daemon is daemon1 or daemon2 in the session
                        if session['daemon1'] == name:
                            local_ip = session['daemon1_ip']
                            peer_ip = session['daemon2_ip']
                            peer_asn = session.get('daemon2_asn') or local_asn
                        else:
                            local_ip = session['daemon2_ip']
                            peer_ip = session['daemon1_ip']
                            peer_asn = session.get('daemon1_asn') or local_asn

                        # Configure peer via daemon API (using base helper)
                        # Include local_address for proper update-source configuration
                        api_result = self.call_container_api(
                            name,
                            f"/neighbor/{peer_ip}",
                            payload={
                                "remote_asn": peer_asn,
                                "local_asn": local_asn,
                                "local_address": local_ip
                            }
                        )

                        if api_result["success"]:
                            results["bgp_peers_restored"].append({
                                "peer_ip": peer_ip,
                                "peer_asn": peer_asn,
                                "status": "configured"
                            })
                            logger.info(f"[DaemonManager] Restored BGP peer {peer_ip} (AS{peer_asn}) on '{name}'")
                        else:
                            results["errors"].append({
                                "bgp_peer": peer_ip,
                                "error": api_result["error"]
                            })

            except Exception as e:
                logger.error(f"[DaemonManager] Failed to restore BGP sessions for '{name}': {e}")
                results["errors"].append({"type": "bgp_sessions", "error": str(e)})

            # Restore route advertisements from database
            try:
                daemon_info = self.db.get_daemon(name)
                if daemon_info:
                    topology_name = daemon_info.get("topology_name")

                    if topology_name:
                        from ..repositories.topology_config_repository import TopologyConfigRepository
                        config_repo = TopologyConfigRepository(self.db.db_path)

                        # Step 1: Get explicit route advertisements for this daemon
                        route_advertisements = config_repo.get_route_advertisements(topology_name)
                        daemon_ads = [ad for ad in route_advertisements if ad["target_daemon"] == name]

                        for ad in daemon_ads:
                            route = f"{ad['prefix']}/{ad['cidr']}"
                            payload = {}
                            if ad.get("next_hop"):
                                payload["next_hop"] = ad["next_hop"]
                            if ad.get("communities"):
                                payload["communities"] = ad["communities"]
                            if ad.get("med") is not None:
                                payload["med"] = ad["med"]
                            if ad.get("as_path"):
                                payload["as_path"] = ad["as_path"]

                            api_result = self.call_container_api(name, f"/route/{route}", payload=payload)
                            if api_result["success"]:
                                results["routes_advertised"].append({"route": route, "status": "configured"})
                                logger.info(f"[DaemonManager] Restored route {route} on '{name}'")
                            else:
                                results["errors"].append({"type": "route", "route": route, "error": api_result["error"]})

                        # Step 2: Auto-advertise host network prefixes for hosts using this daemon as gateway
                        hosts = self.db.list_hosts(topology_name=topology_name)
                        hosts_with_this_gateway = [h for h in hosts if h.get("gateway_daemon") == name]

                        for host in hosts_with_this_gateway:
                            host_networks = self.db.get_host_networks(host["name"])
                            for hn in host_networks:
                                network = self.db.get_network(hn["name"])
                                if not network or not network.get("subnet"):
                                    continue
                                subnet = network["subnet"]
                                api_result = self.call_container_api(name, f"/route/{subnet}", payload={})
                                if api_result["success"]:
                                    results["routes_advertised"].append({
                                        "route": subnet, "auto": True,
                                        "reason": f"host_network:{host['name']}", "status": "configured"
                                    })
                                    logger.info(f"[DaemonManager] Auto-advertised {subnet} for host '{host['name']}'")

                        # Step 3: Auto-advertise daemon's connected network subnets
                        for dn in daemon_networks:
                            network_name = dn["name"]
                            if network_name == "mgmt_network":
                                continue
                            network = self.db.get_network(network_name)
                            if not network or not network.get("subnet"):
                                continue
                            subnet = network["subnet"]
                            api_result = self.call_container_api(name, f"/route/{subnet}", payload={})
                            if api_result["success"]:
                                results["routes_advertised"].append({
                                    "route": subnet, "auto": True,
                                    "reason": f"daemon_network:{network_name}", "status": "configured"
                                })
                                logger.info(f"[DaemonManager] Auto-advertised daemon network {subnet}")

            except Exception as e:
                logger.error(f"[DaemonManager] Failed to restore routes for '{name}': {e}")
                results["errors"].append({"type": "route_advertisements", "error": str(e)})

            logger.info(f"[DaemonManager] Reset networking for daemon '{name}'")

            return {
                "message": f"Daemon '{name}' networking reset from database",
                "results": results
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[DaemonManager] Failed to reset networking: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to reset networking: {str(e)}")

    def configure_bmp(self, daemon_name: str, bmp_address: str = None, bmp_port: int = 11019) -> Dict:
        """
        Configure BMP (BGP Monitoring Protocol) on a daemon.
        If bmp_address is not provided, it will be auto-discovered.
        """
        try:
            container = self.get_container_or_404(daemon_name)
            daemon_info = self.db.get_daemon(daemon_name)

            if not daemon_info:
                raise HTTPException(status_code=404, detail=f"Daemon '{daemon_name}' not found in database")

            # Auto-discover BMP address if not provided
            if not bmp_address:
                monitoring_containers = [c for c in self.client.containers.list() if 'monitoring' in c.name.lower()]
                if not monitoring_containers:
                    raise HTTPException(status_code=500, detail="Monitoring service container not found")

                monitoring_container = monitoring_containers[0]
                daemon_networks = set(container.attrs['NetworkSettings']['Networks'].keys())
                monitoring_networks = monitoring_container.attrs['NetworkSettings']['Networks']

                for network_name in daemon_networks:
                    if network_name in monitoring_networks:
                        bmp_address = monitoring_networks[network_name]['IPAddress']
                        logger.info(f"[DaemonManager] Auto-discovered BMP address {bmp_address}")
                        break

                if not bmp_address:
                    raise HTTPException(
                        status_code=500,
                        detail=f"No common network found between daemon and monitoring service"
                    )

            # Use call_container_api helper
            api_result = self.call_container_api(
                daemon_name, "/bmp",
                payload={"address": bmp_address, "port": bmp_port}
            )

            if not api_result["success"]:
                raise HTTPException(status_code=500, detail=f"Failed to configure BMP: {api_result['error']}")

            logger.info(f"[DaemonManager] Configured BMP on {daemon_name} to {bmp_address}:{bmp_port}")
            return {
                "success": True,
                "message": f"BMP configured on {daemon_name}",
                "daemon": daemon_name,
                "bmp_address": bmp_address,
                "bmp_port": bmp_port
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[DaemonManager] Failed to configure BMP on {daemon_name}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to configure BMP: {str(e)}")

    def deploy_bgp_peer(self, daemon_name: str, peer_ip: str, peer_asn: int, local_asn: int) -> Dict:
        """Deploy a BGP peer configuration to a running daemon via its unified API."""
        try:
            daemon_info = self.db.get_daemon(daemon_name)
            if not daemon_info:
                raise HTTPException(status_code=404, detail=f"Daemon '{daemon_name}' not found in database")

            container = self.get_container_or_404(daemon_name)
            self.require_running(container, daemon_name)

            api_result = self.call_container_api(
                daemon_name,
                f"/neighbor/{peer_ip}",
                payload={"remote_asn": peer_asn, "local_asn": local_asn}
            )

            if not api_result["success"]:
                raise HTTPException(status_code=500, detail=f"Failed to configure BGP peer: {api_result['error']}")

            logger.info(f"[DaemonManager] Configured BGP peer {peer_ip} (AS{peer_asn}) on {daemon_name}")
            return {
                "success": True,
                "message": f"BGP peer {peer_ip} configured on {daemon_name}",
                "daemon": daemon_name,
                "peer_ip": peer_ip,
                "peer_asn": peer_asn
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[DaemonManager] Failed to deploy BGP peer on {daemon_name}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to deploy BGP peer: {str(e)}")

    def deploy_route_advertisement(self, daemon_name: str, prefix: str, cidr: str,
                                   next_hop: str = None, communities: str = None,
                                   med: int = None, as_path: str = None) -> Dict:
        """Deploy a route advertisement to a running daemon via its unified API."""
        try:
            daemon_info = self.db.get_daemon(daemon_name)
            if not daemon_info:
                raise HTTPException(status_code=404, detail=f"Daemon '{daemon_name}' not found in database")

            container = self.get_container_or_404(daemon_name)
            self.require_running(container, daemon_name)

            route = f"{prefix}/{cidr}"
            payload = {}
            if next_hop:
                payload["next_hop"] = next_hop
            if communities:
                payload["communities"] = communities
            if med is not None:
                payload["med"] = med
            if as_path:
                payload["as_path"] = as_path

            api_result = self.call_container_api(daemon_name, f"/route/{route}", payload=payload)

            if not api_result["success"]:
                raise HTTPException(status_code=500, detail=f"Failed to advertise route: {api_result['error']}")

            logger.info(f"[DaemonManager] Advertised route {route} on {daemon_name}")
            return {
                "success": True,
                "message": f"Route {route} advertised on {daemon_name}",
                "daemon": daemon_name,
                "route": route
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[DaemonManager] Failed to deploy route advertisement on {daemon_name}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to deploy route advertisement: {str(e)}")

    def _configure_netflow(self, daemon_name: str):
        """
        Configure NetFlow/softflowd on a daemon container using auto-discovered monitoring service
        Args:
            daemon_name: Name of the daemon container
        """
        try:
            from ..utils import discover_monitoring_services

            # Discover monitoring service
            monitoring_info = discover_monitoring_services(self.client, "localhost")
            if not monitoring_info or not monitoring_info.get("netflow_udp_port"):
                logger.warning(f"[DaemonManager] Could not discover NetFlow collector for {daemon_name}")
                return

            # Get monitoring container's IP address on a shared network
            try:
                monitoring_container = self.client.containers.get("netstream-monitoring")
                networks = monitoring_container.attrs.get('NetworkSettings', {}).get('Networks', {})

                # Try to find IP on mgmt_network first, fallback to netstream_lab_builder_network
                collector_ip = None
                if 'mgmt_network' in networks:
                    collector_ip = networks['mgmt_network'].get('IPAddress')
                elif 'netstream_lab_builder_network' in networks:
                    collector_ip = networks['netstream_lab_builder_network'].get('IPAddress')

                if not collector_ip:
                    logger.warning(f"[DaemonManager] Could not find monitoring service IP for {daemon_name}")
                    return

                collector_port = monitoring_info["netflow_udp_port"]
                logger.info(f"[DaemonManager] Discovered NetFlow collector: {collector_ip}:{collector_port}")

            except Exception as e:
                logger.warning(f"[DaemonManager] Failed to get monitoring container IP for {daemon_name}: {e}")
                return

            container = self.client.containers.get(daemon_name)

            # Get list of network interfaces with IP addresses (exclude lo, mgmt network, and tunnel interfaces)
            result = container.exec_run("ip -o addr show")
            if result.exit_code == 0:
                output = result.output.decode('utf-8')
                interfaces = []
                skip_prefixes = ['lo', 'tunl', 'gre0', 'gretap', 'erspan', 'ip_vti', 'ip6_vti', 'sit', 'ip6tnl', 'ip6gre']

                for line in output.split('\n'):
                    if line.strip() and 'inet ' in line:
                        # Parse: "11: eth0    inet 10.0.1.2/24 brd 10.0.1.255 scope global eth0"
                        parts = line.split()
                        if len(parts) >= 4:
                            # Format is: "INDEX: IFNAME inet IP_ADDRESS ..."
                            ifname = parts[1].strip().split('@')[0]
                            ip_cidr = parts[3]  # e.g., "10.0.1.2/24" or "172.22.0.4/16"

                            # Skip tunnel interfaces by prefix
                            if any(ifname.startswith(prefix) for prefix in skip_prefixes):
                                continue

                            # Skip management network (172.22.0.0/16) - this is where monitoring service is
                            if ip_cidr.startswith('172.22.'):
                                continue

                            # Skip Docker bridge network (172.17.0.0/16)
                            if ip_cidr.startswith('172.17.'):
                                continue

                            if ifname not in interfaces:
                                interfaces.append(ifname)

                logger.info(f"[DaemonManager] Found interfaces for NetFlow on {daemon_name}: {interfaces}")

                # Stop any existing softflowd instances
                container.exec_run("sh -c 'killall softflowd 2>/dev/null || true'")
                container.exec_run("sh -c 'rm -f /var/run/softflowd.* 2>/dev/null || true'")

                # Start softflowd on ALL suitable interfaces
                if interfaces:
                    for interface in interfaces:
                        cmd = f"softflowd -i {interface} -n {collector_ip}:{collector_port} -v 5 -d"
                        result = container.exec_run(cmd, detach=True)
                        logger.info(f"[DaemonManager] Started softflowd on {daemon_name}:{interface} -> {collector_ip}:{collector_port}")
                else:
                    logger.warning(f"[DaemonManager] No suitable interfaces found for NetFlow on {daemon_name}")
            else:
                logger.warning(f"[DaemonManager] Failed to get interfaces for {daemon_name}")

        except Exception as e:
            logger.error(f"[DaemonManager] Failed to configure NetFlow on {daemon_name}: {e}")
            raise
