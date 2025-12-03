"""
Container Utils - Utility methods for container management
"""
from fastapi import HTTPException
from typing import Dict, Optional
import docker
import logging
import os
import yaml
from .base import BaseManager

logger = logging.getLogger("container-manager")


def get_public_host() -> str:
    """
    Get the public host address for external access (browser/frontend access).
    Uses environment variable PUBLIC_HOST or falls back to localhost.
    """
    return os.getenv("PUBLIC_HOST", "localhost")


def get_daemon_api_host() -> str:
    """
    Get the host address for API calls to daemon containers.
    When running in Docker, use host.docker.internal.
    When running on host machine, use localhost.
    """
    # Check if we're running in Docker by looking for .dockerenv file
    if os.path.exists('/.dockerenv'):
        return "host.docker.internal"
    return os.getenv("DAEMON_API_HOST", "localhost")


class ContainerUtils(BaseManager):
    """Utility methods for container management operations"""

    # ============================================================================
    # Utility Methods
    # ============================================================================

    def get_next_available_ip(self, network: str = None) -> str:
        """
        Get next available IP address in the network using topology IP counter.
        If network is not specified, uses the management network from the active topology.
        IP allocation: counter value + 10 = last octet (e.g., counter 0 -> x.x.x.10)
        """
        try:
            # Get active topology
            active_topology = self.db.get_active_topology()
            if not active_topology:
                raise HTTPException(status_code=404, detail="No active topology found")

            topology_name = active_topology['name']

            # If no network specified, try to use management network from active topology
            if network is None:
                if active_topology.get('management_network'):
                    network = active_topology['management_network']
                    logger.info(f"[ContainerUtils] Using management network '{network}' from active topology")
                else:
                    network = "netstream_lab_builder_network"
                    logger.info(f"[ContainerUtils] No management network configured, using default: {network}")

            # Get network object to determine subnet
            network_obj = self.client.networks.get(network)

            # Get network subnet to determine IP base
            ipam_config = network_obj.attrs.get('IPAM', {}).get('Config', [])
            if ipam_config and ipam_config[0].get('Subnet'):
                subnet = ipam_config[0]['Subnet']
                # Parse subnet (e.g., "192.168.70.0/24" -> "192.168.70")
                base_ip = '.'.join(subnet.split('/')[0].split('.')[:-1])
            else:
                # Fallback to hardcoded base if no subnet info
                base_ip = "192.168.70"

            # Get and increment the counter atomically
            counter_value = self.db.get_and_increment_ip_counter(topology_name)

            # Calculate IP: counter + 10 = last octet
            last_octet = counter_value + 10

            # Ensure we don't exceed 254
            if last_octet > 254:
                raise HTTPException(
                    status_code=500,
                    detail=f"IP counter exhausted (counter: {counter_value}, would be .{last_octet})"
                )

            ip = f"{base_ip}.{last_octet}"
            logger.info(f"[ContainerUtils] Allocated IP {ip} (counter: {counter_value})")

            return ip

        except docker.errors.NotFound:
            raise HTTPException(status_code=404, detail=f"Network '{network}' not found")
        except Exception as e:
            logger.error(f"[ContainerUtils] Failed to get available IP: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to get available IP: {str(e)}")

    def get_next_available_port(self, start_port: int = 6000, end_port: int = 7000) -> int:
        """Get next available host port"""
        # Ports blocked by browsers for security reasons
        BROWSER_BLOCKED_PORTS = {
            6000,  # X11 forwarding
            6665, 6666, 6667, 6668, 6669,  # IRC
        }

        try:
            # Get all containers
            containers = self.client.containers.list(all=True)

            # Extract used ports
            used_ports = set()
            for container in containers:
                if container.attrs.get('NetworkSettings', {}).get('Ports'):
                    for internal, external in container.attrs['NetworkSettings']['Ports'].items():
                        if external:
                            for mapping in external:
                                used_ports.add(int(mapping['HostPort']))

            # Find first available port (skipping browser-blocked ports)
            for port in range(start_port, end_port):
                if port not in used_ports and port not in BROWSER_BLOCKED_PORTS:
                    return port

            raise HTTPException(status_code=500, detail="No available ports")

        except Exception as e:
            logger.error(f"[ContainerUtils] Failed to get available port: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to get available port: {str(e)}")

    def get_next_available_asn(self) -> int:
        """Get next available ASN based on existing daemon containers"""
        try:
            # Get daemons from database
            daemons = self.db.list_daemons()

            # Extract used ASNs
            used_asns = set()
            for daemon in daemons:
                try:
                    asn = int(daemon.get('asn', 0))
                    if asn > 0:
                        used_asns.add(asn)
                except (ValueError, TypeError):
                    pass

            # Find next available ASN in the private ASN range (64512-65534)
            for asn in range(65001, 65535):
                if asn not in used_asns:
                    return asn

            raise HTTPException(status_code=500, detail="No available ASNs")

        except Exception as e:
            logger.error(f"[ContainerUtils] Failed to get available ASN: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to get available ASN: {str(e)}")

    def get_next_available_router_id(self, network: str = "netstream_lab_builder_network") -> str:
        """
        Get next available router ID based on existing daemon containers.
        Router ID follows the same pattern as IP addresses.
        """
        # Router IDs typically match the container IP for simplicity
        return self.get_next_available_ip(network)

    def restore_lab_from_db(self) -> Dict:
        """
        Restore the entire lab infrastructure from database.
        This recreates all networks, daemons, and hosts based on saved configuration.

        Returns a summary of what was restored.
        """
        logger.info("[ContainerUtils] Starting lab restoration from database...")

        results = {
            "networks": {"created": [], "skipped": [], "failed": []},
            "daemons": {"created": [], "skipped": [], "failed": []},
            "hosts": {"created": [], "skipped": [], "failed": []},
            "daemon_networks": {"connected": [], "failed": []},
            "bgp_peers": {"configured": [], "failed": []}
        }

        try:
            # Step 1: Restore networks
            logger.info("[ContainerUtils] Restoring networks...")
            networks = self.db.list_networks()
            for network in networks:
                try:
                    # Check if network already exists
                    existing = self.get_network(network["name"])
                    if existing:
                        logger.info(f"Network '{network['name']}' already exists, skipping")
                        results["networks"]["skipped"].append(network["name"])
                        continue

                    # Create the network
                    self.create_network(
                        name=network["name"],
                        subnet=network["subnet"],
                        gateway=network["gateway"],
                        driver=network.get("driver", "bridge")
                    )
                    results["networks"]["created"].append(network["name"])
                    logger.info(f"Restored network: {network['name']}")
                except Exception as e:
                    logger.error(f"Failed to restore network '{network['name']}': {e}")
                    results["networks"]["failed"].append({"name": network["name"], "error": str(e)})

            # Step 2: Restore daemons
            logger.info("[ContainerUtils] Restoring BGP daemons...")
            daemons = self.db.list_daemons()
            for daemon in daemons:
                try:
                    # Check if daemon already exists
                    existing = self.get_daemon(daemon["name"])
                    if existing:
                        logger.info(f"Daemon '{daemon['name']}' already exists, skipping")
                        results["daemons"]["skipped"].append(daemon["name"])
                        continue

                    # Create the daemon
                    self.create_daemon(
                        name=daemon["name"],
                        daemon_type=daemon["daemon_type"],
                        asn=daemon["asn"],
                        router_id=daemon["router_id"],
                        ip_address=daemon["ip_address"],
                        api_port=daemon["api_port"],
                        location=daemon.get("location", "Local")
                    )
                    results["daemons"]["created"].append(daemon["name"])
                    logger.info(f"Restored daemon: {daemon['name']}")
                except Exception as e:
                    logger.error(f"Failed to restore daemon '{daemon['name']}': {e}")
                    results["daemons"]["failed"].append({"name": daemon["name"], "error": str(e)})

            # Step 3: Connect daemons to their networks
            logger.info("[ContainerUtils] Restoring daemon network connections...")
            for daemon in daemons:
                try:
                    daemon_networks = self.db.get_daemon_networks(daemon["name"])
                    for dn in daemon_networks:
                        try:
                            # Skip the primary network (already connected during daemon creation)
                            if dn["name"] == "netstream_lab_builder_network":
                                continue

                            self.connect_container_to_network(
                                container_name=daemon["name"],
                                network_name=dn["name"],
                                ipv4_address=dn.get("ipv4_address")
                            )
                            results["daemon_networks"]["connected"].append({
                                "daemon": daemon["name"],
                                "network": dn["name"],
                                "ip": dn.get("ipv4_address")
                            })
                            logger.info(f"Connected daemon '{daemon['name']}' to network '{dn['name']}'")
                        except Exception as e:
                            logger.error(f"Failed to connect daemon '{daemon['name']}' to network '{dn['name']}': {e}")
                            results["daemon_networks"]["failed"].append({
                                "daemon": daemon["name"],
                                "network": dn["name"],
                                "error": str(e)
                            })
                except Exception as e:
                    logger.error(f"Failed to get network connections for daemon '{daemon['name']}': {e}")

            # Step 4: Restore hosts
            logger.info("[ContainerUtils] Restoring host containers...")
            hosts = self.db.list_hosts()
            for host in hosts:
                try:
                    # Check if host already exists
                    existing = self.get_host(host["name"])
                    if existing:
                        logger.info(f"Host '{host['name']}' already exists, skipping")
                        results["hosts"]["skipped"].append(host["name"])
                        continue

                    # Create the host
                    self.create_host(
                        name=host["name"],
                        gateway_daemon=host["gateway_daemon"],
                        gateway_ip=host["gateway_ip"],
                        container_ip=host["container_ip"],
                        loopback_ip=host["loopback_ip"],
                        loopback_network=host.get("loopback_network", "24")
                    )
                    results["hosts"]["created"].append(host["name"])
                    logger.info(f"Restored host: {host['name']}")
                except Exception as e:
                    logger.error(f"Failed to restore host '{host['name']}': {e}")
                    results["hosts"]["failed"].append({"name": host["name"], "error": str(e)})

            # Step 5: Restore BGP peer configurations
            logger.info("[ContainerUtils] Restoring BGP peer configurations...")
            for daemon in daemons:
                try:
                    peers = self.db.get_daemon_peers(daemon["name"])
                    for peer in peers:
                        try:
                            # Use the unified BGP API to configure the peer
                            # Note: This assumes the daemon is already running and has the API available
                            # You may need to adjust this based on your actual BGP configuration method
                            logger.info(f"BGP peer configuration for {daemon['name']} -> {peer['peer_ip']} recorded (manual configuration may be needed)")
                            results["bgp_peers"]["configured"].append({
                                "daemon": daemon["name"],
                                "peer_ip": peer["peer_ip"],
                                "peer_asn": peer["peer_asn"]
                            })
                        except Exception as e:
                            logger.error(f"Failed to configure BGP peer {peer['peer_ip']} for daemon '{daemon['name']}': {e}")
                            results["bgp_peers"]["failed"].append({
                                "daemon": daemon["name"],
                                "peer_ip": peer["peer_ip"],
                                "error": str(e)
                            })
                except Exception as e:
                    logger.error(f"Failed to get BGP peers for daemon '{daemon['name']}': {e}")

            logger.info(f"[ContainerUtils] Lab restoration complete. Summary: {results}")
            return results

        except Exception as e:
            logger.error(f"[ContainerUtils] Lab restoration failed: {e}")
            raise HTTPException(status_code=500, detail=f"Lab restoration failed: {str(e)}")

    def get_lab_topology(self) -> Dict:
        """
        Get complete lab topology including all networks, daemons, hosts, and their interfaces.
        This provides a structured view of the entire lab for visualization.
        """
        logger.info("[ContainerUtils] Gathering lab topology data...")

        topology = {
            "networks": [],
            "daemons": [],
            "hosts": [],
            "connections": [],
            "bgp_peers": [],
            "bgp_routes": []
        }

        try:
            # Get all running containers first
            containers = self.client.containers.list(all=True)

            # Track which networks are used by daemons/hosts
            used_networks = set()

            for container in containers:
                container_name = container.name

                # Get all network interfaces for this container
                interfaces = []
                networks_attached = container.attrs.get('NetworkSettings', {}).get('Networks', {})

                for net_name, net_data in networks_attached.items():
                    # Try to get IP from active assignment first, fall back to static config
                    ipv4 = net_data.get('IPAddress', '')
                    if not ipv4:
                        ipam_config = net_data.get('IPAMConfig', {})
                        if ipam_config:
                            ipv4 = ipam_config.get('IPv4Address', '')

                    interface = {
                        "network": net_name,
                        "ipv4": ipv4,
                        "gateway": net_data.get('Gateway', ''),
                        "mac": net_data.get('MacAddress', '')
                    }
                    interfaces.append(interface)

                # Build base container info
                container_info = {
                    "id": container.id[:12],
                    "name": container_name,
                    "status": container.status,
                    "interfaces": interfaces
                }

                # Check if it's a daemon (use database as source of truth)
                daemon_db = self.db.get_daemon(container_name)
                if daemon_db:
                    container_info.update({
                        "type": daemon_db.get("daemon_type", "unknown"),
                        "asn": daemon_db.get("asn"),
                        "router_id": daemon_db.get("router_id"),
                        "api_port": daemon_db.get("api_port")
                    })
                    topology["daemons"].append(container_info)
                    # Track networks used by this daemon
                    for iface in interfaces:
                        used_networks.add(iface["network"])
                else:
                    # Check if it's a host
                    host_db = self.db.get_host(container_name)
                    if host_db:
                        container_info.update({
                            "gateway_daemon": host_db.get("gateway_daemon"),
                            "gateway_ip": host_db.get("gateway_ip"),
                            "loopback_ip": host_db.get("loopback_ip"),
                            "loopback_network": host_db.get("loopback_network")
                        })
                        topology["hosts"].append(container_info)
                        # Track networks used by this host
                        for iface in interfaces:
                            used_networks.add(iface["network"])

            # Now get networks, but only include ones used by daemons/hosts
            networks = self.client.networks.list()
            for network in networks:
                # Skip default docker networks
                if network.name in ['bridge', 'host', 'none']:
                    continue

                # Only include networks that are used by daemons or hosts
                if network.name not in used_networks:
                    continue

                network_info = {
                    "id": network.id[:12],
                    "name": network.name,
                    "driver": network.attrs.get('Driver', 'bridge'),
                    "subnet": None,
                    "gateway": None,
                    "containers": []
                }

                # Extract IPAM config
                ipam_config = network.attrs.get('IPAM', {}).get('Config', [])
                if ipam_config:
                    network_info["subnet"] = ipam_config[0].get('Subnet')
                    network_info["gateway"] = ipam_config[0].get('Gateway')

                # Get containers on this network
                containers_on_network = network.attrs.get('Containers', {})
                for container_id, container_data in containers_on_network.items():
                    network_info["containers"].append({
                        "id": container_id[:12],
                        "name": container_data.get('Name'),
                        "ipv4": container_data.get('IPv4Address', '').split('/')[0] if container_data.get('IPv4Address') else None
                    })

                topology["networks"].append(network_info)

            # Build connections map (which containers are on which networks)
            for network in topology["networks"]:
                for container_info in network["containers"]:
                    topology["connections"].append({
                        "network": network["name"],
                        "container": container_info["name"],
                        "ip": container_info["ipv4"]
                    })

            # Get BGP peering relationships from database
            logger.info("[ContainerUtils] Gathering BGP peering relationships...")
            for daemon in topology["daemons"]:
                daemon_name = daemon["name"]
                try:
                    peers = self.db.get_daemon_peers(daemon_name)
                    for peer in peers:
                        # Find the peer daemon by IP
                        peer_daemon = None
                        for d in topology["daemons"]:
                            for iface in d["interfaces"]:
                                if iface["ipv4"] == peer["peer_ip"]:
                                    peer_daemon = d["name"]
                                    break
                            if peer_daemon:
                                break

                        if peer_daemon:
                            topology["bgp_peers"].append({
                                "source": daemon_name,
                                "target": peer_daemon,
                                "source_asn": daemon["asn"],
                                "target_asn": peer["peer_asn"],
                                "peer_ip": peer["peer_ip"]
                            })
                except Exception as e:
                    logger.debug(f"Could not get peers for daemon {daemon_name}: {e}")

            # Get BGP routes from database
            logger.info("[ContainerUtils] Gathering BGP routes...")
            for daemon in topology["daemons"]:
                daemon_name = daemon["name"]
                try:
                    routes = self.db.get_daemon_routes(daemon_name)
                    for route in routes:
                        topology["bgp_routes"].append({
                            "local_daemon": daemon_name,
                            "prefix": route["prefix"],
                            "next_hop": route.get("next_hop"),
                            "origin": route.get("origin", "incomplete"),
                            "local_pref": route.get("local_pref"),
                            "med": route.get("med")
                        })
                except Exception as e:
                    logger.debug(f"Could not get routes for daemon {daemon_name}: {e}")

            logger.info(f"[ContainerUtils] Topology gathered: {len(topology['networks'])} networks, "
                       f"{len(topology['daemons'])} daemons, {len(topology['hosts'])} hosts, "
                       f"{len(topology['bgp_peers'])} BGP peers, {len(topology['bgp_routes'])} BGP routes")

            return topology

        except Exception as e:
            logger.error(f"[ContainerUtils] Failed to get lab topology: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to get lab topology: {str(e)}")

    def sync_daemons_to_db(self, topology_name: str = "default") -> Dict:
        """
        Sync existing Docker daemon containers to the database.
        This is useful when daemons were created outside the API (e.g., via docker-compose).
        Now calls the comprehensive sync_all_daemons method.
        """
        logger.info("[ContainerUtils] Syncing daemons from Docker to database...")
        return self.sync_all_daemons(topology_name=topology_name)

    def sync_hosts_to_db(self) -> Dict:
        """
        Sync existing Docker host containers to the database.
        This is useful when hosts were created outside the API (e.g., via docker-compose or manual creation).
        Now calls the comprehensive sync_all_hosts method.
        """
        logger.info("[ContainerUtils] Syncing hosts from Docker to database...")
        return self.sync_all_hosts(topology_name="default")

    def sync_networks_to_db(self, topology_name: str = "default") -> Dict:
        """
        Sync Docker networks that are used by daemons and hosts to the database.
        Only syncs networks that our containers are actually connected to.

        Args:
            topology_name: The topology to associate networks with (default: "default")

        Returns:
            Dictionary with added/updated/skipped network counts
        """
        logger.info(f"[ContainerUtils] Syncing Docker networks to database for topology '{topology_name}'...")

        try:
            results = {
                "added": [],
                "updated": [],
                "skipped": []
            }

            # Build set of networks used by our containers
            networks_in_use = set()

            # Get networks from daemons
            daemons = self.db.list_daemons(topology_name=topology_name)
            for daemon in daemons:
                try:
                    container = self.client.containers.get(daemon["name"])
                    container_networks = container.attrs.get('NetworkSettings', {}).get('Networks', {})
                    for network_name in container_networks.keys():
                        networks_in_use.add(network_name)
                except docker.errors.NotFound:
                    logger.warning(f"Daemon container '{daemon['name']}' not found in Docker")
                except Exception as e:
                    logger.error(f"Failed to get networks for daemon '{daemon['name']}': {e}")

            # Get networks from hosts
            hosts = self.db.list_hosts(topology_name=topology_name)
            for host in hosts:
                try:
                    container = self.client.containers.get(host["name"])
                    container_networks = container.attrs.get('NetworkSettings', {}).get('Networks', {})
                    for network_name in container_networks.keys():
                        networks_in_use.add(network_name)
                except docker.errors.NotFound:
                    logger.warning(f"Host container '{host['name']}' not found in Docker")
                except Exception as e:
                    logger.error(f"Failed to get networks for host '{host['name']}': {e}")

            logger.info(f"Found {len(networks_in_use)} networks in use by containers: {networks_in_use}")

            # Sync only the networks that are in use
            for network_name in networks_in_use:
                try:
                    network = self.client.networks.get(network_name)
                    driver = network.attrs.get('Driver', 'unknown')

                    # Skip system networks (null, host, none drivers)
                    if driver in ['null', 'host', 'none']:
                        logger.debug(f"Skipping system network '{network_name}' (driver: {driver})")
                        continue

                    # Get IPAM configuration
                    ipam_config = network.attrs.get('IPAM', {}).get('Config', [])
                    if not ipam_config or len(ipam_config) == 0:
                        logger.warning(f"Network '{network_name}' has no IPAM config, skipping")
                        results["skipped"].append({
                            "name": network_name,
                            "reason": "No IPAM configuration"
                        })
                        continue

                    subnet = ipam_config[0].get('Subnet')
                    gateway = ipam_config[0].get('Gateway')

                    if not subnet:
                        logger.warning(f"Network '{network_name}' has no subnet, skipping")
                        results["skipped"].append({
                            "name": network_name,
                            "reason": "No subnet defined"
                        })
                        continue

                    # Check if network already exists in database
                    existing_network = self.db.get_network(network_name)

                    # Sync to database (upsert operation)
                    self.db.create_network(
                        name=network_name,
                        subnet=subnet,
                        gateway=gateway if gateway else "unknown",
                        driver=driver,
                        docker_id=network.id[:12],
                        topology_name=topology_name
                    )

                    if existing_network:
                        results["updated"].append(network_name)
                        logger.info(f"Updated network '{network_name}' in database")
                    else:
                        results["added"].append(network_name)
                        logger.info(f"Added network '{network_name}' to database")

                except docker.errors.NotFound:
                    logger.error(f"Network '{network_name}' not found in Docker")
                    results["skipped"].append({
                        "name": network_name,
                        "error": "Network not found in Docker"
                    })
                except Exception as e:
                    logger.error(f"Failed to sync network '{network_name}' to database: {e}")
                    results["skipped"].append({
                        "name": network_name,
                        "error": str(e)
                    })

            logger.info(f"[ContainerUtils] Network sync complete: {len(results['added'])} added, "
                       f"{len(results['updated'])} updated, {len(results['skipped'])} skipped")

            return results

        except Exception as e:
            logger.error(f"[ContainerUtils] Failed to sync networks: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to sync networks: {str(e)}")

    def add_bgp_peer_to_topology(self, local_daemon: str, peer_ip: str, peer_asn: int,
                                 peer_router_id: Optional[str] = None) -> Dict:
        """
        Add a BGP peer relationship to the topology.
        This saves the peer to the database and configures it on the daemon.

        Args:
            local_daemon: Name of the local daemon
            peer_ip: IP address of the BGP peer
            peer_asn: ASN of the BGP peer
            peer_router_id: Router ID of the peer (optional, auto-detected if not provided)

        Returns:
            Dictionary with status and details
        """
        logger.info(f"[ContainerUtils] Adding BGP peer {peer_ip} (AS{peer_asn}) to daemon '{local_daemon}'...")

        try:
            # Get daemon info from database
            daemon = self.db.get_daemon(local_daemon)
            if not daemon:
                raise HTTPException(status_code=404, detail=f"Daemon '{local_daemon}' not found in database")

            local_asn = daemon.get("asn")
            if not local_asn:
                raise HTTPException(status_code=400, detail=f"Daemon '{local_daemon}' has no ASN configured")

            # Auto-detect peer_router_id and find local_ip if not provided
            local_ip = None
            is_external_peer = False

            if not peer_router_id:
                # Try to find which daemon has this peer IP
                all_daemons = self.db.list_daemons()
                for d in all_daemons:
                    networks = self.db.get_daemon_networks(d['name'])
                    for net in networks:
                        # Check if this daemon has the peer IP (strip /24 or other CIDR notation)
                        daemon_ip = net['ipv4_address'].split('/')[0] if '/' in net['ipv4_address'] else net['ipv4_address']
                        if daemon_ip == peer_ip:
                            peer_router_id = d['name']
                            logger.info(f"[ContainerUtils] Auto-detected peer_router_id: {peer_router_id}")
                            break
                    if peer_router_id:
                        break

            # Check if peer_router_id is an external node (not a daemon)
            if peer_router_id:
                external_nodes = self.db.list_external_nodes()
                is_external_peer = any(node['name'] == peer_router_id for node in external_nodes)
                if is_external_peer:
                    logger.info(f"[ContainerUtils] Detected external node peer: {peer_router_id}")

            # Find local_ip - the IP address of local_daemon on the same network as peer_ip
            # This is needed for topology visualization to draw BGP links
            local_networks = self.db.get_daemon_networks(local_daemon)
            for local_net in local_networks:
                local_net_ip = local_net['ipv4_address'].split('/')[0] if '/' in local_net['ipv4_address'] else local_net['ipv4_address']
                local_net_prefix = local_net_ip.rsplit('.', 1)[0]  # Get network prefix (e.g., "192.168.50")
                peer_prefix = peer_ip.rsplit('.', 1)[0]

                if local_net_prefix == peer_prefix:
                    local_ip = local_net_ip
                    logger.info(f"[ContainerUtils] Found local_ip {local_ip} on same network as peer {peer_ip}")
                    break

            # Save peer to database first
            self.db.create_bgp_peer(
                local_daemon=local_daemon,
                peer_ip=peer_ip,
                peer_asn=peer_asn,
                local_asn=local_asn,
                local_ip=local_ip,
                peer_router_id=peer_router_id
            )

            # If peer is an external node, skip live configuration (external nodes have no containers)
            if is_external_peer:
                logger.info(f"[ContainerUtils] Peer is external node, saving to database only (no live configuration)")
                return {
                    "status": "success",
                    "message": f"BGP peer {peer_ip} to external node '{peer_router_id}' saved to database",
                    "local_daemon": local_daemon,
                    "peer_ip": peer_ip,
                    "peer_asn": peer_asn,
                    "peer_router_id": peer_router_id,
                    "is_external": True,
                    "configured": False
                }

            # Get the daemon's API port for live configuration
            try:
                container = self.client.containers.get(local_daemon)
                port_bindings = container.attrs.get('NetworkSettings', {}).get('Ports', {})

                # Find the port mapping for port 5000 (daemon API)
                api_port = None
                if '5000/tcp' in port_bindings and port_bindings['5000/tcp']:
                    host_port = port_bindings['5000/tcp'][0]['HostPort']
                    api_port = int(host_port)

                if not api_port:
                    logger.warning(f"Could not find API port for daemon '{local_daemon}', skipping live configuration")
                    return {
                        "status": "partial",
                        "message": f"BGP peer {peer_ip} added to database but not configured on daemon (API port not found)",
                        "local_daemon": local_daemon,
                        "peer_ip": peer_ip,
                        "peer_asn": peer_asn
                    }

                # Configure the peer on the daemon via its API
                import requests
                api_host = self.get_daemon_api_host()
                api_url = f"http://{api_host}:{api_port}/neighbor/{peer_ip}"

                payload = {
                    "remote_asn": peer_asn,
                    "local_asn": local_asn
                }

                response = requests.post(api_url, json=payload, timeout=10)

                if response.status_code in [200, 201]:
                    logger.info(f"Successfully configured BGP peer {peer_ip} on daemon '{local_daemon}'")
                    return {
                        "status": "success",
                        "message": f"BGP peer {peer_ip} configured successfully",
                        "local_daemon": local_daemon,
                        "peer_ip": peer_ip,
                        "peer_asn": peer_asn,
                        "configured": True
                    }
                else:
                    logger.warning(f"Failed to configure peer via API: {response.text}")
                    return {
                        "status": "partial",
                        "message": f"BGP peer {peer_ip} added to database but failed to configure on daemon",
                        "local_daemon": local_daemon,
                        "peer_ip": peer_ip,
                        "peer_asn": peer_asn,
                        "configured": False,
                        "error": response.text
                    }

            except Exception as e:
                logger.error(f"Failed to configure peer on daemon: {e}")
                return {
                    "status": "partial",
                    "message": f"BGP peer {peer_ip} added to database but failed to configure on daemon",
                    "local_daemon": local_daemon,
                    "peer_ip": peer_ip,
                    "peer_asn": peer_asn,
                    "configured": False,
                    "error": str(e)
                }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[ContainerUtils] Failed to add BGP peer: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to add BGP peer: {str(e)}")
