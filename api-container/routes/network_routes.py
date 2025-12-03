"""
Network Management Routes
Handles Docker network operations and container connections
"""
from fastapi import APIRouter
from ..models import CreateNetworkRequest, ConnectNetworkRequest, AddIpToInterfaceRequest


router = APIRouter(prefix="/networks", tags=["networks"])


def setup_network_routes(app, container_manager):
    """Setup network routes with container_manager dependency"""

    @router.get("")
    def list_networks():
        """List all Docker networks"""
        return container_manager.list_networks()

    @router.post("")
    def create_network(req: CreateNetworkRequest):
        """Create a new Docker network"""
        return container_manager.create_network(
            name=req.name,
            subnet=req.subnet,
            gateway=req.gateway,
            driver=req.driver
        )

    @router.delete("/{name}")
    def delete_network(name: str):
        """Delete a Docker network"""
        return container_manager.delete_network(name)

    @app.post("/containers/{container_name}/networks/{network_name}/connect")
    def connect_container_to_network(container_name: str, network_name: str, req: ConnectNetworkRequest = None):
        """Connect a container to a network with optional IP address"""
        ipv4_address = req.ipv4_address if req else None
        return container_manager.connect_container_to_network(container_name, network_name, ipv4_address)

    @app.post("/containers/{container_name}/networks/{network_name}/disconnect")
    def disconnect_container_from_network(container_name: str, network_name: str):
        """Disconnect a container from a network"""
        return container_manager.disconnect_container_from_network(container_name, network_name)

    @app.get("/containers/{container_name}/networks")
    def get_container_networks(container_name: str):
        """Get list of networks a container is connected to"""
        return container_manager.get_container_networks(container_name)

    @app.post("/containers/{container_name}/networks/{network_name}/add-ip")
    def add_ip_to_interface(container_name: str, network_name: str, req: AddIpToInterfaceRequest):
        """Add an IP address to an already-connected network interface"""
        return container_manager.add_ip_to_interface(container_name, network_name, req.ipv4_address, req.netmask)

    @app.post("/containers/{container_name}/interfaces/{interface}/ips")
    def add_ip_to_container(container_name: str, interface: str, ip_address: str):
        """
        Add an IP address to a container's network interface.
        This allows adding secondary IPs to existing interfaces.

        Args:
            container_name: Name of the container
            interface: Network interface name (e.g., 'eth0', 'eth2')
            ip_address: IP address to add with CIDR notation (e.g., '10.0.1.5/24')

        Returns:
            Dict with addition status
        """
        return container_manager.add_ip_to_container(
            container_name=container_name,
            interface=interface,
            ip_address=ip_address
        )

    @app.delete("/containers/{container_name}/interfaces/{interface}/ips/{ip_address}")
    def remove_ip_from_container(container_name: str, interface: str, ip_address: str):
        """
        Remove a specific IP address from a container's network interface.
        This allows removing secondary IPs without disconnecting from the network.

        Args:
            container_name: Name of the container
            interface: Network interface name (e.g., 'eth0', 'eth2')
            ip_address: IP address to remove (with or without CIDR notation)

        Returns:
            Dict with removal status
        """
        return container_manager.remove_ip_from_container(
            container_name=container_name,
            interface=interface,
            ip_address=ip_address
        )

    @app.post("/networks/cleanup-ips")
    def cleanup_stale_ips(network_name: str = None):
        """
        Clean up stale IP address reservations in Docker networks.
        This identifies IP addresses that are reserved but not actually in use.

        Args:
            network_name: Optional network name to clean. If None, cleans all networks.

        Returns:
            Cleanup results with list of stale IPs found
        """
        return container_manager.cleanup_stale_ips(network_name=network_name)

    return router
