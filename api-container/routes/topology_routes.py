"""
Topology Management Routes
Handles topology CRUD and modification operations
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from ..models import CreateHostRequest
from ..repositories.topology_config_repository import TopologyConfigRepository


router = APIRouter(prefix="/topologies", tags=["topologies"])


# Request models for topology configurations
class RouteAdvertisementRequest(BaseModel):
    target_daemon: str
    prefix: str
    cidr: str
    next_hop: Optional[str] = None
    communities: Optional[str] = None
    med: Optional[int] = None
    as_path: Optional[str] = None


class TriggerRequest(BaseModel):
    name: str
    enabled: bool = True
    min_kbps: Optional[str] = None
    min_mbps: Optional[str] = None
    min_pps: Optional[str] = None
    min_bytes: Optional[str] = None
    src_addr: Optional[str] = None
    dst_addr: Optional[str] = None
    src_or_dst_addr: Optional[str] = None
    protocol: Optional[str] = None
    action_type: str = "log"
    action_message: Optional[str] = None
    rate_limit_kbps: Optional[str] = None


def setup_topology_routes(app, container_manager):
    """Setup topology routes with container_manager dependency"""

    @router.get("")
    def list_topologies():
        """List all saved topologies"""
        topologies = container_manager.db.list_topologies()
        return {"topologies": topologies}

    @router.post("/{name}")
    def create_topology(name: str, description: str = None, management_network: str = None):
        """Create a new topology with optional management network"""
        container_manager.db.create_topology(name, description, management_network=management_network)
        return {"message": f"Topology '{name}' created", "name": name, "management_network": management_network}

    @router.patch("/{name}")
    def update_topology(name: str, description: str = None, management_network: str = None):
        """Update an existing topology's configuration"""
        # Get existing topology
        existing = container_manager.db.get_topology(name)
        if not existing:
            raise HTTPException(status_code=404, detail=f"Topology '{name}' not found")

        # Update with new values or keep existing
        container_manager.db.create_topology(
            name,
            description if description is not None else existing.get('description'),
            active=existing.get('active', False),
            management_network=management_network if management_network is not None else existing.get('management_network')
        )
        return {"message": f"Topology '{name}' updated", "name": name}

    @router.delete("/{name}")
    def delete_topology(name: str):
        """Delete a topology and all its resources"""
        container_manager.db.delete_topology(name)
        return {"message": f"Topology '{name}' deleted"}

    @router.post("/{name}/activate")
    def activate_topology(name: str):
        """
        Activate a topology by:
        1. Tearing down the currently active topology (if any)
        2. Standing up the selected topology
        3. Setting it as active in the database
        """
        # Get currently active topology
        current_topology = container_manager.db.get_active_topology()

        # Teardown current topology if it exists and is different from the one we're activating
        teardown_results = None
        if current_topology and current_topology["name"] != name:
            teardown_results = container_manager.teardown_topology(current_topology["name"])

        # Standup the new topology
        standup_results = container_manager.standup_topology(name)

        # Set as active in database
        container_manager.db.set_active_topology(name)

        return {
            "message": f"Topology '{name}' activated",
            "name": name,
            "teardown": teardown_results,
            "standup": standup_results
        }

    @router.post("/{name}/stop")
    def stop_topology(name: str):
        """
        Stop a topology by stopping all its containers but keeping them in the topology.
        This is useful when you want to pause the lab without losing your configuration.
        Use /activate to restart the topology.
        """
        stop_results = container_manager.stop_topology(name)

        return {
            "message": f"Topology '{name}' stopped",
            "name": name,
            "stop": stop_results
        }

    @router.post("/{name}/reset")
    def reset_topology(name: str):
        """
        Reset a topology by:
        1. Tearing down the topology completely
        2. Re-standing it up from the database

        This is useful when you've made changes to the topology definition
        in the database and want to apply them to the running deployment.
        """
        # Teardown the topology
        teardown_results = container_manager.teardown_topology(name)

        # Standup the topology from database
        standup_results = container_manager.standup_topology(name)

        # Ensure it's marked as active in database
        container_manager.db.set_active_topology(name)

        return {
            "message": f"Topology '{name}' reset successfully",
            "name": name,
            "teardown": teardown_results,
            "standup": standup_results
        }

    @router.get("/active")
    def get_active_topology():
        """Get the currently active topology"""
        topology = container_manager.db.get_active_topology()
        if not topology:
            return {"active": None, "message": "No active topology"}
        return {"active": topology}

    @router.get("/{name}/details")
    def get_topology_details(name: str):
        """Get comprehensive details about a specific topology"""
        return container_manager.get_topology_details(name)

    # ==============================================================================
    # Topology Modification Endpoints
    # ==============================================================================

    @router.post("/{topology_name}/networks")
    def add_network_to_topology(
        topology_name: str,
        name: str = Query(..., description="Network name"),
        subnet: str = Query(..., description="Network subnet (e.g., 192.168.1.0/24)"),
        gateway: str = Query(..., description="Network gateway IP"),
        driver: str = Query(default="bridge", description="Network driver type")
    ):
        """Add a network to a topology"""
        container_manager.db.create_network(
            name=name,
            subnet=subnet,
            gateway=gateway,
            driver=driver,
            topology_name=topology_name
        )
        return {"message": f"Network '{name}' added to topology '{topology_name}'"}

    @router.delete("/{topology_name}/networks/{network_name}")
    def remove_network_from_topology(topology_name: str, network_name: str):
        """Remove a network from a topology"""
        container_manager.db.delete_network(network_name)
        return {"message": f"Network '{network_name}' removed from topology '{topology_name}'"}

    @router.get("/{topology_name}/daemons/{daemon_name}/networks")
    def get_daemon_networks(topology_name: str, daemon_name: str):
        """Get all networks associated with a daemon in the topology"""
        networks = container_manager.db.get_daemon_networks(daemon_name)
        return {"daemon": daemon_name, "networks": networks}

    @router.post("/{topology_name}/daemons/{daemon_name}/networks")
    def add_daemon_to_network(
        topology_name: str,
        daemon_name: str,
        network_name: str = Query(..., description="Network to connect to"),
        ipv4: str = Query(..., description="IPv4 address for the daemon"),
        gateway: str = Query(..., description="Gateway IP for the network")
    ):
        """Connect a daemon to a network in the topology"""
        container_manager.db.add_daemon_network(
            daemon_name=daemon_name,
            network_name=network_name,
            ipv4_address=ipv4,
            interface_name=None  # We can extend this later if needed
        )
        return {"message": f"Daemon '{daemon_name}' connected to network '{network_name}'"}

    @router.delete("/{topology_name}/daemons/{daemon_name}/networks/{network_name}")
    def remove_daemon_from_network(topology_name: str, daemon_name: str, network_name: str):
        """Disconnect a daemon from a network"""
        container_manager.db.remove_daemon_network(daemon_name, network_name)
        return {"message": f"Daemon '{daemon_name}' disconnected from network '{network_name}'"}

    @router.post("/{topology_name}/hosts/{host_name}/networks")
    def add_host_to_network(
        topology_name: str,
        host_name: str,
        network_name: str = Query(..., description="Network to connect to"),
        ipv4: str = Query(..., description="IPv4 address for the host"),
        gateway: str = Query(..., description="Gateway IP for the network")
    ):
        """Connect a host to a network in the topology"""
        container_manager.db.add_host_network(
            host_name=host_name,
            network_name=network_name,
            ipv4_address=ipv4,
            interface_name=None  # We can extend this later if needed
        )
        return {"message": f"Host '{host_name}' connected to network '{network_name}'"}

    @router.delete("/{topology_name}/hosts/{host_name}/networks/{network_name}")
    def remove_host_from_network(topology_name: str, host_name: str, network_name: str):
        """Disconnect a host from a network"""
        container_manager.db.remove_host_network(host_name, network_name)
        return {"message": f"Host '{host_name}' disconnected from network '{network_name}'"}

    @router.post("/{topology_name}/hosts")
    def create_topology_host(topology_name: str, req: CreateHostRequest):
        """
        Create a host in the topology (database only, no Docker container).
        The actual container will be created when the topology is activated.
        """
        # Parse container_ip to remove CIDR notation for database storage
        container_ip_clean = req.container_ip
        if container_ip_clean and '/' in container_ip_clean:
            container_ip_clean = container_ip_clean.split('/')[0]

        # Save host to database
        container_manager.db.create_host(
            name=req.name,
            gateway_daemon=req.gateway_daemon,
            gateway_ip=req.gateway_ip,
            container_ip=container_ip_clean,
            loopback_ip=req.loopback_ip,
            loopback_network=req.loopback_network,
            docker_id=None,  # No Docker container yet
            topology_name=topology_name
        )

        # Add network association to database
        container_manager.db.add_host_network(
            host_name=req.name,
            network_name=req.network,
            ipv4_address=container_ip_clean
        )

        return {
            "message": f"Host '{req.name}' added to topology '{topology_name}'",
            "name": req.name,
            "gateway_daemon": req.gateway_daemon,
            "gateway_ip": req.gateway_ip,
            "container_ip": container_ip_clean,
            "loopback_ip": req.loopback_ip,
            "loopback_network": req.loopback_network,
            "network": req.network
        }

    # Position update endpoints
    @router.patch("/{topology_name}/daemons/{daemon_name}/position")
    def update_daemon_position(
        topology_name: str,
        daemon_name: str,
        x: float = Query(..., description="X coordinate on map"),
        y: float = Query(..., description="Y coordinate on map")
    ):
        """Update daemon position on topology map"""
        container_manager.db.update_daemon_position(daemon_name, x, y)
        return {"message": f"Position updated for daemon '{daemon_name}'"}

    class UpdateDaemonPropertiesRequest(BaseModel):
        color: Optional[str] = None

    @router.put("/{topology_name}/daemons/{daemon_name}")
    def update_daemon_properties(
        topology_name: str,
        daemon_name: str,
        req: UpdateDaemonPropertiesRequest
    ):
        """Update daemon properties like color"""
        container_manager.db.update_daemon_properties(daemon_name, color=req.color)
        return {"message": f"Daemon '{daemon_name}' updated"}

    @router.patch("/{topology_name}/hosts/{host_name}/position")
    def update_host_position(
        topology_name: str,
        host_name: str,
        x: float = Query(..., description="X coordinate on map"),
        y: float = Query(..., description="Y coordinate on map")
    ):
        """Update host position on topology map"""
        container_manager.db.update_host_position(host_name, x, y)
        return {"message": f"Position updated for host '{host_name}'"}

    @router.patch("/{topology_name}/networks/{network_name}/position")
    def update_network_position(
        topology_name: str,
        network_name: str,
        x: float = Query(..., description="X coordinate on map"),
        y: float = Query(..., description="Y coordinate on map")
    ):
        """Update network position on topology map"""
        container_manager.db.update_network_position(network_name, x, y)
        return {"message": f"Position updated for network '{network_name}'"}

    # ==============================================================================
    # External Node Endpoints
    # ==============================================================================

    @router.post("/{topology_name}/external_nodes")
    def add_external_node_to_topology(
        topology_name: str,
        name: str = Query(..., description="External node name"),
        x: float = Query(None, description="X coordinate on map"),
        y: float = Query(None, description="Y coordinate on map")
    ):
        """Add an external node to a topology"""
        # Verify topology exists
        topology = container_manager.db.get_topology(topology_name)
        if not topology:
            raise HTTPException(status_code=404, detail=f"Topology '{topology_name}' not found")

        container_manager.db.create_external_node(
            name=name,
            topology_name=topology_name,
            x=x,
            y=y
        )
        return {"message": f"External node '{name}' added to topology '{topology_name}'"}

    @router.patch("/{topology_name}/external_nodes/{node_name}/position")
    def update_external_node_position(
        topology_name: str,
        node_name: str,
        x: float = Query(..., description="X coordinate on map"),
        y: float = Query(..., description="Y coordinate on map")
    ):
        """Update external node position on topology map"""
        container_manager.db.update_external_node_position(node_name, topology_name, x, y)
        return {"message": f"Position updated for external node '{node_name}'"}

    @router.delete("/{topology_name}/external_nodes/{node_name}")
    def remove_external_node_from_topology(topology_name: str, node_name: str):
        """Remove an external node from a topology"""
        container_manager.db.delete_external_node(node_name, topology_name)
        return {"message": f"External node '{node_name}' removed from topology '{topology_name}'"}

    # ==============================================================================
    # External Network Management Endpoints
    # ==============================================================================

    class CreateExternalNetworkRequest(BaseModel):
        name: str
        subnet: str
        gateway: str
        driver: str = "macvlan"  # macvlan or ipvlan for physical interface binding
        parent_interface: Optional[str] = None  # e.g., 'en0', 'eth0', 'dongle0'

    @router.post("/{topology_name}/external_networks")
    def add_external_network_to_topology(topology_name: str, req: CreateExternalNetworkRequest):
        """
        Add an external network to a topology.
        External networks use macvlan/ipvlan drivers to bind to physical interfaces.
        """
        # Verify topology exists
        topology = container_manager.db.get_topology(topology_name)
        if not topology:
            raise HTTPException(status_code=404, detail=f"Topology '{topology_name}' not found")

        # Validate driver
        if req.driver not in ['macvlan', 'ipvlan', 'bridge']:
            raise HTTPException(status_code=400, detail=f"Invalid driver '{req.driver}'. Must be 'macvlan', 'ipvlan', or 'bridge'")

        # For macvlan/ipvlan, parent_interface is required
        if req.driver in ['macvlan', 'ipvlan'] and not req.parent_interface:
            raise HTTPException(status_code=400, detail=f"parent_interface is required for {req.driver} driver")

        container_manager.db.create_network(
            name=req.name,
            subnet=req.subnet,
            gateway=req.gateway,
            driver=req.driver,
            topology_name=topology_name,
            external=True,
            parent_interface=req.parent_interface
        )
        return {
            "message": f"External network '{req.name}' added to topology '{topology_name}'",
            "network": {
                "name": req.name,
                "subnet": req.subnet,
                "gateway": req.gateway,
                "driver": req.driver,
                "parent_interface": req.parent_interface,
                "external": True
            }
        }

    # ==============================================================================
    # BGP Peer Management Endpoints
    # ==============================================================================

    class DeleteBGPPeerRequest(BaseModel):
        local_daemon: str
        peer_daemon: str

    @router.delete("/{topology_name}/bgp/peers")
    def delete_bgp_peer(topology_name: str, req: DeleteBGPPeerRequest):
        """Delete BGP peer configuration (both directions) from the database"""
        # Get peers for both sides to find the IPs
        local_peers = container_manager.db.get_daemon_peers(req.local_daemon)
        peer_daemon_peers = container_manager.db.get_daemon_peers(req.peer_daemon)

        deleted_count = 0

        # Find and delete: local_daemon -> peer_daemon
        for peer in local_peers:
            # Check if this peer points to peer_daemon by matching IPs
            for peer_daemon_record in peer_daemon_peers:
                if peer.get("peer_ip") == peer_daemon_record.get("local_ip"):
                    container_manager.db.delete_bgp_peer(req.local_daemon, peer.get("peer_ip"))
                    deleted_count += 1
                    break

        # Find and delete: peer_daemon -> local_daemon
        for peer in peer_daemon_peers:
            # Check if this peer points to local_daemon by matching IPs
            for local_record in local_peers:
                if peer.get("peer_ip") == local_record.get("local_ip"):
                    container_manager.db.delete_bgp_peer(req.peer_daemon, peer.get("peer_ip"))
                    deleted_count += 1
                    break

        if deleted_count == 0:
            raise HTTPException(status_code=404, detail=f"No BGP peer relationship found between '{req.local_daemon}' and '{req.peer_daemon}'")

        return {"message": f"BGP peer relationship deleted ({deleted_count} records)", "deleted_count": deleted_count}

    class DeleteSingleBGPPeerRequest(BaseModel):
        local_daemon: str
        peer_ip: str

    @router.delete("/{topology_name}/bgp/peer")
    def delete_single_bgp_peer(topology_name: str, req: DeleteSingleBGPPeerRequest):
        """Delete a single BGP peer configuration from the database"""
        # Get current peers to verify it exists
        peers = container_manager.db.get_daemon_peers(req.local_daemon)
        peer_exists = any(p.get("peer_ip") == req.peer_ip for p in peers)

        if not peer_exists:
            raise HTTPException(status_code=404, detail=f"BGP peer {req.peer_ip} not found for daemon '{req.local_daemon}'")

        container_manager.db.delete_bgp_peer(req.local_daemon, req.peer_ip)
        return {"message": f"BGP peer {req.peer_ip} deleted from {req.local_daemon}"}

    # ==============================================================================
    # BGP Session Management Endpoints (New Model)
    # ==============================================================================

    class CreateBGPSessionRequest(BaseModel):
        daemon1: str
        daemon1_ip: str
        daemon1_asn: Optional[int] = None
        daemon2: str
        daemon2_ip: str
        daemon2_asn: Optional[int] = None
        network: Optional[str] = None
        address_families: str = "ipv4-unicast"
        auth_key: Optional[str] = None
        description: Optional[str] = None

    @router.post("/{topology_name}/bgp/sessions")
    def create_bgp_session(topology_name: str, req: CreateBGPSessionRequest):
        """Create a BGP session between two daemons (new model - single record)"""
        # Verify topology exists
        topology = container_manager.db.get_topology(topology_name)
        if not topology:
            raise HTTPException(status_code=404, detail=f"Topology '{topology_name}' not found")

        session_id = container_manager.db.create_bgp_session(
            daemon1=req.daemon1,
            daemon1_ip=req.daemon1_ip,
            daemon1_asn=req.daemon1_asn,
            daemon2=req.daemon2,
            daemon2_ip=req.daemon2_ip,
            daemon2_asn=req.daemon2_asn,
            network=req.network,
            address_families=req.address_families,
            auth_key=req.auth_key,
            description=req.description,
            topology_name=topology_name
        )

        return {
            "message": f"BGP session created between {req.daemon1} and {req.daemon2}",
            "session_id": session_id,
            "daemon1": req.daemon1,
            "daemon1_ip": req.daemon1_ip,
            "daemon2": req.daemon2,
            "daemon2_ip": req.daemon2_ip
        }

    @router.get("/{topology_name}/bgp/sessions")
    def list_bgp_sessions(topology_name: str):
        """List all BGP sessions in a topology"""
        sessions = container_manager.db.list_bgp_sessions(topology_name=topology_name)
        return {
            "topology_name": topology_name,
            "count": len(sessions),
            "sessions": sessions
        }

    @router.delete("/{topology_name}/bgp/sessions/{session_id}")
    def delete_bgp_session_by_id(topology_name: str, session_id: int):
        """Delete a BGP session by ID"""
        session = container_manager.db.get_bgp_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail=f"BGP session {session_id} not found")
        if session.get("topology_name") != topology_name:
            raise HTTPException(status_code=400, detail=f"BGP session {session_id} does not belong to topology '{topology_name}'")

        container_manager.db.delete_bgp_session(session_id)
        return {"message": f"BGP session {session_id} deleted"}

    class DeleteBGPSessionByIPsRequest(BaseModel):
        daemon1_ip: str
        daemon2_ip: str

    @router.delete("/{topology_name}/bgp/sessions/by-ips")
    def delete_bgp_session_by_ips(topology_name: str, req: DeleteBGPSessionByIPsRequest):
        """Delete a BGP session by the IP addresses of both endpoints"""
        container_manager.db.delete_bgp_session_by_ips(
            daemon1_ip=req.daemon1_ip,
            daemon2_ip=req.daemon2_ip,
            topology_name=topology_name
        )
        return {"message": f"BGP session between {req.daemon1_ip} and {req.daemon2_ip} deleted"}

    class UpdateBGPSessionArcRequest(BaseModel):
        arc: float

    @router.patch("/{topology_name}/bgp/sessions/{session_id}/arc")
    def update_bgp_session_arc(topology_name: str, session_id: int, req: UpdateBGPSessionArcRequest):
        """Update the arc (line curvature) of a BGP session for topology visualization"""
        session = container_manager.db.get_bgp_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail=f"BGP session {session_id} not found")
        if session.get("topology_name") != topology_name:
            raise HTTPException(status_code=400, detail=f"BGP session {session_id} does not belong to topology '{topology_name}'")

        container_manager.db.update_bgp_session_arc(session_id, req.arc)
        return {
            "message": f"BGP session {session_id} arc updated to {req.arc}",
            "session_id": session_id,
            "arc": req.arc
        }

    # ==============================================================================
    # GRE Tunnel Management Endpoints
    # ==============================================================================

    class GRETunnelRequest(BaseModel):
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

    @router.post("/{topology_name}/gre-tunnels")
    def create_gre_tunnel(topology_name: str, req: GRETunnelRequest):
        """
        Create a bidirectional GRE tunnel between two containers in the topology.
        Saves configuration to database AND configures tunnels on both containers.
        """
        try:
            # Create tunnel on container A
            container_manager.create_gre_tunnel(
                container_name=req.container_a,
                tunnel_name=req.tunnel_name_a,
                local_ip=req.local_ip_a,
                remote_ip=req.local_ip_b,
                tunnel_ip=req.tunnel_ip_a,
                tunnel_network=req.tunnel_network,
                gre_key=req.gre_key,
                ttl=req.ttl,
                topology_name=topology_name
            )

            # Create tunnel on container B
            container_manager.create_gre_tunnel(
                container_name=req.container_b,
                tunnel_name=req.tunnel_name_b,
                local_ip=req.local_ip_b,
                remote_ip=req.local_ip_a,
                tunnel_ip=req.tunnel_ip_b,
                tunnel_network=req.tunnel_network,
                gre_key=req.gre_key,
                ttl=req.ttl,
                topology_name=topology_name
            )

            return {
                "message": "GRE tunnels created successfully",
                "container_a": req.container_a,
                "container_b": req.container_b,
                "tunnel_a": req.tunnel_name_a,
                "tunnel_b": req.tunnel_name_b
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to create GRE tunnels: {str(e)}")

    # ==============================================================================
    # GRE Link Management Endpoints (New Model)
    # ==============================================================================

    class CreateGRELinkRequest(BaseModel):
        container1: str
        container2: str
        network: str  # The network used for underlay connectivity
        tunnel_ip1: str  # Tunnel overlay IP for container1
        tunnel_ip2: str  # Tunnel overlay IP for container2
        tunnel_network: str = "30"
        gre_key: Optional[int] = None
        ttl: int = 64

    @router.post("/{topology_name}/gre/links")
    def create_gre_link(topology_name: str, req: CreateGRELinkRequest):
        """Create a GRE link between two containers (new model - single record)"""
        # Verify topology exists
        topology = container_manager.db.get_topology(topology_name)
        if not topology:
            raise HTTPException(status_code=404, detail=f"Topology '{topology_name}' not found")

        link_id = container_manager.db.create_gre_link(
            container1=req.container1,
            container2=req.container2,
            network=req.network,
            tunnel_ip1=req.tunnel_ip1,
            tunnel_ip2=req.tunnel_ip2,
            tunnel_network=req.tunnel_network,
            gre_key=req.gre_key,
            ttl=req.ttl,
            topology_name=topology_name
        )

        return {
            "message": f"GRE link created between {req.container1} and {req.container2}",
            "link_id": link_id,
            "container1": req.container1,
            "container2": req.container2,
            "tunnel_ip1": req.tunnel_ip1,
            "tunnel_ip2": req.tunnel_ip2
        }

    @router.get("/{topology_name}/gre/links")
    def list_gre_links(topology_name: str):
        """List all GRE links in a topology"""
        links = container_manager.db.list_gre_links(topology_name=topology_name)
        return {
            "topology_name": topology_name,
            "count": len(links),
            "links": links
        }

    @router.delete("/{topology_name}/gre/links/{link_id}")
    def delete_gre_link_by_id(topology_name: str, link_id: int):
        """Delete a GRE link by ID"""
        link = container_manager.db.get_gre_link(link_id)
        if not link:
            raise HTTPException(status_code=404, detail=f"GRE link {link_id} not found")
        if link.get("topology_name") != topology_name:
            raise HTTPException(status_code=400, detail=f"GRE link {link_id} does not belong to topology '{topology_name}'")

        container_manager.db.delete_gre_link(link_id)
        return {"message": f"GRE link {link_id} deleted"}

    class DeleteGRELinkByContainersRequest(BaseModel):
        container1: str
        container2: str

    @router.delete("/{topology_name}/gre/links/by-containers")
    def delete_gre_link_by_containers(topology_name: str, req: DeleteGRELinkByContainersRequest):
        """Delete a GRE link by the container names of both endpoints"""
        container_manager.db.delete_gre_link_by_containers(
            container1=req.container1,
            container2=req.container2,
            topology_name=topology_name
        )
        return {"message": f"GRE link between {req.container1} and {req.container2} deleted"}

    class UpdateGRELinkArcRequest(BaseModel):
        arc: float

    @router.patch("/{topology_name}/gre/links/{link_id}/arc")
    def update_gre_link_arc(topology_name: str, link_id: int, req: UpdateGRELinkArcRequest):
        """Update the arc (line curvature) of a GRE link for topology visualization"""
        link = container_manager.db.get_gre_link(link_id)
        if not link:
            raise HTTPException(status_code=404, detail=f"GRE link {link_id} not found")
        if link.get("topology_name") != topology_name:
            raise HTTPException(status_code=400, detail=f"GRE link {link_id} does not belong to topology '{topology_name}'")

        container_manager.db.update_gre_link_arc(link_id, req.arc)
        return {
            "message": f"GRE link {link_id} arc updated to {req.arc}",
            "link_id": link_id,
            "arc": req.arc
        }

    # ==============================================================================
    # IPsec Link Management Endpoints
    # ==============================================================================

    class CreateIPsecLinkRequest(BaseModel):
        container1: str
        container2: str
        network: str
        tunnel_ip1: str
        tunnel_ip2: str
        tunnel_network: str = "30"
        psk: Optional[str] = None
        ike_version: int = 2
        ike_cipher: str = "aes256-sha256-modp2048"
        esp_cipher: str = "aes256-sha256"
        dh_group: str = "modp2048"
        ike_lifetime: int = 86400
        sa_lifetime: int = 3600
        dpd_delay: int = 30
        dpd_timeout: int = 120

    @router.post("/{topology_name}/ipsec/links")
    def create_ipsec_link(topology_name: str, req: CreateIPsecLinkRequest):
        """Create an IPsec link between two containers (single record per tunnel)"""
        import secrets
        # Generate PSK if not provided
        psk = req.psk if req.psk else secrets.token_urlsafe(32)

        link_id = container_manager.db.create_ipsec_link(
            container1=req.container1,
            container2=req.container2,
            network=req.network,
            tunnel_ip1=req.tunnel_ip1,
            tunnel_ip2=req.tunnel_ip2,
            tunnel_network=req.tunnel_network,
            psk=psk,
            ike_version=req.ike_version,
            ike_cipher=req.ike_cipher,
            esp_cipher=req.esp_cipher,
            dh_group=req.dh_group,
            ike_lifetime=req.ike_lifetime,
            sa_lifetime=req.sa_lifetime,
            dpd_delay=req.dpd_delay,
            dpd_timeout=req.dpd_timeout,
            topology_name=topology_name
        )
        return {
            "message": f"IPsec link created between {req.container1} and {req.container2}",
            "link_id": link_id,
            "psk": psk,
            "topology_name": topology_name
        }

    @router.get("/{topology_name}/ipsec/links")
    def list_ipsec_links(topology_name: str):
        """List all IPsec links in a topology"""
        links = container_manager.db.list_ipsec_links(topology_name=topology_name)
        return {
            "topology_name": topology_name,
            "links": links,
            "count": len(links)
        }

    @router.get("/{topology_name}/ipsec/links/{link_id}")
    def get_ipsec_link(topology_name: str, link_id: int):
        """Get a specific IPsec link by ID"""
        link = container_manager.db.get_ipsec_link(link_id)
        if not link:
            raise HTTPException(status_code=404, detail=f"IPsec link {link_id} not found")
        if link.get("topology_name") != topology_name:
            raise HTTPException(status_code=400, detail=f"IPsec link {link_id} does not belong to topology '{topology_name}'")
        return link

    @router.delete("/{topology_name}/ipsec/links/{link_id}")
    def delete_ipsec_link_by_id(topology_name: str, link_id: int):
        """Delete an IPsec link by ID"""
        link = container_manager.db.get_ipsec_link(link_id)
        if not link:
            raise HTTPException(status_code=404, detail=f"IPsec link {link_id} not found")
        if link.get("topology_name") != topology_name:
            raise HTTPException(status_code=400, detail=f"IPsec link {link_id} does not belong to topology '{topology_name}'")

        container_manager.db.delete_ipsec_link(link_id)
        return {"message": f"IPsec link {link_id} deleted"}

    class DeleteIPsecLinkByContainersRequest(BaseModel):
        container1: str
        container2: str

    @router.delete("/{topology_name}/ipsec/links/by-containers")
    def delete_ipsec_link_by_containers(topology_name: str, req: DeleteIPsecLinkByContainersRequest):
        """Delete an IPsec link by the container names of both endpoints"""
        container_manager.db.delete_ipsec_link_by_containers(
            container1=req.container1,
            container2=req.container2,
            topology_name=topology_name
        )
        return {"message": f"IPsec link between {req.container1} and {req.container2} deleted"}

    class UpdateIPsecLinkArcRequest(BaseModel):
        arc: float

    @router.patch("/{topology_name}/ipsec/links/{link_id}/arc")
    def update_ipsec_link_arc(topology_name: str, link_id: int, req: UpdateIPsecLinkArcRequest):
        """Update the arc (line curvature) of an IPsec link for topology visualization"""
        link = container_manager.db.get_ipsec_link(link_id)
        if not link:
            raise HTTPException(status_code=404, detail=f"IPsec link {link_id} not found")
        if link.get("topology_name") != topology_name:
            raise HTTPException(status_code=400, detail=f"IPsec link {link_id} does not belong to topology '{topology_name}'")

        container_manager.db.update_ipsec_link_arc(link_id, req.arc)
        return {
            "message": f"IPsec link {link_id} arc updated to {req.arc}",
            "link_id": link_id,
            "arc": req.arc
        }

    # ==============================================================================
    # Route Advertisement Configuration Endpoints
    # ==============================================================================

    @router.post("/{topology_name}/route-advertisements")
    def save_route_advertisement(topology_name: str, req: RouteAdvertisementRequest):
        """Save a route advertisement configuration to a topology"""
        # Verify topology exists
        topology = container_manager.db.get_topology(topology_name)
        if not topology:
            raise HTTPException(status_code=404, detail=f"Topology '{topology_name}' not found")

        # Create the route advertisement configuration
        config_repo = TopologyConfigRepository(container_manager.db.db_path)
        ad_id = config_repo.create_route_advertisement(
            topology_name=topology_name,
            target_daemon=req.target_daemon,
            prefix=req.prefix,
            cidr=req.cidr,
            next_hop=req.next_hop,
            communities=req.communities,
            med=req.med,
            as_path=req.as_path
        )

        return {
            "message": f"Route advertisement saved to topology '{topology_name}'",
            "id": ad_id,
            "topology_name": topology_name,
            "prefix": f"{req.prefix}/{req.cidr}"
        }

    @router.get("/{topology_name}/route-advertisements")
    def get_route_advertisements(topology_name: str):
        """Get all route advertisement configurations for a topology"""
        config_repo = TopologyConfigRepository(container_manager.db.db_path)
        advertisements = config_repo.get_route_advertisements(topology_name)
        return {
            "topology_name": topology_name,
            "count": len(advertisements),
            "route_advertisements": advertisements
        }

    @router.delete("/{topology_name}/route-advertisements/{ad_id}")
    def delete_route_advertisement(topology_name: str, ad_id: int):
        """Delete a route advertisement configuration from a topology"""
        config_repo = TopologyConfigRepository(container_manager.db.db_path)

        # Verify the advertisement exists and belongs to this topology
        advertisement = config_repo.get_route_advertisement(ad_id)
        if not advertisement:
            raise HTTPException(status_code=404, detail=f"Route advertisement {ad_id} not found")
        if advertisement["topology_name"] != topology_name:
            raise HTTPException(
                status_code=400,
                detail=f"Route advertisement {ad_id} does not belong to topology '{topology_name}'"
            )

        deleted = config_repo.delete_route_advertisement(ad_id)
        if not deleted:
            raise HTTPException(status_code=500, detail="Failed to delete route advertisement")

        return {"message": f"Route advertisement {ad_id} deleted from topology '{topology_name}'"}

    # ==============================================================================
    # Trigger Configuration Endpoints
    # ==============================================================================

    @router.post("/{topology_name}/triggers")
    def save_trigger(topology_name: str, req: TriggerRequest):
        """Save a trigger configuration to a topology"""
        # Verify topology exists
        topology = container_manager.db.get_topology(topology_name)
        if not topology:
            raise HTTPException(status_code=404, detail=f"Topology '{topology_name}' not found")

        # Create the trigger configuration
        config_repo = TopologyConfigRepository(container_manager.db.db_path)
        trigger_id = config_repo.create_trigger(
            topology_name=topology_name,
            name=req.name,
            enabled=req.enabled,
            min_kbps=req.min_kbps,
            min_mbps=req.min_mbps,
            min_pps=req.min_pps,
            min_bytes=req.min_bytes,
            src_addr=req.src_addr,
            dst_addr=req.dst_addr,
            src_or_dst_addr=req.src_or_dst_addr,
            protocol=req.protocol,
            action_type=req.action_type,
            action_message=req.action_message,
            rate_limit_kbps=req.rate_limit_kbps
        )

        return {
            "message": f"Trigger '{req.name}' saved to topology '{topology_name}'",
            "id": trigger_id,
            "topology_name": topology_name,
            "trigger_name": req.name
        }

    @router.get("/{topology_name}/triggers")
    def get_triggers(topology_name: str):
        """Get all trigger configurations for a topology"""
        config_repo = TopologyConfigRepository(container_manager.db.db_path)
        triggers = config_repo.get_triggers(topology_name)
        return {
            "topology_name": topology_name,
            "count": len(triggers),
            "triggers": triggers
        }

    @router.put("/{topology_name}/triggers/{trigger_id}")
    def update_trigger(topology_name: str, trigger_id: int, req: TriggerRequest):
        """Update a trigger configuration in a topology"""
        config_repo = TopologyConfigRepository(container_manager.db.db_path)

        # Verify the trigger exists and belongs to this topology
        trigger = config_repo.get_trigger(trigger_id)
        if not trigger:
            raise HTTPException(status_code=404, detail=f"Trigger {trigger_id} not found")
        if trigger["topology_name"] != topology_name:
            raise HTTPException(
                status_code=400,
                detail=f"Trigger {trigger_id} does not belong to topology '{topology_name}'"
            )

        # Update the trigger
        updated = config_repo.update_trigger(
            trigger_id=trigger_id,
            name=req.name,
            enabled=req.enabled,
            min_kbps=req.min_kbps,
            min_mbps=req.min_mbps,
            min_pps=req.min_pps,
            min_bytes=req.min_bytes,
            src_addr=req.src_addr,
            dst_addr=req.dst_addr,
            src_or_dst_addr=req.src_or_dst_addr,
            protocol=req.protocol,
            action_type=req.action_type,
            action_message=req.action_message,
            rate_limit_kbps=req.rate_limit_kbps
        )

        if not updated:
            raise HTTPException(status_code=500, detail="Failed to update trigger")

        return {
            "message": f"Trigger '{req.name}' updated in topology '{topology_name}'",
            "id": trigger_id,
            "topology_name": topology_name,
            "trigger_name": req.name
        }

    @router.delete("/{topology_name}/triggers/{trigger_id}")
    def delete_trigger(topology_name: str, trigger_id: int):
        """Delete a trigger configuration from a topology"""
        config_repo = TopologyConfigRepository(container_manager.db.db_path)

        # Verify the trigger exists and belongs to this topology
        trigger = config_repo.get_trigger(trigger_id)
        if not trigger:
            raise HTTPException(status_code=404, detail=f"Trigger {trigger_id} not found")
        if trigger["topology_name"] != topology_name:
            raise HTTPException(
                status_code=400,
                detail=f"Trigger {trigger_id} does not belong to topology '{topology_name}'"
            )

        deleted = config_repo.delete_trigger(trigger_id)
        if not deleted:
            raise HTTPException(status_code=500, detail="Failed to delete trigger")

        return {"message": f"Trigger {trigger_id} deleted from topology '{topology_name}'"}

    # ==============================================================================
    # Unified Node Management Endpoints (New Model)
    # ==============================================================================

    class CreateNodeRequest(BaseModel):
        name: str
        node_type: str  # 'daemon', 'host', or 'external'
        # Common fields
        status: str = "created"
        map_x: Optional[float] = None
        map_y: Optional[float] = None
        color: Optional[str] = None
        # Daemon-specific fields
        daemon_type: Optional[str] = None  # 'gobgp', 'frr', 'exabgp'
        asn: Optional[int] = None
        router_id: Optional[str] = None
        ip_address: Optional[str] = None
        api_port: Optional[int] = None
        location: str = "Local"
        docker_image: Optional[str] = None
        # Host-specific fields
        gateway_node: Optional[str] = None
        gateway_ip: Optional[str] = None
        container_ip: Optional[str] = None
        loopback_ip: Optional[str] = None
        loopback_network: str = "24"

    @router.post("/{topology_name}/nodes")
    def create_node(topology_name: str, req: CreateNodeRequest):
        """Create a unified node in the topology (new model)"""
        # Verify topology exists
        topology = container_manager.db.get_topology(topology_name)
        if not topology:
            raise HTTPException(status_code=404, detail=f"Topology '{topology_name}' not found")

        # Validate node_type
        if req.node_type not in ['daemon', 'host', 'external']:
            raise HTTPException(status_code=400, detail=f"Invalid node_type '{req.node_type}'. Must be 'daemon', 'host', or 'external'")

        container_manager.db.create_node(
            name=req.name,
            node_type=req.node_type,
            topology_name=topology_name,
            status=req.status,
            map_x=req.map_x,
            map_y=req.map_y,
            color=req.color,
            daemon_type=req.daemon_type,
            asn=req.asn,
            router_id=req.router_id,
            ip_address=req.ip_address,
            api_port=req.api_port,
            location=req.location,
            docker_image=req.docker_image,
            gateway_node=req.gateway_node,
            gateway_ip=req.gateway_ip,
            container_ip=req.container_ip,
            loopback_ip=req.loopback_ip,
            loopback_network=req.loopback_network
        )

        return {
            "message": f"Node '{req.name}' ({req.node_type}) created in topology '{topology_name}'",
            "name": req.name,
            "node_type": req.node_type,
            "topology_name": topology_name
        }

    @router.get("/{topology_name}/nodes")
    def list_nodes(topology_name: str, node_type: Optional[str] = None):
        """List all nodes in a topology, optionally filtered by type"""
        nodes = container_manager.db.list_nodes(topology_name=topology_name, node_type=node_type)
        return {
            "topology_name": topology_name,
            "node_type_filter": node_type,
            "count": len(nodes),
            "nodes": nodes
        }

    @router.get("/{topology_name}/nodes/{node_name}")
    def get_node(topology_name: str, node_name: str):
        """Get a specific node by name"""
        node = container_manager.db.get_node(node_name, topology_name=topology_name)
        if not node:
            raise HTTPException(status_code=404, detail=f"Node '{node_name}' not found in topology '{topology_name}'")

        # Get node's network connections
        networks = container_manager.db.get_node_networks(node_name, topology_name=topology_name)
        node["networks"] = networks

        return node

    class UpdateNodeRequest(BaseModel):
        status: Optional[str] = None
        map_x: Optional[float] = None
        map_y: Optional[float] = None
        color: Optional[str] = None

    @router.patch("/{topology_name}/nodes/{node_name}")
    def update_node(topology_name: str, node_name: str, req: UpdateNodeRequest):
        """Update node properties (position, color, status)"""
        node = container_manager.db.get_node(node_name, topology_name=topology_name)
        if not node:
            raise HTTPException(status_code=404, detail=f"Node '{node_name}' not found in topology '{topology_name}'")

        if req.status is not None:
            container_manager.db.update_node_status(node_name, req.status, topology_name=topology_name)
        if req.map_x is not None and req.map_y is not None:
            container_manager.db.update_node_position(node_name, req.map_x, req.map_y, topology_name=topology_name)
        if req.color is not None:
            container_manager.db.update_node_properties(node_name, topology_name=topology_name, color=req.color)

        return {"message": f"Node '{node_name}' updated"}

    @router.patch("/{topology_name}/nodes/{node_name}/position")
    def update_node_position(
        topology_name: str,
        node_name: str,
        x: float = Query(..., description="X coordinate on map"),
        y: float = Query(..., description="Y coordinate on map")
    ):
        """Update node position on topology map"""
        node = container_manager.db.get_node(node_name, topology_name=topology_name)
        if not node:
            raise HTTPException(status_code=404, detail=f"Node '{node_name}' not found in topology '{topology_name}'")

        container_manager.db.update_node_position(node_name, x, y, topology_name=topology_name)
        return {"message": f"Position updated for node '{node_name}'"}

    @router.delete("/{topology_name}/nodes/{node_name}")
    def delete_node(topology_name: str, node_name: str):
        """Delete a node from the topology"""
        node = container_manager.db.get_node(node_name, topology_name=topology_name)
        if not node:
            raise HTTPException(status_code=404, detail=f"Node '{node_name}' not found in topology '{topology_name}'")

        container_manager.db.delete_node(node_name, topology_name=topology_name)
        return {"message": f"Node '{node_name}' deleted from topology '{topology_name}'"}

    # ==============================================================================
    # Node Network Connections (New Model)
    # ==============================================================================

    class AddNodeNetworkRequest(BaseModel):
        network_name: str
        ipv4_address: Optional[str] = None
        interface_name: Optional[str] = None

    @router.post("/{topology_name}/nodes/{node_name}/networks")
    def add_node_network(topology_name: str, node_name: str, req: AddNodeNetworkRequest):
        """Connect a node to a network"""
        node = container_manager.db.get_node(node_name, topology_name=topology_name)
        if not node:
            raise HTTPException(status_code=404, detail=f"Node '{node_name}' not found in topology '{topology_name}'")

        container_manager.db.add_node_network(
            node_name=node_name,
            network_name=req.network_name,
            topology_name=topology_name,
            ipv4_address=req.ipv4_address,
            interface_name=req.interface_name
        )

        return {"message": f"Node '{node_name}' connected to network '{req.network_name}'"}

    @router.get("/{topology_name}/nodes/{node_name}/networks")
    def get_node_networks(topology_name: str, node_name: str):
        """Get all network connections for a node"""
        node = container_manager.db.get_node(node_name, topology_name=topology_name)
        if not node:
            raise HTTPException(status_code=404, detail=f"Node '{node_name}' not found in topology '{topology_name}'")

        networks = container_manager.db.get_node_networks(node_name, topology_name=topology_name)
        return {
            "node_name": node_name,
            "topology_name": topology_name,
            "count": len(networks),
            "networks": networks
        }

    @router.delete("/{topology_name}/nodes/{node_name}/networks/{network_name}")
    def remove_node_network(topology_name: str, node_name: str, network_name: str):
        """Disconnect a node from a network"""
        node = container_manager.db.get_node(node_name, topology_name=topology_name)
        if not node:
            raise HTTPException(status_code=404, detail=f"Node '{node_name}' not found in topology '{topology_name}'")

        container_manager.db.remove_node_network(node_name, network_name, topology_name=topology_name)
        return {"message": f"Node '{node_name}' disconnected from network '{network_name}'"}

    return router
