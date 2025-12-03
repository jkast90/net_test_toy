"""
Daemon Management Routes
Handles BGP daemon container CRUD operations
"""
from fastapi import APIRouter
from ..models import CreateDaemonRequest, UpdateDaemonRequest, ConfigureBMPRequest


router = APIRouter(prefix="/daemons", tags=["daemons"])


def setup_daemon_routes(app, container_manager):
    """Setup daemon routes with container_manager dependency"""

    @router.get("")
    def list_daemons():
        """List all BGP daemon containers"""
        return container_manager.list_daemons()

    @router.post("")
    def create_daemon(req: CreateDaemonRequest):
        """Create a new BGP daemon container"""
        # Auto-assign IP if not provided
        ip_address = req.ip_address
        if not ip_address:
            ip_address = container_manager.get_next_available_ip()

        # Auto-assign port if not provided
        api_port = req.api_port
        if not api_port:
            api_port = container_manager.get_next_available_port()

        return container_manager.create_daemon(
            daemon_type=req.daemon_type,
            name=req.name,
            asn=req.asn,
            router_id=req.router_id,
            ip_address=ip_address,
            api_port=api_port
        )

    @router.delete("/{name}")
    def delete_daemon(name: str):
        """Delete a daemon container"""
        return container_manager.delete_daemon(name)

    @router.patch("/{name}")
    def update_daemon(name: str, req: UpdateDaemonRequest):
        """Update daemon configuration (daemon must be stopped)"""
        return container_manager.update_daemon(
            name=name,
            asn=req.asn,
            router_id=req.router_id,
            ip_address=req.ip_address
        )

    @router.post("/{name}/start")
    def start_daemon(name: str):
        """Start a stopped daemon"""
        return container_manager.start_daemon(name)

    @router.post("/{name}/stop")
    def stop_daemon(name: str):
        """Stop a running daemon"""
        return container_manager.stop_daemon(name)

    @router.post("/{name}/reset-networking")
    def reset_daemon_networking(name: str):
        """Reset daemon's networking configuration from database"""
        return container_manager.reset_daemon_networking(name)

    @router.post("/{name}/configure-bmp")
    def configure_bmp_on_daemon(name: str, req: ConfigureBMPRequest):
        """
        Configure BMP (BGP Monitoring Protocol) on a daemon
        The daemon will connect to the BMP monitoring server at the specified address/port
        """
        return container_manager.configure_bmp_on_daemon(
            daemon_name=name,
            bmp_address=req.bmp_address,
            bmp_port=req.bmp_port
        )

    return router
