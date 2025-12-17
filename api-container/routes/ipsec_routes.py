"""
IPsec Routes - API endpoints for StrongSwan IPsec tunnel management
"""
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter(tags=["IPsec Tunnels"])


# Pydantic models for request/response
class IPsecTunnelCreate(BaseModel):
    tunnel_name: str
    local_ip: str
    remote_ip: str
    tunnel_ip: str
    tunnel_network: str = "30"
    psk: Optional[str] = None
    ike_version: int = 2
    ike_cipher: str = "aes256-sha256-modp2048"
    esp_cipher: str = "aes256-sha256"
    topology_name: Optional[str] = None


class IPsecLinkCreate(BaseModel):
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


class DeleteLinkByContainers(BaseModel):
    container1: str
    container2: str


# Will be set by container_api.py
ipsec_manager = None
container_manager = None


def set_managers(ipsec_mgr, container_mgr):
    """Set the manager instances - called from container_api.py"""
    global ipsec_manager, container_manager
    ipsec_manager = ipsec_mgr
    container_manager = container_mgr


# ============================================================================
# Container-level IPsec Tunnel Routes
# ============================================================================

@router.post("/containers/{container_name}/ipsec")
async def create_ipsec_tunnel(container_name: str, request: IPsecTunnelCreate):
    """
    Create an IPsec tunnel on a specific container using StrongSwan.

    The container must have StrongSwan installed (apt-get install strongswan).
    A pre-shared key (PSK) will be auto-generated if not provided.
    """
    return ipsec_manager.create_ipsec_tunnel(
        container_name=container_name,
        tunnel_name=request.tunnel_name,
        local_ip=request.local_ip,
        remote_ip=request.remote_ip,
        tunnel_ip=request.tunnel_ip,
        tunnel_network=request.tunnel_network,
        psk=request.psk,
        ike_version=request.ike_version,
        ike_cipher=request.ike_cipher,
        esp_cipher=request.esp_cipher,
        topology_name=request.topology_name
    )


@router.get("/containers/{container_name}/ipsec")
async def list_container_ipsec_tunnels(container_name: str):
    """List all IPsec tunnels for a specific container."""
    return ipsec_manager.list_ipsec_tunnels(container_name)


@router.get("/containers/ipsec")
async def list_all_ipsec_tunnels():
    """List all IPsec tunnels across all containers."""
    return ipsec_manager.list_ipsec_tunnels()


@router.delete("/containers/{container_name}/ipsec/{tunnel_name}")
async def delete_ipsec_tunnel(container_name: str, tunnel_name: str):
    """Delete an IPsec tunnel from a container."""
    return ipsec_manager.delete_ipsec_tunnel(container_name, tunnel_name)


@router.get("/containers/{container_name}/ipsec/{tunnel_name}/state")
async def get_ipsec_tunnel_state(container_name: str, tunnel_name: str):
    """
    Get detailed state of an IPsec tunnel.

    Returns IKE SA status, Child SA (ESP) status, traffic statistics,
    and VTI interface information.
    """
    return ipsec_manager.get_ipsec_tunnel_state(container_name, tunnel_name)


@router.post("/containers/{container_name}/ipsec/{tunnel_name}/restart")
async def restart_ipsec_tunnel(container_name: str, tunnel_name: str):
    """
    Restart an IPsec tunnel connection.

    Brings the connection down and back up to re-establish IKE SA.
    """
    return ipsec_manager.restart_ipsec_tunnel(container_name, tunnel_name)


@router.post("/containers/{container_name}/ipsec/{tunnel_name}/test")
async def test_ipsec_tunnel_connectivity(
    container_name: str,
    tunnel_name: str,
    remote_ip: Optional[str] = Query(None, description="Remote IP to ping (uses DB config if not provided)")
):
    """
    Test connectivity through the IPsec tunnel by pinging the remote endpoint.
    """
    return ipsec_manager.test_ipsec_tunnel_connectivity(container_name, tunnel_name, remote_ip)


@router.get("/containers/{container_name}/ipsec/{tunnel_name}/diagnose")
async def diagnose_ipsec_tunnel(container_name: str, tunnel_name: str):
    """
    Diagnose common IPsec tunnel issues.

    Checks:
    - StrongSwan daemon status
    - IKE SA establishment
    - Child SA (ESP) installation
    - VTI interface existence
    - Remote endpoint reachability
    """
    return ipsec_manager.diagnose_ipsec_tunnel(container_name, tunnel_name)


# ============================================================================
# Topology-level IPsec Link Routes (bidirectional tunnels)
# ============================================================================

@router.post("/{topology_name}/ipsec/links")
async def create_ipsec_link(topology_name: str, request: IPsecLinkCreate):
    """
    Create a bidirectional IPsec link between two containers.

    This creates IPsec tunnels on both containers simultaneously,
    using a shared pre-shared key (auto-generated if not provided).
    """
    # Generate PSK if not provided
    if request.psk is None:
        import secrets
        psk = secrets.token_urlsafe(32)
    else:
        psk = request.psk

    # Get underlay IPs for each container on the shared network
    container1_ip = None
    container2_ip = None

    # Try daemon networks first
    daemon1_networks = container_manager.db.get_daemon_networks(request.container1)
    for net in daemon1_networks:
        if net['network_name'] == request.network:
            container1_ip = net['ipv4_address']
            break

    daemon2_networks = container_manager.db.get_daemon_networks(request.container2)
    for net in daemon2_networks:
        if net['network_name'] == request.network:
            container2_ip = net['ipv4_address']
            break

    # Try host networks if not found
    if not container1_ip:
        host1_networks = container_manager.db.get_host_networks(request.container1)
        for net in host1_networks:
            if net['network_name'] == request.network:
                container1_ip = net['ipv4_address']
                break

    if not container2_ip:
        host2_networks = container_manager.db.get_host_networks(request.container2)
        for net in host2_networks:
            if net['network_name'] == request.network:
                container2_ip = net['ipv4_address']
                break

    if not container1_ip:
        raise HTTPException(status_code=400, detail=f"Container '{request.container1}' not connected to network '{request.network}'")
    if not container2_ip:
        raise HTTPException(status_code=400, detail=f"Container '{request.container2}' not connected to network '{request.network}'")

    # Create tunnel on container1
    tunnel1_name = f"ipsec-{request.container2[:8]}"
    result1 = ipsec_manager.create_ipsec_tunnel(
        container_name=request.container1,
        tunnel_name=tunnel1_name,
        local_ip=container1_ip,
        remote_ip=container2_ip,
        tunnel_ip=request.tunnel_ip1,
        tunnel_network=request.tunnel_network,
        psk=psk,
        ike_version=request.ike_version,
        ike_cipher=request.ike_cipher,
        esp_cipher=request.esp_cipher,
        topology_name=topology_name
    )

    # Create tunnel on container2
    tunnel2_name = f"ipsec-{request.container1[:8]}"
    result2 = ipsec_manager.create_ipsec_tunnel(
        container_name=request.container2,
        tunnel_name=tunnel2_name,
        local_ip=container2_ip,
        remote_ip=container1_ip,
        tunnel_ip=request.tunnel_ip2,
        tunnel_network=request.tunnel_network,
        psk=psk,
        ike_version=request.ike_version,
        ike_cipher=request.ike_cipher,
        esp_cipher=request.esp_cipher,
        topology_name=topology_name
    )

    # Save as a link in the database
    link_id = container_manager.db.create_ipsec_link(
        container1=request.container1,
        container2=request.container2,
        network=request.network,
        tunnel_ip1=request.tunnel_ip1,
        tunnel_ip2=request.tunnel_ip2,
        tunnel_network=request.tunnel_network,
        psk=psk,
        ike_version=request.ike_version,
        ike_cipher=request.ike_cipher,
        esp_cipher=request.esp_cipher,
        dh_group=request.dh_group,
        ike_lifetime=request.ike_lifetime,
        sa_lifetime=request.sa_lifetime,
        dpd_delay=request.dpd_delay,
        dpd_timeout=request.dpd_timeout,
        topology_name=topology_name
    )

    return {
        "link_id": link_id,
        "topology_name": topology_name,
        "container1": {
            "name": request.container1,
            "tunnel_name": tunnel1_name,
            "result": result1
        },
        "container2": {
            "name": request.container2,
            "tunnel_name": tunnel2_name,
            "result": result2
        },
        "psk": psk,
        "status": "created"
    }


@router.get("/{topology_name}/ipsec/links")
async def list_ipsec_links(topology_name: str):
    """List all IPsec links in a topology."""
    return container_manager.db.list_ipsec_links(topology_name=topology_name)


@router.get("/{topology_name}/ipsec/links/{link_id}")
async def get_ipsec_link(topology_name: str, link_id: int):
    """Get a specific IPsec link by ID."""
    link = container_manager.db.get_ipsec_link(link_id)
    if not link:
        raise HTTPException(status_code=404, detail=f"IPsec link {link_id} not found")
    return link


@router.delete("/{topology_name}/ipsec/links/{link_id}")
async def delete_ipsec_link(topology_name: str, link_id: int):
    """
    Delete an IPsec link by ID.

    This removes the tunnels from both containers and deletes the link record.
    """
    link = container_manager.db.get_ipsec_link(link_id)
    if not link:
        raise HTTPException(status_code=404, detail=f"IPsec link {link_id} not found")

    # Delete tunnels from containers
    tunnel1_name = f"ipsec-{link['container2'][:8]}"
    tunnel2_name = f"ipsec-{link['container1'][:8]}"

    try:
        ipsec_manager.delete_ipsec_tunnel(link['container1'], tunnel1_name)
    except Exception as e:
        pass  # Continue even if first delete fails

    try:
        ipsec_manager.delete_ipsec_tunnel(link['container2'], tunnel2_name)
    except Exception as e:
        pass  # Continue even if second delete fails

    # Delete the link record
    container_manager.db.delete_ipsec_link(link_id)

    return {"status": "deleted", "link_id": link_id}


@router.delete("/{topology_name}/ipsec/links/by-containers")
async def delete_ipsec_link_by_containers(topology_name: str, request: DeleteLinkByContainers):
    """Delete an IPsec link by container names."""
    # Find the link
    links = container_manager.db.list_ipsec_links(topology_name=topology_name, container_name=request.container1)
    link = None
    for l in links:
        if (l['container1'] == request.container1 and l['container2'] == request.container2) or \
           (l['container1'] == request.container2 and l['container2'] == request.container1):
            link = l
            break

    if not link:
        raise HTTPException(status_code=404, detail=f"IPsec link between {request.container1} and {request.container2} not found")

    # Delete tunnels from containers
    tunnel1_name = f"ipsec-{link['container2'][:8]}"
    tunnel2_name = f"ipsec-{link['container1'][:8]}"

    try:
        ipsec_manager.delete_ipsec_tunnel(link['container1'], tunnel1_name)
    except Exception:
        pass

    try:
        ipsec_manager.delete_ipsec_tunnel(link['container2'], tunnel2_name)
    except Exception:
        pass

    container_manager.db.delete_ipsec_link_by_containers(request.container1, request.container2, topology_name)

    return {"status": "deleted", "container1": request.container1, "container2": request.container2}


@router.patch("/{topology_name}/ipsec/links/{link_id}/arc")
async def update_ipsec_link_arc(topology_name: str, link_id: int, arc: float = Query(...)):
    """Update the arc (line curvature) of an IPsec link for visualization."""
    container_manager.db.update_ipsec_link_arc(link_id, arc)
    return {"status": "updated", "link_id": link_id, "arc": arc}
