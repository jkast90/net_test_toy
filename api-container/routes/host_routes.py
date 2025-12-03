"""
Host Management Routes
Handles host container CRUD operations
"""
from fastapi import APIRouter
from ..models import CreateHostRequest, UpdateHostRequest, ExecCommandRequest


router = APIRouter(prefix="/hosts", tags=["hosts"])


def setup_host_routes(app, container_manager):
    """Setup host routes with container_manager dependency"""

    @router.get("")
    def list_hosts():
        """List all host containers"""
        return container_manager.list_hosts()

    @router.post("")
    def create_host(req: CreateHostRequest):
        """Create a new host container"""
        # Pass container_ip as-is (None or provided value)
        # If None, Docker will auto-assign from the network pool
        return container_manager.create_host(
            name=req.name,
            gateway_daemon=req.gateway_daemon,
            gateway_ip=req.gateway_ip,
            loopback_ip=req.loopback_ip,
            loopback_network=req.loopback_network,
            container_ip=req.container_ip,
            network=req.network,
            topology_name=req.topology_name
        )

    @router.delete("/{name}")
    def delete_host(name: str):
        """Delete a host container"""
        return container_manager.delete_host(name)

    @router.patch("/{name}")
    def update_host(name: str, req: UpdateHostRequest):
        """Update host configuration"""
        return container_manager.update_host(
            name=name,
            gateway_daemon=req.gateway_daemon,
            gateway_ip=req.gateway_ip,
            loopback_ip=req.loopback_ip,
            loopback_network=req.loopback_network,
            container_ip=req.container_ip
        )

    @router.post("/{name}/start")
    def start_host(name: str):
        """Start a stopped host"""
        return container_manager.start_host(name)

    @router.post("/{name}/stop")
    def stop_host(name: str):
        """Stop a running host"""
        return container_manager.stop_host(name)

    @router.post("/{name}/reset-networking")
    def reset_host_networking(name: str):
        """Reset host's networking configuration from database"""
        return container_manager.reset_host_networking(name)

    @router.post("/{name}/exec")
    def exec_command_in_host(name: str, req: ExecCommandRequest):
        """Execute a command in a host container"""
        return container_manager.exec_command(name, req.command)

    return router
