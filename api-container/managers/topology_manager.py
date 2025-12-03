"""
Topology Manager - Manages topology lifecycle operations
"""
from fastapi import HTTPException
from typing import Dict
import docker
import logging
import os
from .base import BaseManager

logger = logging.getLogger("container-api")


class TopologyManager(BaseManager):
    """Manages topology standup, teardown, and details"""

    def __init__(self, client=None, db=None, daemon_manager=None, host_manager=None):
        """
        Initialize TopologyManager with Docker client, database, and other managers.
        """
        super().__init__(client, db)
        self.daemon_manager = daemon_manager
        self.host_manager = host_manager

    # ============================================================================
    # Topology Management Methods
    # ============================================================================

    def teardown_topology(self, topology_name: str) -> Dict:
        """
        Teardown a topology by stopping and removing all its containers and networks.
        Returns a summary of what was torn down.
        """
        logger.info(f"[TopologyManager] Tearing down topology '{topology_name}'...")

        results = {
            "hosts_removed": [],
            "daemons_removed": [],
            "networks_removed": [],
            "errors": []
        }

        try:
            # Step 1: Remove all hosts in this topology
            hosts = self.db.list_hosts(topology_name=topology_name)
            for host in hosts:
                try:
                    # Check if container exists in Docker
                    try:
                        container = self.client.containers.get(host["name"])
                        # Stop and remove container
                        if container.status in ["running", "restarting"]:
                            container.kill()
                        container.remove(force=True)
                        results["hosts_removed"].append(host["name"])
                        logger.info(f"Removed host container: {host['name']}")
                    except docker.errors.NotFound:
                        logger.info(f"Host container '{host['name']}' not found in Docker, removing from DB only")
                        results["hosts_removed"].append(host["name"])

                    # Remove from database
                    self.db.delete_host(host["name"])
                except Exception as e:
                    logger.error(f"Failed to remove host '{host['name']}': {e}")
                    results["errors"].append({"type": "host", "name": host["name"], "error": str(e)})

            # Step 2: Remove all daemons in this topology
            daemons = self.db.list_daemons(topology_name=topology_name)
            for daemon in daemons:
                try:
                    # Check if container exists in Docker
                    try:
                        container = self.client.containers.get(daemon["name"])
                        # Stop and remove container
                        if container.status in ["running", "restarting"]:
                            container.stop(timeout=10)
                        container.remove(force=True)
                        results["daemons_removed"].append(daemon["name"])
                        logger.info(f"Removed daemon container: {daemon['name']}")
                    except docker.errors.NotFound:
                        logger.info(f"Daemon container '{daemon['name']}' not found in Docker, removing from DB only")
                        results["daemons_removed"].append(daemon["name"])

                    # Remove from database
                    self.db.delete_daemon(daemon["name"])
                except Exception as e:
                    logger.error(f"Failed to remove daemon '{daemon['name']}': {e}")
                    results["errors"].append({"type": "daemon", "name": daemon["name"], "error": str(e)})

            # Step 3: Remove all networks in this topology
            networks = self.db.list_networks(topology_name=topology_name)
            for network in networks:
                try:
                    # Check if network exists in Docker
                    try:
                        network_obj = self.client.networks.get(network["name"])
                        # Check if network has any remaining containers
                        network_obj.reload()
                        containers = network_obj.attrs.get('Containers', {})
                        if containers:
                            logger.warning(f"Network '{network['name']}' still has {len(containers)} containers attached, forcing disconnect")
                            for container_id in containers.keys():
                                try:
                                    container = self.client.containers.get(container_id)
                                    network_obj.disconnect(container, force=True)
                                except Exception as e:
                                    logger.debug(f"Failed to disconnect container from network: {e}")

                        # Remove network
                        network_obj.remove()
                        results["networks_removed"].append(network["name"])
                        logger.info(f"Removed network: {network['name']}")
                    except docker.errors.NotFound:
                        logger.info(f"Network '{network['name']}' not found in Docker, removing from DB only")
                        results["networks_removed"].append(network["name"])

                    # Remove from database
                    self.db.delete_network(network["name"])
                except Exception as e:
                    logger.error(f"Failed to remove network '{network['name']}': {e}")
                    results["errors"].append({"type": "network", "name": network["name"], "error": str(e)})

            logger.info(f"[TopologyManager] Teardown complete for '{topology_name}': "
                       f"{len(results['hosts_removed'])} hosts, {len(results['daemons_removed'])} daemons, "
                       f"{len(results['networks_removed'])} networks removed, {len(results['errors'])} errors")

            return results

        except Exception as e:
            logger.error(f"[TopologyManager] Topology teardown failed: {e}")
            raise HTTPException(status_code=500, detail=f"Topology teardown failed: {str(e)}")

    def stop_topology(self, topology_name: str) -> Dict:
        """
        Stop a topology by stopping all its containers but leaving them in the topology definition.
        Unlike teardown, this does NOT remove containers from Docker or delete from database.
        Returns a summary of what was stopped.
        """
        logger.info(f"[TopologyManager] Stopping topology '{topology_name}'...")

        results = {
            "hosts_stopped": [],
            "daemons_stopped": [],
            "errors": []
        }

        try:
            # Step 1: Stop all hosts in this topology
            hosts = self.db.list_hosts(topology_name=topology_name)
            for host in hosts:
                try:
                    try:
                        container = self.client.containers.get(host["name"])
                        if container.status in ["running", "restarting"]:
                            container.stop(timeout=10)
                            results["hosts_stopped"].append(host["name"])
                            logger.info(f"Stopped host container: {host['name']}")
                        else:
                            logger.info(f"Host container '{host['name']}' already stopped (status: {container.status})")
                    except docker.errors.NotFound:
                        logger.info(f"Host container '{host['name']}' not found in Docker")
                except Exception as e:
                    logger.error(f"Failed to stop host '{host['name']}': {e}")
                    results["errors"].append({"type": "host", "name": host["name"], "error": str(e)})

            # Step 2: Stop all daemons in this topology
            daemons = self.db.list_daemons(topology_name=topology_name)
            for daemon in daemons:
                try:
                    try:
                        container = self.client.containers.get(daemon["name"])
                        if container.status in ["running", "restarting"]:
                            container.stop(timeout=10)
                            results["daemons_stopped"].append(daemon["name"])
                            logger.info(f"Stopped daemon container: {daemon['name']}")
                        else:
                            logger.info(f"Daemon container '{daemon['name']}' already stopped (status: {container.status})")
                    except docker.errors.NotFound:
                        logger.info(f"Daemon container '{daemon['name']}' not found in Docker")
                except Exception as e:
                    logger.error(f"Failed to stop daemon '{daemon['name']}': {e}")
                    results["errors"].append({"type": "daemon", "name": daemon["name"], "error": str(e)})

            logger.info(f"[TopologyManager] Stop complete for '{topology_name}': "
                       f"{len(results['hosts_stopped'])} hosts, {len(results['daemons_stopped'])} daemons stopped, "
                       f"{len(results['errors'])} errors")

            return results

        except Exception as e:
            logger.error(f"[TopologyManager] Topology stop failed: {e}")
            raise HTTPException(status_code=500, detail=f"Topology stop failed: {str(e)}")

    def standup_topology(self, topology_name: str) -> Dict:
        """
        Standup a topology by creating all its networks, daemons, and hosts from database.
        Returns a summary of what was created.
        """
        logger.info(f"[TopologyManager] Standing up topology '{topology_name}'...")

        results = {
            "networks_created": [],
            "daemons_created": [],
            "hosts_created": [],
            "daemon_networks_connected": [],
            "bgp_peers_configured": [],
            "routes_advertised": [],
            "errors": []
        }

        try:
            # Step 1: Create all networks for this topology
            networks = self.db.list_networks(topology_name=topology_name)
            for network in networks:
                try:
                    # Check if network already exists
                    try:
                        existing = self.client.networks.get(network["name"])
                        logger.info(f"Network '{network['name']}' already exists, skipping")
                        continue
                    except docker.errors.NotFound:
                        pass

                    # Create network
                    ipam_pool = docker.types.IPAMPool(
                        subnet=network["subnet"],
                        gateway=network["gateway"]
                    )
                    ipam_config = docker.types.IPAMConfig(pool_configs=[ipam_pool])

                    driver = network.get("driver", "bridge")
                    driver_opts = {}

                    # For macvlan/ipvlan networks, set the parent interface
                    parent_interface = network.get("parent_interface")
                    if driver in ["macvlan", "ipvlan"] and parent_interface:
                        driver_opts["parent"] = parent_interface
                        logger.info(f"Creating {driver} network '{network['name']}' with parent interface '{parent_interface}'")

                    self.client.networks.create(
                        name=network["name"],
                        driver=driver,
                        ipam=ipam_config,
                        check_duplicate=True,
                        options=driver_opts if driver_opts else None
                    )
                    results["networks_created"].append(network["name"])
                    logger.info(f"Created network: {network['name']} (driver={driver})")
                except Exception as e:
                    logger.error(f"Failed to create network '{network['name']}': {e}")
                    results["errors"].append({"type": "network", "name": network["name"], "error": str(e)})

            # Step 2: Create all daemons for this topology
            daemons = self.db.list_daemons(topology_name=topology_name)
            for daemon in daemons:
                try:
                    # Check if daemon already exists
                    try:
                        existing = self.client.containers.get(daemon["name"])
                        # For idempotence: always remove and recreate to ensure clean state
                        logger.info(f"Daemon '{daemon['name']}' exists (status: '{existing.status}'), removing and recreating for idempotence")
                        try:
                            existing.remove(force=True)
                        except Exception as e:
                            logger.warning(f"Failed to remove daemon '{daemon['name']}': {e}")
                    except docker.errors.NotFound:
                        pass

                    # Determine image name
                    image_map = {
                        "gobgp": "gobgp-unified",
                        "frr": "frr-unified",
                        "exabgp": "exabgp-unified"
                    }
                    image = image_map.get(daemon["daemon_type"], "gobgp-unified")

                    # Create container
                    container = self.client.containers.create(
                        image=image,
                        name=daemon["name"],
                        hostname=daemon["name"],
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
                        ports={
                            "5000/tcp": daemon["api_port"]
                        },
                        volumes={
                            "/Users/jeremykast/src/netstream/api-routing": {
                                "bind": "/app/api-routing",
                                "mode": "rw"
                            }
                        },
                        cap_add=["NET_ADMIN", "SYS_ADMIN", "NET_RAW"],
                        sysctls={
                            "net.ipv4.ip_forward": "1",
                            "net.ipv4.conf.all.forwarding": "1"
                        },
                        restart_policy={"Name": "unless-stopped"}
                    )

                    # Connect to primary network
                    try:
                        network_obj = self.client.networks.get("netstream_lab_builder_network")
                        network_obj.connect(container, ipv4_address=daemon["ip_address"])
                    except Exception as e:
                        container.remove(force=True)
                        raise Exception(f"Failed to connect to primary network: {str(e)}")

                    # Start container
                    container.start()
                    results["daemons_created"].append(daemon["name"])
                    logger.info(f"Created daemon: {daemon['name']}")

                except Exception as e:
                    logger.error(f"Failed to create daemon '{daemon['name']}': {e}")
                    results["errors"].append({"type": "daemon", "name": daemon["name"], "error": str(e)})

            # Step 3: Connect daemons to additional networks
            for daemon in daemons:
                try:
                    daemon_networks = self.db.get_daemon_networks(daemon["name"])
                    for dn in daemon_networks:
                        try:
                            # Skip primary network (already connected)
                            if dn["name"] == "netstream_lab_builder_network":
                                continue

                            container = self.client.containers.get(daemon["name"])
                            network_obj = self.client.networks.get(dn["name"])

                            # Check if already connected
                            container.reload()
                            current_networks = container.attrs.get('NetworkSettings', {}).get('Networks', {})
                            if dn["name"] in current_networks:
                                continue

                            # Connect to network
                            if dn.get("ipv4_address"):
                                network_obj.connect(container, ipv4_address=dn["ipv4_address"])
                            else:
                                network_obj.connect(container)

                            results["daemon_networks_connected"].append({
                                "daemon": daemon["name"],
                                "network": dn["name"]
                            })
                            logger.info(f"Connected daemon '{daemon['name']}' to network '{dn['name']}'")
                        except Exception as e:
                            logger.error(f"Failed to connect daemon '{daemon['name']}' to network '{dn['name']}': {e}")
                            results["errors"].append({
                                "type": "daemon_network",
                                "daemon": daemon["name"],
                                "network": dn["name"],
                                "error": str(e)
                            })
                except Exception as e:
                    logger.debug(f"Could not get networks for daemon '{daemon['name']}': {e}")

            # Step 4: Create all hosts for this topology
            hosts = self.db.list_hosts(topology_name=topology_name)
            for host in hosts:
                try:
                    # Check if host already exists
                    try:
                        existing = self.client.containers.get(host["name"])
                        # For idempotence: always remove and recreate to ensure clean state
                        logger.info(f"Host '{host['name']}' exists (status: '{existing.status}'), removing and recreating for idempotence")
                        try:
                            existing.remove(force=True)
                        except Exception as e:
                            logger.warning(f"Failed to remove host '{host['name']}': {e}")
                    except docker.errors.NotFound:
                        pass

                    # Auto-assign API port
                    api_port = self.get_next_available_port(start_port=8000, end_port=9000)

                    # Simple container creation - network config handled by reset_networking
                    loopback_network = host.get("loopback_network", "24")

                    # Create container (no custom command - use image entrypoint)
                    container = self.client.containers.create(
                        image="host-netknight",
                        name=host["name"],
                        hostname=host["name"],
                        detach=True,
                        cap_add=["NET_ADMIN", "SYS_ADMIN", "NET_RAW"],
                        labels={
                            "netstream.type": "host",
                            "netstream.gateway_daemon": host["gateway_daemon"],
                            "netstream.gateway_ip": host["gateway_ip"],
                            "netstream.loopback_ip": host["loopback_ip"],
                            "netstream.loopback_network": loopback_network,
                            "netstream.container_ip": host.get("container_ip", ""),
                            "netstream.api_port": str(api_port)
                        },
                        ports={
                            "8000/tcp": api_port
                        },
                        volumes={
                            "/Users/jeremykast/src/netstream/api-netknight": {
                                "bind": "/app/api-netknight",
                                "mode": "rw"
                            }
                        },
                        restart_policy={"Name": "unless-stopped"}
                    )

                    # Connect to main network
                    try:
                        network_obj = self.client.networks.get("netstream_lab_builder_network")
                        if host.get("container_ip"):
                            network_obj.connect(container, ipv4_address=host["container_ip"])
                        else:
                            network_obj.connect(container)
                    except Exception as e:
                        container.remove(force=True)
                        raise Exception(f"Failed to connect to main network: {str(e)}")

                    # Connect to gateway network (the network where the gateway IP resides)
                    try:
                        gateway_ip = host["gateway_ip"]
                        # Find which network contains this gateway IP by checking daemon_networks
                        gateway_daemon = host["gateway_daemon"]
                        daemon_nets = self.db.get_daemon_networks(gateway_daemon)

                        for dn in daemon_nets:
                            # Check if gateway IP is in this network's subnet
                            if dn.get("ipv4_address") == gateway_ip:
                                # This is the gateway network, connect host to it
                                gateway_network_obj = self.client.networks.get(dn["name"])
                                gateway_network_obj.connect(container)  # Let Docker assign IP from the subnet
                                logger.info(f"Connected host '{host['name']}' to gateway network '{dn['name']}'")
                                break
                    except Exception as e:
                        logger.warning(f"Failed to connect host '{host['name']}' to gateway network: {e}")
                        # Don't fail the whole creation, but log it

                    # Start container
                    container.start()
                    results["hosts_created"].append(host["name"])
                    logger.info(f"Created host: {host['name']}")

                except Exception as e:
                    logger.error(f"Failed to create host '{host['name']}': {e}")
                    results["errors"].append({"type": "host", "name": host["name"], "error": str(e)})

            # Step 4.5: Call reset_networking on all hosts to ensure full network config
            # This connects to mgmt_network and configures networking per topology spec
            for host in hosts:
                try:
                    self.host_manager.reset_networking(host["name"])
                    logger.info(f"Reset networking for host: {host['name']}")
                except Exception as e:
                    logger.warning(f"Failed to reset networking for host '{host['name']}': {e}")
                    results["errors"].append({
                        "type": "host_reset_networking",
                        "host": host["name"],
                        "error": str(e)
                    })

            # Step 5: Start all daemons (they need to be running before configuring BGP)
            for daemon in daemons:
                try:
                    container = self.client.containers.get(daemon["name"])
                    # Check if it's running
                    container.reload()
                    if container.status != 'running':
                        container.start()
                        logger.info(f"Started daemon: {daemon['name']}")

                    # Wait a moment for daemon API to be ready
                    import time
                    time.sleep(2)
                except Exception as e:
                    logger.warning(f"Failed to ensure daemon '{daemon['name']}' is running: {e}")

            # Step 5.5: Call reset_networking on all daemons to ensure full network config
            # This connects to mgmt_network and configures all networking per topology spec
            for daemon in daemons:
                try:
                    self.daemon_manager.reset_networking(daemon["name"])
                    logger.info(f"Reset networking for daemon: {daemon['name']}")
                except Exception as e:
                    logger.warning(f"Failed to reset networking for daemon '{daemon['name']}': {e}")
                    results["errors"].append({
                        "type": "daemon_reset_networking",
                        "daemon": daemon["name"],
                        "error": str(e)
                    })

            # Step 6: Configure BGP peers on running daemons via unified daemon API
            import requests
            for daemon in daemons:
                try:
                    peers = self.db.get_daemon_peers(daemon["name"])
                    for peer in peers:
                        try:
                            # Deploy peer via daemon's unified API
                            api_url = f"http://{daemon['name']}:5000/neighbor/{peer['peer_ip']}"
                            payload = {
                                "remote_asn": peer["peer_asn"],
                                "local_asn": peer["local_asn"]
                            }

                            response = requests.post(api_url, json=payload, timeout=10)

                            if response.status_code in [200, 201, 409]:
                                # Success or already exists
                                results["bgp_peers_configured"].append({
                                    "daemon": daemon["name"],
                                    "peer_ip": peer["peer_ip"],
                                    "peer_asn": peer["peer_asn"]
                                })
                                logger.info(f"BGP peer {peer['peer_ip']} (AS{peer['peer_asn']}) deployed on {daemon['name']}")
                            else:
                                error_msg = f"HTTP {response.status_code}: {response.text}"
                                logger.error(f"Failed to deploy BGP peer {peer['peer_ip']} on {daemon['name']}: {error_msg}")
                                results["errors"].append({
                                    "type": "bgp_peer",
                                    "daemon": daemon["name"],
                                    "peer_ip": peer["peer_ip"],
                                    "error": error_msg
                                })
                        except requests.exceptions.RequestException as e:
                            logger.error(f"Failed to deploy BGP peer {peer['peer_ip']} on {daemon['name']}: {e}")
                            results["errors"].append({
                                "type": "bgp_peer",
                                "daemon": daemon["name"],
                                "peer_ip": peer["peer_ip"],
                                "error": str(e)
                            })
                except Exception as e:
                    logger.debug(f"Could not get peers for daemon '{daemon['name']}': {e}")

            # Step 7: Deploy route advertisements to running daemons via unified daemon API
            from ..repositories.topology_config_repository import TopologyConfigRepository
            config_repo = TopologyConfigRepository(self.db.db_path)
            route_advertisements = config_repo.get_route_advertisements(topology_name)

            for ad in route_advertisements:
                try:
                    daemon_name = ad["target_daemon"]
                    prefix = ad["prefix"]
                    cidr = ad["cidr"]
                    route = f"{prefix}/{cidr}"

                    # Deploy route via daemon's unified API
                    api_url = f"http://{daemon_name}:5000/route/{route}"
                    payload = {}

                    # Add optional attributes
                    if ad.get("next_hop"):
                        payload["next_hop"] = ad["next_hop"]
                    if ad.get("communities"):
                        payload["communities"] = ad["communities"]
                    if ad.get("med") is not None:
                        payload["med"] = ad["med"]
                    if ad.get("as_path"):
                        payload["as_path"] = ad["as_path"]

                    response = requests.post(api_url, json=payload, timeout=10)

                    if response.status_code in [200, 201, 409]:
                        # Success or already exists
                        results["routes_advertised"].append({
                            "daemon": daemon_name,
                            "route": route
                        })
                        logger.info(f"Route {route} advertised on {daemon_name}")
                    else:
                        error_msg = f"HTTP {response.status_code}: {response.text}"
                        logger.error(f"Failed to advertise route {route} on {daemon_name}: {error_msg}")
                        results["errors"].append({
                            "type": "route_advertisement",
                            "daemon": daemon_name,
                            "route": route,
                            "error": error_msg
                        })
                except requests.exceptions.RequestException as e:
                    logger.error(f"Failed to advertise route {route} on {daemon_name}: {e}")
                    results["errors"].append({
                        "type": "route_advertisement",
                        "daemon": daemon_name,
                        "route": route,
                        "error": str(e)
                    })
                except Exception as e:
                    logger.error(f"Error processing route advertisement: {e}")
                    results["errors"].append({
                        "type": "route_advertisement",
                        "error": str(e)
                    })

            # Step 8: Auto-advertise host network prefixes from their gateway daemons
            # This ensures that networks where hosts are connected get advertised via BGP
            hosts = self.db.list_hosts(topology_name=topology_name)
            for host in hosts:
                try:
                    gateway_daemon = host["gateway_daemon"]

                    # Get the host's connected networks (from host_networks table)
                    host_networks = self.db.get_host_networks(host["name"])

                    for hn in host_networks:
                        network_name = hn["name"]
                        # Get the network's subnet
                        network = self.db.get_network(network_name)
                        if not network or not network.get("subnet"):
                            continue

                        subnet = network["subnet"]  # e.g., "10.0.1.0/24"
                        prefix, cidr = subnet.split("/")
                        route = subnet

                        # Advertise this network from the gateway daemon
                        api_url = f"http://{gateway_daemon}:5000/route/{route}"

                        try:
                            response = requests.post(api_url, json={}, timeout=10)

                            if response.status_code in [200, 201, 409]:
                                results["routes_advertised"].append({
                                    "daemon": gateway_daemon,
                                    "route": route,
                                    "auto": True,
                                    "reason": f"host_network:{host['name']}"
                                })
                                logger.info(f"Auto-advertised host network {route} from {gateway_daemon} for host {host['name']}")
                            else:
                                logger.warning(f"Failed to auto-advertise {route} from {gateway_daemon}: HTTP {response.status_code}")
                        except requests.exceptions.RequestException as e:
                            logger.warning(f"Failed to auto-advertise {route} from {gateway_daemon}: {e}")

                except Exception as e:
                    logger.warning(f"Error auto-advertising networks for host '{host['name']}': {e}")

            logger.info(f"[TopologyManager] Standup complete for '{topology_name}': "
                       f"{len(results['networks_created'])} networks, {len(results['daemons_created'])} daemons, "
                       f"{len(results['hosts_created'])} hosts created, {len(results['bgp_peers_configured'])} BGP peers configured, "
                       f"{len(results['routes_advertised'])} routes advertised, "
                       f"{len(results['errors'])} errors")

            return results

        except Exception as e:
            logger.error(f"[TopologyManager] Topology standup failed: {e}")
            raise HTTPException(status_code=500, detail=f"Topology standup failed: {str(e)}")

    def get_topology_details(self, topology_name: str) -> Dict:
        """
        Get comprehensive details about a specific topology including all its resources.
        This is used to preview a topology before activating it.
        """
        logger.info(f"[TopologyManager] Getting details for topology '{topology_name}'...")

        try:
            # Get topology info
            topology = self.db.get_topology(topology_name)
            if not topology:
                raise HTTPException(status_code=404, detail=f"Topology '{topology_name}' not found")

            # Get all networks in this topology
            networks = self.db.list_networks(topology_name=topology_name)

            # Get all daemons in this topology
            daemons_db = self.db.list_daemons(topology_name=topology_name)
            daemons = []
            for daemon in daemons_db:
                # Get networks for this daemon
                daemon_networks = self.db.get_daemon_networks(daemon["name"])

                # Build interface info from network associations
                interfaces = []
                for network in daemon_networks:
                    interfaces.append({
                        "name": network.get("interface_name", ""),  # Interface name like 'eth1', 'eth2'
                        "network": network["name"],
                        "ipv4": network.get("ipv4_address", ""),
                        "gateway": network.get("gateway", ""),
                        "mac": ""
                    })

                daemons.append({
                    "name": daemon["name"],
                    "type": daemon["daemon_type"],
                    "asn": daemon["asn"],
                    "router_id": daemon["router_id"],
                    "ip_address": daemon["ip_address"],
                    "networks": [n["name"] for n in daemon_networks],
                    "interfaces": interfaces,  # Add interfaces array
                    "map_x": daemon.get("map_x"),
                    "map_y": daemon.get("map_y"),
                    "color": daemon.get("color")
                })

            # Get all hosts in this topology
            hosts_db = self.db.list_hosts(topology_name=topology_name)
            hosts = []
            for host in hosts_db:
                # Get networks for this host
                host_networks = self.db.get_host_networks(host["name"])

                # Build interface info from actual network associations
                interfaces = []
                for network in host_networks:
                    interfaces.append({
                        "name": network.get("interface_name", ""),  # Interface name like 'eth0', 'eth1'
                        "network": network["name"],
                        "ipv4": network.get("ipv4_address", ""),
                        "gateway": network.get("gateway", ""),
                        "mac": ""
                    })

                hosts.append({
                    "name": host["name"],
                    "gateway_daemon": host["gateway_daemon"],
                    "gateway_ip": host["gateway_ip"],
                    "loopback_ip": host["loopback_ip"],
                    "loopback_network": host.get("loopback_network", "24"),
                    "interfaces": interfaces,
                    "map_x": host.get("map_x"),
                    "map_y": host.get("map_y"),
                    "color": host.get("color")
                })

            # Get BGP peers for daemons
            bgp_peers = []
            for daemon in daemons_db:
                peers = self.db.get_daemon_peers(daemon["name"])
                for peer in peers:
                    bgp_peers.append({
                        "local_daemon": daemon["name"],
                        "local_asn": peer.get("local_asn"),
                        "local_ip": peer.get("local_ip"),
                        "peer_ip": peer["peer_ip"],
                        "peer_asn": peer["peer_asn"],
                        "peer_router_id": peer.get("peer_router_id"),
                        "address_families": peer.get("address_families"),
                        "auth_key": peer.get("auth_key"),
                        "description": peer.get("description")
                    })

            # Get external nodes (needed for BGP peer fetching)
            external_nodes_db = self.db.list_external_nodes(topology_name=topology_name)

            # Get BGP peers for external nodes
            for ext_node in external_nodes_db:
                peers = self.db.get_daemon_peers(ext_node["name"])
                for peer in peers:
                    bgp_peers.append({
                        "local_daemon": ext_node["name"],
                        "local_asn": peer.get("local_asn"),
                        "local_ip": peer.get("local_ip"),
                        "peer_ip": peer["peer_ip"],
                        "peer_asn": peer["peer_asn"],
                        "peer_router_id": peer.get("peer_router_id"),
                        "address_families": peer.get("address_families"),
                        "auth_key": peer.get("auth_key"),
                        "description": peer.get("description")
                    })

            # Get BGP routes
            bgp_routes = []
            for daemon in daemons_db:
                routes = self.db.get_daemon_routes(daemon["name"])
                for route in routes:
                    bgp_routes.append({
                        "local_daemon": daemon["name"],
                        "prefix": route["prefix"],
                        "next_hop": route.get("next_hop")
                    })

            # Format external nodes for response (already fetched above for BGP peers)
            external_nodes = []
            for node in external_nodes_db:
                external_nodes.append({
                    "name": node["name"],
                    "x": node.get("map_x"),
                    "y": node.get("map_y"),
                    "color": node.get("color")
                })

            # Get BGP sessions (new model)
            bgp_sessions = self.db.list_bgp_sessions(topology_name=topology_name)

            # Get GRE links (new model)
            gre_links = self.db.list_gre_links(topology_name=topology_name)

            # Get legacy GRE tunnels (for backward compatibility during migration)
            gre_tunnels = self.db.list_gre_tunnels(topology_name=topology_name)

            # Get topology taps
            taps = self.db.list_topology_taps(topology_name=topology_name)

            # Get triggers using the config repository
            from ..repositories.topology_config_repository import TopologyConfigRepository
            config_repo = TopologyConfigRepository(self.db.db_path)
            triggers = config_repo.get_triggers(topology_name)

            # Get unified nodes (new model - combines daemons, hosts, external nodes)
            nodes_db = self.db.list_nodes(topology_name=topology_name)
            nodes = []
            for node in nodes_db:
                # Get networks for this node
                node_networks = self.db.get_node_networks(node["name"], topology_name=topology_name)

                # Build interface info from network associations
                interfaces = []
                for network in node_networks:
                    interfaces.append({
                        "name": network.get("interface_name", ""),
                        "network": network["name"],
                        "ipv4": network.get("ipv4_address", ""),
                        "gateway": network.get("gateway", ""),
                        "mac": ""
                    })

                nodes.append({
                    "name": node["name"],
                    "node_type": node["node_type"],
                    "status": node.get("status"),
                    "map_x": node.get("map_x"),
                    "map_y": node.get("map_y"),
                    "color": node.get("color"),
                    # Daemon-specific fields
                    "daemon_type": node.get("daemon_type"),
                    "asn": node.get("asn"),
                    "router_id": node.get("router_id"),
                    "ip_address": node.get("ip_address"),
                    "api_port": node.get("api_port"),
                    "location": node.get("location"),
                    "docker_image": node.get("docker_image"),
                    # Host-specific fields
                    "gateway_node": node.get("gateway_node"),
                    "gateway_ip": node.get("gateway_ip"),
                    "container_ip": node.get("container_ip"),
                    "loopback_ip": node.get("loopback_ip"),
                    "loopback_network": node.get("loopback_network"),
                    # Networks/interfaces
                    "networks": [n["name"] for n in node_networks],
                    "interfaces": interfaces
                })

            # Add external nodes to the unified nodes array
            for ext_node in external_nodes_db:
                nodes.append({
                    "name": ext_node["name"],
                    "node_type": "external",
                    "status": None,
                    "map_x": ext_node.get("map_x"),
                    "map_y": ext_node.get("map_y"),
                    "color": ext_node.get("color"),
                    "interfaces": []
                })

            details = {
                "topology": topology,
                "networks": networks,
                "nodes": nodes,  # New unified model
                "daemons": daemons,  # Legacy - kept for backward compatibility
                "hosts": hosts,  # Legacy - kept for backward compatibility
                "bgp_sessions": bgp_sessions,  # New model
                "bgp_peers": bgp_peers,  # Legacy - kept for backward compatibility
                "bgp_routes": bgp_routes,
                "external_nodes": external_nodes,  # Legacy - kept for backward compatibility
                "gre_links": gre_links,  # New model
                "gre_tunnels": gre_tunnels,  # Legacy - kept for backward compatibility
                "taps": taps,
                "triggers": triggers
            }

            return details

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[TopologyManager] Failed to get topology details: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to get topology details: {str(e)}")

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
            logger.error(f"[TopologyManager] Failed to get available port: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to get available port: {str(e)}")
