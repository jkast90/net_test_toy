"""
Utility Functions for Container Management API
"""
import logging


logger = logging.getLogger("container-api")


def discover_monitoring_services(client, base_host: str):
    """
    Discover BMP and NetFlow monitoring services using Docker API
    Returns discovered service URL and ports (UI uses proxy routes, not direct endpoints)

    Args:
        client: Docker client instance
        base_host: Base hostname for constructing URLs

    Returns:
        Dict with monitoring service information or None if discovery fails
    """
    try:
        # Find monitoring containers
        monitoring_info = {
            "url": None,
            "bmp_tcp_port": None,
            "netflow_udp_port": None
        }

        # Look for containers with "monitoring" in their name
        containers = client.containers.list()

        for container in containers:
            container_name = container.name.lower()

            # Check if this is a monitoring container
            if "monitoring" in container_name:
                # Get port mappings
                port_mappings = container.attrs.get("NetworkSettings", {}).get("Ports", {})

                # Extract HTTP API port (usually 5002)
                http_port = None
                for port_spec, bindings in port_mappings.items():
                    if bindings and "/tcp" in port_spec:
                        port_num = int(port_spec.split("/")[0])
                        if port_num == 5002:
                            http_port = bindings[0]["HostPort"] if bindings else None
                            break

                # Use container name for internal Docker communication instead of localhost
                # This allows the container manager to communicate with monitoring service
                # via Docker's internal DNS resolution
                if http_port:
                    # For container-to-container: use container name and internal port
                    monitoring_info["url"] = f"http://{container.name}:5002"

                # Extract BMP TCP port (usually 11019)
                for port_spec, bindings in port_mappings.items():
                    if bindings and "/tcp" in port_spec:
                        port_num = int(port_spec.split("/")[0])
                        if port_num == 11019:
                            monitoring_info["bmp_tcp_port"] = int(bindings[0]["HostPort"])
                            break

                # Extract NetFlow UDP port (usually 2055)
                for port_spec, bindings in port_mappings.items():
                    if bindings and "/udp" in port_spec:
                        port_num = int(port_spec.split("/")[0])
                        if port_num == 2055:
                            monitoring_info["netflow_udp_port"] = int(bindings[0]["HostPort"])
                            break

                # Found monitoring container, no need to check others
                logger.info(f"Discovered monitoring service in container: {container.name}")
                logger.info(f"  - HTTP API: {monitoring_info['url']}")
                logger.info(f"  - BMP TCP port: {monitoring_info['bmp_tcp_port']}")
                logger.info(f"  - NetFlow UDP port: {monitoring_info['netflow_udp_port']}")
                break

        return monitoring_info

    except Exception as e:
        logger.error(f"Failed to discover monitoring services: {e}")
        # Return None to indicate discovery failed
        return None
