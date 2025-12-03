"""
Lab Management Routes
Handles lab restore, sync, BGP peer, and topology operations
"""
from fastapi import APIRouter, HTTPException, Body
from typing import Optional
from pydantic import BaseModel
import logging
import docker


class BGPPeerCreate(BaseModel):
    local_daemon: str
    peer_ip: str
    peer_asn: int
    local_asn: Optional[int] = None
    local_ip: Optional[str] = None
    peer_router_id: Optional[str] = None
    address_families: Optional[str] = None
    auth_key: Optional[str] = None
    description: Optional[str] = None


class GRETunnelCreate(BaseModel):
    container_a: str
    container_b: str
    tunnel_name_a: str
    tunnel_name_b: str
    local_ip_a: str  # Source IP for container A's tunnel
    local_ip_b: str  # Source IP for container B's tunnel
    tunnel_ip_a: str  # Tunnel interface IP for container A
    tunnel_ip_b: str  # Tunnel interface IP for container B
    tunnel_network: Optional[str] = "30"
    gre_key: Optional[int] = None
    ttl: Optional[int] = 64
    topology_name: Optional[str] = "default"


router = APIRouter(prefix="/lab", tags=["lab"])
logger = logging.getLogger(__name__)


def setup_lab_routes(app, container_manager):
    """Setup lab routes with container_manager dependency"""

    @router.post("/restore")
    def restore_lab():
        """Restore the entire lab infrastructure from database"""
        return container_manager.restore_lab_from_db()

    @router.post("/restore/daemon/{daemon_name}")
    def restore_daemon(daemon_name: str, topology_name: str = "default"):
        """
        Restore/start a daemon using the idempotent start_daemon method.
        If container exists, syncs it to topology data.
        If container doesn't exist, creates it from database.
        """
        try:
            # Use the idempotent start_daemon method from DaemonManager
            result = container_manager.start_daemon(daemon_name)
            return result
        except Exception as e:
            logger.error(f"Failed to restore daemon: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to restore daemon: {str(e)}")

    @router.post("/restore/host/{host_name}")
    def restore_host(host_name: str, topology_name: str = "default"):
        """
        Restore/start a host using the idempotent start_host method.
        If container exists, syncs it to topology data.
        If container doesn't exist, creates it from database.
        """
        try:
            # Use the idempotent start_host method from HostManager
            result = container_manager.start_host(host_name)
            return result
        except Exception as e:
            logger.error(f"Failed to restore host: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to restore host: {str(e)}")

    @router.post("/restore/network/{network_name}")
    def restore_network(network_name: str, topology_name: str = "default"):
        """
        Restore a network by ensuring it exists with the proper configuration.
        This is idempotent - if the network already exists with correct config, no action is taken.
        """
        try:
            # Get network info from database
            network_info = container_manager.db.get_network(network_name)
            if not network_info:
                raise HTTPException(status_code=404, detail=f"Network '{network_name}' not found in database")

            results = {
                "network": network_name,
                "status": "success",
                "action": None
            }

            # Check if network already exists
            try:
                existing = container_manager.client.networks.get(network_name)
                logger.info(f"Found existing network '{network_name}'")

                # Verify configuration matches
                ipam_config = existing.attrs.get('IPAM', {}).get('Config', [])
                if ipam_config and len(ipam_config) > 0:
                    existing_subnet = ipam_config[0].get('Subnet')
                    existing_gateway = ipam_config[0].get('Gateway')

                    if existing_subnet == network_info['subnet'] and existing_gateway == network_info['gateway']:
                        logger.info(f"Network '{network_name}' already exists with correct configuration")
                        results["action"] = "exists"
                        return results
                    else:
                        # Configuration mismatch - warn but don't fail
                        logger.warning(f"Network '{network_name}' exists with different config (subnet: {existing_subnet} vs {network_info['subnet']}, gateway: {existing_gateway} vs {network_info['gateway']})")
                        results["action"] = "config_mismatch"
                        results["warning"] = f"Network exists with different configuration. Cannot modify while containers are connected."
                        return results

                # Network exists but has no IPAM config - treat as exists
                results["action"] = "exists"
                return results

            except docker.errors.NotFound:
                logger.info(f"Network '{network_name}' does not exist, creating it...")

            # Create the network from database info
            driver = network_info.get('driver', 'bridge')
            parent_interface = network_info.get('parent_interface')
            logger.info(f"Creating network '{network_name}' with subnet={network_info['subnet']}, gateway={network_info['gateway']}, driver={driver}")

            ipam_pool = docker.types.IPAMPool(
                subnet=network_info['subnet'],
                gateway=network_info['gateway']
            )
            ipam_config = docker.types.IPAMConfig(pool_configs=[ipam_pool])

            # Build driver options for macvlan/ipvlan
            driver_opts = {}
            if driver in ['macvlan', 'ipvlan'] and parent_interface:
                driver_opts['parent'] = parent_interface
                logger.info(f"Using {driver} driver with parent interface '{parent_interface}'")

            container_manager.client.networks.create(
                name=network_name,
                driver=driver,
                ipam=ipam_config,
                labels={
                    "netstream.topology": network_info.get("topology_name", topology_name)
                },
                options=driver_opts if driver_opts else None
            )

            logger.info(f"Successfully created network '{network_name}'")
            results["action"] = "created"
            return results

        except Exception as e:
            logger.error(f"Failed to restore network: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to restore network: {str(e)}")

    @router.get("/topology")
    def get_lab_topology():
        """Get complete lab topology for visualization"""
        return container_manager.get_lab_topology()

    @router.post("/sync-daemons")
    def sync_daemons_to_db():
        """Sync existing Docker daemon containers to the database"""
        return container_manager.sync_daemons_to_db()

    @router.post("/sync-hosts")
    def sync_hosts_to_db():
        """Sync existing Docker host containers to the database"""
        return container_manager.sync_hosts_to_db()

    @router.post("/sync-networks")
    def sync_networks_to_db(topology_name: str = "default"):
        """Sync Docker networks used by daemons and hosts to the database"""
        return container_manager.sync_networks_to_db(topology_name=topology_name)

    # BGP Peer Endpoints
    @app.post("/lab/bgp-peers")
    def add_bgp_peer(peer: BGPPeerCreate = Body(...)):
        """Add a BGP peer configuration to the database and configure it on the daemon"""
        return container_manager.add_bgp_peer_to_topology(
            local_daemon=peer.local_daemon,
            peer_ip=peer.peer_ip,
            peer_asn=peer.peer_asn,
            peer_router_id=peer.peer_router_id
        )

    @app.get("/bgp/peers/{daemon_name}")
    def get_daemon_bgp_peers(daemon_name: str):
        """Get all BGP peers for a daemon from the database"""
        peers = container_manager.db.get_daemon_peers(daemon_name)
        return {"daemon": daemon_name, "peers": peers, "count": len(peers)}

    @app.post("/bgp/peers")
    def save_bgp_peer(peer: BGPPeerCreate = Body(...)):
        """Save a BGP peer configuration to the database (without configuring on daemon)"""
        container_manager.db.create_bgp_peer(
            local_daemon=peer.local_daemon,
            peer_ip=peer.peer_ip,
            peer_asn=peer.peer_asn,
            local_asn=peer.local_asn,
            local_ip=peer.local_ip,
            peer_router_id=peer.peer_router_id,
            address_families=peer.address_families,
            auth_key=peer.auth_key,
            description=peer.description
        )
        return {"message": "BGP peer saved", "local_daemon": peer.local_daemon, "peer_ip": peer.peer_ip}

    @app.post("/bgp/peers/deploy")
    def deploy_bgp_peer(peer: BGPPeerCreate = Body(...)):
        """
        Save and deploy a BGP peer configuration.
        This saves to the database AND configures the peer on the daemon via container API.
        """
        # Step 1: Save to database
        container_manager.db.create_bgp_peer(
            local_daemon=peer.local_daemon,
            peer_ip=peer.peer_ip,
            peer_asn=peer.peer_asn,
            local_asn=peer.local_asn,
            local_ip=peer.local_ip,
            peer_router_id=peer.peer_router_id,
            address_families=peer.address_families,
            auth_key=peer.auth_key,
            description=peer.description
        )

        # Step 2: Get daemon info for ASN
        daemon_info = container_manager.db.get_daemon(peer.local_daemon)
        if not daemon_info:
            raise HTTPException(status_code=404, detail=f"Daemon '{peer.local_daemon}' not found")

        # Step 3: Deploy to daemon container via its API
        try:
            daemon_container = container_manager.docker_client.containers.get(peer.local_daemon)

            # Use container manager's exec to call daemon API
            configure_cmd = f"""python3 -c "
import requests
import json
try:
    response = requests.post(
        'http://localhost:5000/neighbor/{peer.peer_ip}',
        json={{'remote_asn': {peer.peer_asn}, 'local_asn': {peer.local_asn}}},
        timeout=5
    )
    print(f'Status: {{response.status_code}}')
    print(f'Response: {{response.text}}')
    exit(0 if response.status_code in [200, 201, 409] else 1)
except Exception as e:
    print(f'Error: {{e}}')
    exit(1)
"
"""
            result = daemon_container.exec_run(
                ["sh", "-c", configure_cmd],
                demux=True
            )

            stdout = result.output[0].decode('utf-8') if result.output[0] else ""
            stderr = result.output[1].decode('utf-8') if result.output[1] else ""

            if result.exit_code == 0:
                logger.info(f"Successfully configured BGP peer {peer.peer_ip} on daemon '{peer.local_daemon}'")
                return {
                    "message": "BGP peer saved and deployed",
                    "local_daemon": peer.local_daemon,
                    "peer_ip": peer.peer_ip,
                    "deployment": {
                        "status": "success",
                        "output": stdout
                    }
                }
            else:
                logger.error(f"Failed to configure BGP peer {peer.peer_ip} on daemon '{peer.local_daemon}': {stderr}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to configure BGP peer: {stderr}"
                )

        except docker.errors.NotFound:
            raise HTTPException(
                status_code=404,
                detail=f"Daemon container '{peer.local_daemon}' not found"
            )
        except Exception as e:
            logger.error(f"Failed to deploy BGP peer: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to deploy BGP peer: {str(e)}"
            )

    # GRE Tunnel Endpoints
    @app.post("/lab/gre-tunnels")
    def create_gre_tunnel_topology(tunnel: GRETunnelCreate = Body(...)):
        """
        Create a bidirectional GRE tunnel between two containers in the topology.
        Saves configuration to database AND configures tunnels on both containers.
        """
        try:
            # Create tunnel on container A
            container_manager.create_gre_tunnel(
                container_name=tunnel.container_a,
                tunnel_name=tunnel.tunnel_name_a,
                local_ip=tunnel.local_ip_a,
                remote_ip=tunnel.local_ip_b,
                tunnel_ip=tunnel.tunnel_ip_a,
                tunnel_network=tunnel.tunnel_network,
                gre_key=tunnel.gre_key,
                ttl=tunnel.ttl,
                topology_name=tunnel.topology_name
            )

            # Create tunnel on container B
            container_manager.create_gre_tunnel(
                container_name=tunnel.container_b,
                tunnel_name=tunnel.tunnel_name_b,
                local_ip=tunnel.local_ip_b,
                remote_ip=tunnel.local_ip_a,
                tunnel_ip=tunnel.tunnel_ip_b,
                tunnel_network=tunnel.tunnel_network,
                gre_key=tunnel.gre_key,
                ttl=tunnel.ttl,
                topology_name=tunnel.topology_name
            )

            return {
                "message": "GRE tunnels created successfully",
                "container_a": tunnel.container_a,
                "container_b": tunnel.container_b,
                "tunnel_a": tunnel.tunnel_name_a,
                "tunnel_b": tunnel.tunnel_name_b
            }
        except Exception as e:
            logger.error(f"Failed to create GRE tunnels: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to create GRE tunnels: {str(e)}")

    @app.get("/bgp/routes/{daemon_name}")
    def get_daemon_bgp_routes(daemon_name: str):
        """Get all BGP routes for a daemon from the database"""
        routes = container_manager.db.get_daemon_routes(daemon_name)
        return {"daemon": daemon_name, "routes": routes, "count": len(routes)}

    @app.post("/bgp/routes")
    def save_bgp_route(local_daemon: str, prefix: str, next_hop: str = None,
                       origin: str = "incomplete", local_pref: int = None,
                       med: int = None, communities: str = None):
        """Save a BGP route configuration to the database (without advertising on daemon)"""
        container_manager.db.create_bgp_route(
            local_daemon=local_daemon,
            prefix=prefix,
            next_hop=next_hop,
            origin=origin,
            local_pref=local_pref,
            med=med,
            communities=communities
        )
        return {"message": "BGP route saved", "local_daemon": local_daemon, "prefix": prefix}

    @app.post("/gre/tunnels")
    def save_gre_tunnel(
        container_name: str,
        tunnel_name: str,
        local_ip: str,
        remote_ip: str,
        tunnel_ip: str,
        tunnel_network: str = "30",
        gre_key: Optional[int] = None,
        ttl: int = 64,
        topology_name: Optional[str] = None
    ):
        """Save a GRE tunnel configuration to the database (without creating on container)"""
        # Auto-detect topology if not provided
        if not topology_name:
            active_topology = container_manager.db.get_active_topology()
            topology_name = active_topology.get("name") if active_topology else "default"

        container_manager.db.create_gre_tunnel(
            container_name=container_name,
            tunnel_name=tunnel_name,
            local_ip=local_ip,
            remote_ip=remote_ip,
            tunnel_ip=tunnel_ip,
            tunnel_network=tunnel_network,
            gre_key=gre_key,
            ttl=ttl,
            topology_name=topology_name
        )
        return {
            "message": "GRE tunnel saved",
            "container_name": container_name,
            "tunnel_name": tunnel_name,
            "topology_name": topology_name
        }

    @app.post("/topology/sync")
    def sync_topology(topology_name: str = "default", dry_run: bool = False):
        """
        Synchronize container state to match database state.
        This ensures all networks, connections, and tunnels defined in the DB exist in Docker.

        Args:
            topology_name: Name of the topology to sync (default: "default")
            dry_run: If True, only report what would be changed without making changes

        Returns:
            Sync results with list of actions taken
        """
        return container_manager.sync_topology_state(topology_name=topology_name, dry_run=dry_run)

    return router
