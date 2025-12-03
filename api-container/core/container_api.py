"""
Container Management API
Provides endpoints for managing BGP daemon and host containers
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import logging
import httpx

from .container_manager import ContainerManager
from .websocket_manager import bmp_manager, netflow_manager, netflow_flows_manager
from ..utils import discover_monitoring_services
from ..managers.tap_manager import TapManager

# Import route setup functions
from ..routes.daemon_routes import setup_daemon_routes
from ..routes.host_routes import setup_host_routes
from ..routes.network_routes import setup_network_routes
from ..routes.topology_routes import setup_topology_routes
from ..routes.lab_routes import setup_lab_routes
from ..routes.tunnel_routes import setup_tunnel_routes
from ..routes.netflow_routes import setup_netflow_routes
from ..routes.websocket_routes import setup_websocket_routes
from ..routes.proxy_routes import setup_proxy_routes
from ..routes.utility_routes import setup_utility_routes
from ..routes.tap_routes import setup_tap_routes


# Set up logging
logger = logging.getLogger("container-api")

app = FastAPI(title="NetStream Container Management API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize container manager
container_manager = ContainerManager()

# Initialize tap manager with db reference for topology management_network lookup
tap_manager = TapManager(container_manager.client, db=container_manager.db)

# HTTP client for proxying requests
http_client = httpx.AsyncClient(timeout=30.0)

# Setup utility routes first (needed for get_config)
utility_router = setup_utility_routes(
    app,
    container_manager,
    discover_monitoring_services,
    container_manager.list_daemons,
    container_manager.list_hosts
)

# Get config function for proxy routes
def get_config_func(request: Request):
    """Get configuration for proxy routes"""
    import os

    # Get running daemons with their API ports
    daemons = container_manager.list_daemons()

    # Get running hosts with their API ports
    hosts = container_manager.list_hosts()

    # Get all Docker networks from lab manager
    docker_networks = container_manager.list_networks()

    # Determine base host
    base_host = os.getenv("PUBLIC_HOST")
    if not base_host:
        request_host = request.headers.get("host", "localhost:5010")
        base_host = request_host.split(":")[0]

    # Discover monitoring services
    monitoring_info = discover_monitoring_services(container_manager.client, base_host)

    if not monitoring_info or not monitoring_info["url"]:
        logger.warning("Monitoring services not discovered")
        monitoring_info = {
            "url": None,
            "bmp": {"tcp_port": None, "endpoints": {}},
            "netflow": {"udp_port": None, "endpoints": {}, "websocket": None}
        }

    return {
        "container_manager": {"url": f"http://{base_host}:5010"},
        "monitoring": monitoring_info,
        "networks": docker_networks,
        "daemons": [
            {
                "name": daemon["name"],
                "type": daemon["daemon_type"],
                "asn": daemon["asn"],
                "router_id": daemon["router_id"],
                "url": f"http://{base_host}:{daemon['api_port']}",
                "status": daemon["status"],
                "networks": daemon.get("networks", []),
                "websockets": {
                    "bgp_stream": f"ws://{base_host}:{daemon['api_port']}/bgp/ws/stream",
                    "neighbors": f"ws://{base_host}:{daemon['api_port']}/bgp/ws/neighbors",
                    "routes": f"ws://{base_host}:{daemon['api_port']}/bgp/ws/routes"
                }
            }
            for daemon in daemons if daemon["status"] == "running"
        ],
        "hosts": [
            {
                "name": host["name"],
                "url": f"http://{base_host}:{host['api_port']}",
                "status": host["status"],
                "gateway_daemon": host.get("gateway_daemon", ""),
                "gateway_ip": host.get("gateway_ip", ""),
                "loopback_ip": host.get("loopback_ip", ""),
                "loopback_network": host.get("loopback_network", ""),
                "container_ip": host.get("container_ip", ""),
                "networks": host.get("networks", []),
                "websockets": {
                    "tools_start": f"ws://{base_host}:{host['api_port']}/tools/ws/start",
                    "tools_active": f"ws://{base_host}:{host['api_port']}/tools/ws/active",
                    "traffic_active": f"ws://{base_host}:{host['api_port']}/traffic/ws/active"
                }
            }
            for host in hosts if host["status"] == "running"
        ]
    }

# Setup all routes
daemon_router = setup_daemon_routes(app, container_manager)
host_router = setup_host_routes(app, container_manager)
network_router = setup_network_routes(app, container_manager)
topology_router = setup_topology_routes(app, container_manager)
lab_router = setup_lab_routes(app, container_manager)
tunnel_router = setup_tunnel_routes(app, container_manager)
netflow_router = setup_netflow_routes(app, container_manager)
tap_router = setup_tap_routes(app, tap_manager, discover_monitoring_services, container_manager.client, container_manager.db)

# Setup websocket routes (these are registered directly on app)
setup_websocket_routes(
    app,
    bmp_manager,
    netflow_manager,
    netflow_flows_manager,
    discover_monitoring_services,
    container_manager.client,
    container_manager
)

# Setup proxy routes (these are registered directly on app)
setup_proxy_routes(app, http_client, get_config_func)

# Include routers in app
app.include_router(daemon_router)
app.include_router(host_router)
app.include_router(network_router)
app.include_router(topology_router)
app.include_router(lab_router)
app.include_router(tunnel_router)
app.include_router(netflow_router)
app.include_router(utility_router)


@app.on_event("startup")
async def connect_to_mgmt_network():
    """
    Ensure the container-manager is connected to mgmt_network on startup.
    This enables Docker DNS resolution for host/daemon containers when proxying WebSocket connections.
    """
    try:
        import socket
        import docker

        # Get our own container name/ID
        hostname = socket.gethostname()
        client = container_manager.client

        # Check if mgmt_network exists
        try:
            mgmt_network = client.networks.get("mgmt_network")
        except docker.errors.NotFound:
            logger.info("[Startup] mgmt_network not found, will be created when topology is deployed")
            return

        # Get our container
        try:
            container = client.containers.get(hostname)
        except docker.errors.NotFound:
            logger.warning(f"[Startup] Could not find container '{hostname}', skipping mgmt_network connection")
            return

        # Check if already connected
        container.reload()
        current_networks = container.attrs.get('NetworkSettings', {}).get('Networks', {})

        if 'mgmt_network' in current_networks:
            logger.info("[Startup] Container-manager already connected to mgmt_network")
        else:
            mgmt_network.connect(container)
            logger.info("[Startup] Connected container-manager to mgmt_network for Docker DNS resolution")

    except Exception as e:
        logger.warning(f"[Startup] Failed to connect to mgmt_network: {e}")
