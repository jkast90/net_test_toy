"""
Utility and Information Routes
Handles utility functions, configuration, and API information
"""
from fastapi import APIRouter, Request
import os
import logging


logger = logging.getLogger(__name__)
router = APIRouter(tags=["utility"])


def setup_utility_routes(app, container_manager, discover_monitoring_services_func, list_daemons_func, list_hosts_func):
    """Setup utility routes with dependencies"""

    @router.get("/network/next-ip")
    def get_next_ip():
        """Get next available IP address"""
        # Get management network from active topology, or use default
        active_topology = container_manager.db.get_active_topology()
        network_name = "netstream_lab_builder_network"
        if active_topology and active_topology.get('management_network'):
            network_name = active_topology['management_network']

        return {"ip": container_manager.get_next_available_ip(network_name)}

    @router.get("/network/next-port")
    def get_next_port():
        """Get next available API port"""
        return {"port": container_manager.get_next_available_port()}

    @router.get("/network/next-asn")
    def get_next_asn():
        """Get next available ASN"""
        return {"asn": container_manager.get_next_available_asn()}

    @router.get("/network/next-router-id")
    def get_next_router_id():
        """Get next available router ID"""
        return {"router_id": container_manager.get_next_available_router_id()}

    @router.get("/network/suggested-daemon-config")
    def get_suggested_daemon_config():
        """Get suggested configuration for a new daemon (all auto-generated values)"""
        return {
            "asn": container_manager.get_next_available_asn(),
            "router_id": container_manager.get_next_available_router_id(),
            "ip_address": container_manager.get_next_available_ip(),
            "api_port": container_manager.get_next_available_port()
        }

    @router.get("/network/suggested-host-config")
    def get_suggested_host_config():
        """Get suggested configuration for a new host (all auto-generated values)"""
        # Get list of daemons to suggest a gateway
        daemons = container_manager.list_daemons()
        gateway_daemon = ""
        gateway_ip = ""

        if daemons:
            # Use the first daemon as default gateway
            first_daemon = daemons[0]
            gateway_daemon = first_daemon.get("name", "")
            gateway_ip = first_daemon.get("router_id", first_daemon.get("ip_address", ""))

        # Get management network from active topology, or use default
        active_topology = container_manager.db.get_active_topology()
        network_name = "netstream_lab_builder_network"
        if active_topology and active_topology.get('management_network'):
            network_name = active_topology['management_network']

        # Get next available IP and add /32 mask for container IP
        next_ip = container_manager.get_next_available_ip(network_name)
        container_ip_with_mask = f"{next_ip}/32"

        # For interface IP (loopback_ip field), extract first 3 octets from gateway_ip
        interface_ip_prefix = ""
        if gateway_ip:
            ip_parts = gateway_ip.split('.')
            if len(ip_parts) >= 3:
                interface_ip_prefix = f"{ip_parts[0]}.{ip_parts[1]}.{ip_parts[2]}."

        return {
            "gateway_daemon": gateway_daemon,
            "gateway_ip": gateway_ip,
            "container_ip": container_ip_with_mask,
            "loopback_ip": interface_ip_prefix,  # Interface IP prefix (first 3 octets)
            "loopback_network": "24",
            "network": network_name
        }

    @router.get("/info")
    def get_info():
        """API information"""
        return {
            "name": "NetStream Container Management API",
            "version": "1.0",
            "description": "Manage BGP daemon and host containers"
        }

    @router.get("/config")
    def get_config(request: Request):
        """
        Get complete API configuration for UI
        Returns all endpoints needed by the frontend with dynamic port discovery
        Uses Docker API to discover monitoring services and their mapped ports
        """
        # Get running daemons with their API ports
        daemons = list_daemons_func()

        # Get running hosts with their API ports
        hosts = list_hosts_func()

        # Get all Docker networks from lab manager
        networks = container_manager.list_networks()

        # Determine base host with priority:
        # 1. PUBLIC_HOST environment variable (for explicit configuration)
        # 2. Request host header (auto-detect from incoming request)
        # 3. Fallback to 'localhost' for local development
        base_host = os.getenv("PUBLIC_HOST")
        if not base_host:
            # Extract host from request headers (removes port if present)
            request_host = request.headers.get("host", "localhost:5010")
            base_host = request_host.split(":")[0]

        # Discover monitoring services using Docker API
        monitoring_info = discover_monitoring_services_func(container_manager.client, base_host)

        # If discovery failed, provide empty monitoring config
        if not monitoring_info or not monitoring_info["url"]:
            logger.warning("Monitoring services not discovered - proxy routes will be unavailable")
            monitoring_info = {
                "url": None,
                "bmp_tcp_port": None,
                "netflow_udp_port": None
            }

        return {
            "container_manager": {
                "url": f"http://{base_host}:5010"
            },
            "monitoring": monitoring_info,
            "networks": networks,
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

    @router.get("/")
    def get_root():
        """API root endpoint"""
        return {"message": "NetStream Container Management API - visit /docs for API documentation"}

    @router.get("/services/discover")
    def discover_services():
        """
        Manual service discovery endpoint for debugging
        Returns discovered monitoring services
        """
        base_host = os.getenv("PUBLIC_HOST", "localhost")
        monitoring_info = discover_monitoring_services_func(container_manager.client, base_host)

        return {
            "base_host": base_host,
            "monitoring": monitoring_info,
            "discovered": monitoring_info is not None and monitoring_info.get("url") is not None
        }

    @router.get("/services")
    def get_services(request: Request):
        """Get information about available monitoring and support services"""
        # Return both internal (Docker) and external URLs
        # Clients can use whichever is appropriate for their context

        # Get the host from the request or environment variable
        base_host = os.getenv("PUBLIC_HOST")
        if not base_host:
            request_host = request.headers.get("host", "")
            if request_host:
                base_host = request_host.split(":")[0]
            else:
                base_host = "localhost"

        monitoring_url_external = f"http://{base_host}:5002"
        monitoring_url_internal = "http://netstream-monitoring:5002"

        return {
            "monitoring": {
                "url_external": monitoring_url_external,  # For browsers/external clients
                "url_internal": monitoring_url_internal,  # For Docker containers
                "port": 5002,
                "services": {
                    "bmp": {
                        "enabled": True,
                        "listen_port": 11019,
                        "api_endpoint_external": f"{monitoring_url_external}/api/bmp",
                        "api_endpoint_internal": f"{monitoring_url_internal}/api/bmp"
                    },
                    "netflow": {
                        "enabled": True,
                        "collector_port": 2055,
                        "api_endpoint_external": f"{monitoring_url_external}/api/netflow",
                        "api_endpoint_internal": f"{monitoring_url_internal}/api/netflow"
                    }
                }
            }
        }

    return router
