"""
GRE Tunnel Management Routes
Handles GRE tunnel CRUD and diagnostic operations
"""
from fastapi import APIRouter, Query
from typing import Optional


router = APIRouter(prefix="/containers", tags=["tunnels"])


def setup_tunnel_routes(app, container_manager):
    """Setup tunnel routes with container_manager dependency"""

    @router.post("/{container_name}/tunnels")
    def create_gre_tunnel(
        container_name: str,
        tunnel_name: str = Query(..., description="Name of the tunnel interface (e.g., gre0)"),
        local_ip: str = Query(..., description="Source IP for the GRE tunnel"),
        remote_ip: str = Query(..., description="Destination IP for the GRE tunnel"),
        tunnel_ip: str = Query(..., description="IP address to assign to tunnel interface"),
        tunnel_network: str = Query(default="30", description="CIDR prefix length for tunnel IP"),
        gre_key: Optional[int] = Query(default=None, description="Optional GRE key"),
        ttl: int = Query(default=64, description="TTL for GRE packets"),
        topology_name: Optional[str] = Query(default=None, description="Topology name (auto-detected if not provided)")
    ):
        """Create a GRE tunnel on a container (daemon or host)"""
        return container_manager.create_gre_tunnel(
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

    @router.get("/{container_name}/tunnels")
    def list_container_tunnels(container_name: str):
        """List all GRE tunnels for a specific container"""
        return {"tunnels": container_manager.list_gre_tunnels(container_name=container_name)}

    @router.get("/tunnels")
    def list_all_tunnels():
        """List all GRE tunnels across all containers"""
        return {"tunnels": container_manager.list_gre_tunnels()}

    @router.delete("/{container_name}/tunnels/{tunnel_name}")
    def delete_gre_tunnel(container_name: str, tunnel_name: str):
        """Delete a GRE tunnel from a container"""
        return container_manager.delete_gre_tunnel(container_name, tunnel_name)

    @router.get("/{container_name}/tunnels/{tunnel_name}/state")
    def get_tunnel_state(container_name: str, tunnel_name: str):
        """
        Get detailed state of a GRE tunnel.
        Compares database configuration with actual container state.

        Returns:
            - Database configuration
            - Actual tunnel state (local/remote IPs, TTL, status)
            - Whether configuration matches
            - List of mismatches if any
        """
        return container_manager.get_gre_tunnel_state(container_name, tunnel_name)

    @router.post("/{container_name}/tunnels/{tunnel_name}/test")
    def test_tunnel_connectivity(container_name: str, tunnel_name: str, remote_ip: Optional[str] = None):
        """
        Test GRE tunnel connectivity by pinging the remote endpoint.

        Args:
            container_name: Container with the tunnel
            tunnel_name: Tunnel interface name
            remote_ip: Optional IP to ping (uses DB config if not provided)

        Returns:
            Ping test results with packet loss and RTT statistics
        """
        return container_manager.test_gre_tunnel_connectivity(
            container_name=container_name,
            tunnel_name=tunnel_name,
            remote_ip=remote_ip
        )

    @router.post("/{container_name}/tunnels/{tunnel_name}/up")
    def bring_tunnel_up(container_name: str, tunnel_name: str):
        """
        Bring a GRE tunnel interface UP.
        Useful for troubleshooting tunnels that are administratively down.

        Args:
            container_name: Container with the tunnel
            tunnel_name: Tunnel interface name

        Returns:
            Dict with operation status and tunnel state
        """
        return container_manager.bring_tunnel_up(container_name, tunnel_name)

    @router.get("/{container_name}/tunnels/{tunnel_name}/diagnose")
    def diagnose_tunnel(container_name: str, tunnel_name: str):
        """
        Diagnose common GRE tunnel issues.
        Checks tunnel existence, configuration, routes, and reachability.

        Args:
            container_name: Container with the tunnel
            tunnel_name: Tunnel interface name

        Returns:
            Dict with diagnostic results, issues, and recommendations
        """
        return container_manager.diagnose_tunnel(container_name, tunnel_name)

    @router.post("/{container_name}/tunnels/{tunnel_name}/fix")
    def fix_tunnel(container_name: str, tunnel_name: str, auto_fix: bool = True):
        """
        Attempt to automatically fix common GRE tunnel issues.
        Runs diagnostics and applies fixes if auto_fix is enabled.

        Args:
            container_name: Container with the tunnel
            tunnel_name: Tunnel interface name
            auto_fix: If True, automatically applies fixes (default: True)

        Returns:
            Dict with fixes applied and before/after diagnostics
        """
        return container_manager.fix_tunnel(container_name, tunnel_name, auto_fix)

    return router
