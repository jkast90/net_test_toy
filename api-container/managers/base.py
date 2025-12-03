"""
Base Manager - Provides shared Docker client and database access
"""
import docker
import logging
import os
import requests
from fastapi import HTTPException
from typing import Optional, List, Dict, Any, Tuple
from ..core.database import Database

logger = logging.getLogger("container-api")


class BaseManager:
    """Base class for all container management modules"""

    def __init__(self, client: Optional[docker.DockerClient] = None, db: Optional[Database] = None):
        """
        Initialize base manager with Docker client and database

        Args:
            client: Docker client instance (creates new if None)
            db: Database instance (creates new if None)
        """
        try:
            self.client = client or docker.from_env()
            self.db = db or Database()
            self.dynamic_compose_path = "/app/docker-compose.dynamic.yml"
            logger.info(f"[{self.__class__.__name__}] Initialized")
        except Exception as e:
            logger.error(f"[{self.__class__.__name__}] Failed to initialize: {e}")
            raise

    def get_public_host(self) -> str:
        """
        Get the public host address for external access (browser/frontend access).
        Uses environment variable PUBLIC_HOST or falls back to localhost.
        """
        return os.getenv("PUBLIC_HOST", "localhost")

    def get_daemon_api_host(self) -> str:
        """
        Get the host address for API calls to daemon containers.
        When running in Docker, use host.docker.internal.
        When running on host machine, use localhost.
        """
        # Check if we're running in Docker by looking for .dockerenv file
        if os.path.exists('/.dockerenv'):
            return "host.docker.internal"
        return os.getenv("DAEMON_API_HOST", "localhost")

    # =========================================================================
    # Container Network Utilities
    # =========================================================================

    def get_interface_by_mac(self, container, mac_address: str) -> Optional[str]:
        """
        Get interface name from a container by MAC address.

        Args:
            container: Docker container object
            mac_address: MAC address to look up

        Returns:
            Interface name (e.g., 'eth0') or None if not found
        """
        if not mac_address:
            return None

        try:
            cmd = f"sh -c 'ip -o link show | grep -i {mac_address}'"
            result = container.exec_run(cmd)
            if result.exit_code == 0:
                output = result.output.decode('utf-8').strip()
                # Parse: "16: eth2@if1922: ..."
                return output.split(':')[1].strip().split('@')[0]
        except Exception as e:
            logger.debug(f"[BaseManager] Could not get interface by MAC {mac_address}: {e}")

        return None

    def get_interface_ips(self, container, interface_name: str) -> List[str]:
        """
        Get all IPv4 addresses assigned to an interface.

        Args:
            container: Docker container object
            interface_name: Interface name (e.g., 'eth0')

        Returns:
            List of IP addresses with CIDR (e.g., ['10.0.1.2/24'])
        """
        ips = []
        try:
            cmd = f"ip -o addr show dev {interface_name}"
            result = container.exec_run(cmd)
            if result.exit_code == 0:
                output = result.output.decode('utf-8').strip()
                for line in output.split('\n'):
                    if 'inet ' in line and 'inet6' not in line:
                        ip_part = line.split('inet ')[1].split()[0]
                        ips.append(ip_part)
        except Exception as e:
            logger.debug(f"[BaseManager] Could not get IPs for {interface_name}: {e}")

        return ips

    def get_container_network_ips(self, container, network_info: Dict) -> List[str]:
        """
        Get all IP addresses for a container's network connection.
        Includes both primary Docker-assigned IP and any secondary IPs.

        Args:
            container: Docker container object
            network_info: Network info dict from container.attrs['NetworkSettings']['Networks'][name]

        Returns:
            List of IP addresses (may include CIDR notation for secondary IPs)
        """
        primary_ip = network_info.get('IPAddress', '')
        ips = [primary_ip] if primary_ip else []

        if container.status != 'running':
            return ips

        mac_address = network_info.get('MacAddress', '')
        interface_name = self.get_interface_by_mac(container, mac_address)

        if interface_name:
            all_ips = self.get_interface_ips(container, interface_name)
            if all_ips:
                ips = all_ips

        return ips

    def check_interface_has_ip(self, container, interface_name: str, ip_address: str) -> bool:
        """
        Check if an interface already has a specific IP assigned.

        Args:
            container: Docker container object
            interface_name: Interface name (e.g., 'eth0')
            ip_address: IP address to check (without CIDR)

        Returns:
            True if IP is already assigned to the interface
        """
        try:
            cmd = f"ip addr show dev {interface_name} | grep '{ip_address}/'"
            result = container.exec_run(cmd)
            return result.exit_code == 0
        except Exception:
            return False

    def add_secondary_ip(self, container, interface_name: str, ip_address: str,
                        prefix_len: str = "24") -> bool:
        """
        Add a secondary IP address to an interface.

        Args:
            container: Docker container object
            interface_name: Interface name (e.g., 'eth0')
            ip_address: IP address to add (without CIDR)
            prefix_len: CIDR prefix length (default: "24")

        Returns:
            True if IP was added successfully
        """
        try:
            cmd = f"ip addr add {ip_address}/{prefix_len} dev {interface_name}"
            result = container.exec_run(cmd)
            if result.exit_code == 0:
                logger.info(f"[BaseManager] Added IP {ip_address}/{prefix_len} to {interface_name}")
                return True
            else:
                logger.warning(f"[BaseManager] Failed to add IP {ip_address}/{prefix_len}: {result.output.decode()}")
        except Exception as e:
            logger.error(f"[BaseManager] Error adding secondary IP: {e}")

        return False

    def ensure_network_connection(self, container, network_name: str,
                                  ipv4_address: Optional[str] = None) -> Dict[str, Any]:
        """
        Ensure a container is connected to a network, reconnecting if necessary.

        Args:
            container: Docker container object
            network_name: Name of the Docker network
            ipv4_address: Optional IP address to assign

        Returns:
            Dict with 'connected', 'reconnected', 'action', and 'error' keys
        """
        result = {
            "network": network_name,
            "ip": ipv4_address,
            "action": None,
            "error": None
        }

        try:
            container.reload()
            current_networks = container.attrs.get('NetworkSettings', {}).get('Networks', {})

            if network_name in current_networks:
                network_info = current_networks[network_name]
                mac_address = network_info.get('MacAddress', '')

                # Check if interface actually exists inside container
                interface_name = self.get_interface_by_mac(container, mac_address)

                if not interface_name:
                    # Interface doesn't exist, need to reconnect
                    logger.warning(f"[BaseManager] Network '{network_name}' interface missing, reconnecting")
                    network_obj = self.client.networks.get(network_name)
                    network_obj.disconnect(container)

                    if ipv4_address:
                        network_obj.connect(container, ipv4_address=ipv4_address)
                    else:
                        network_obj.connect(container)

                    result["action"] = "reconnected"
                else:
                    # Interface exists, check if we need to add secondary IP
                    if ipv4_address and not self.check_interface_has_ip(container, interface_name, ipv4_address):
                        if self.add_secondary_ip(container, interface_name, ipv4_address):
                            result["action"] = "ip_added"
                        else:
                            result["action"] = "already_connected"
                    else:
                        result["action"] = "already_connected"
            else:
                # Not connected, connect now
                network_obj = self.client.networks.get(network_name)

                if ipv4_address:
                    network_obj.connect(container, ipv4_address=ipv4_address)
                else:
                    network_obj.connect(container)

                result["action"] = "connected"
                logger.info(f"[BaseManager] Connected to '{network_name}' with IP {ipv4_address}")

        except Exception as e:
            result["action"] = "error"
            result["error"] = str(e)
            logger.error(f"[BaseManager] Error ensuring network connection: {e}")

        return result

    def disconnect_extra_networks(self, container, allowed_networks: set) -> List[Dict[str, Any]]:
        """
        Disconnect container from networks not in the allowed set.

        Args:
            container: Docker container object
            allowed_networks: Set of network names that should remain connected

        Returns:
            List of dicts with 'network', 'action', and 'error' keys
        """
        results = []
        container.reload()
        current_networks = container.attrs.get('NetworkSettings', {}).get('Networks', {})

        for net_name in list(current_networks.keys()):
            if net_name not in allowed_networks:
                try:
                    network_obj = self.client.networks.get(net_name)
                    network_obj.disconnect(container)
                    results.append({
                        "network": net_name,
                        "action": "disconnected",
                        "error": None
                    })
                    logger.info(f"[BaseManager] Disconnected from extra network '{net_name}'")
                except Exception as e:
                    results.append({
                        "network": net_name,
                        "action": "disconnect_failed",
                        "error": str(e)
                    })
                    logger.warning(f"[BaseManager] Failed to disconnect from '{net_name}': {e}")

        return results

    # =========================================================================
    # Container Validation Utilities
    # =========================================================================

    def get_container_or_404(self, name: str) -> Any:
        """
        Get a container by name or raise HTTPException 404.

        Args:
            name: Container name

        Returns:
            Docker container object

        Raises:
            HTTPException: 404 if container not found
        """
        try:
            return self.client.containers.get(name)
        except docker.errors.NotFound:
            raise HTTPException(status_code=404, detail=f"Container '{name}' not found")

    def validate_container_type(self, container, expected_type: str, type_label: str = "netstream.type") -> None:
        """
        Validate that a container is of the expected type.

        Args:
            container: Docker container object
            expected_type: Expected value of the type label (e.g., 'daemon', 'host')
            type_label: Label key to check (default: 'netstream.type')

        Raises:
            HTTPException: 400 if container type doesn't match
        """
        actual_type = container.labels.get(type_label, "")
        if actual_type != expected_type:
            raise HTTPException(
                status_code=400,
                detail=f"Container '{container.name}' is not a netstream {expected_type}"
            )

    def require_running(self, container, name: str) -> None:
        """
        Require that a container is running.

        Args:
            container: Docker container object
            name: Container name (for error message)

        Raises:
            HTTPException: 400 if container is not running
        """
        if container.status != "running":
            raise HTTPException(
                status_code=400,
                detail=f"Container '{name}' must be running"
            )

    def get_container_api_port(self, container, internal_port: str = "5000/tcp") -> Optional[int]:
        """
        Get the host port mapping for a container's internal port.

        Args:
            container: Docker container object
            internal_port: Internal port to look up (default: '5000/tcp')

        Returns:
            Host port number or None if not mapped
        """
        container.reload()
        port_bindings = container.attrs.get('NetworkSettings', {}).get('Ports', {})
        if internal_port in port_bindings and port_bindings[internal_port]:
            return int(port_bindings[internal_port][0]['HostPort'])
        return None

    # =========================================================================
    # API Call Utilities
    # =========================================================================

    def call_container_api(
        self,
        container_name: str,
        endpoint: str,
        method: str = "POST",
        payload: Optional[Dict] = None,
        timeout: int = 10,
        use_internal: bool = True
    ) -> Dict[str, Any]:
        """
        Make an API call to a container's unified API.

        Args:
            container_name: Name of the container
            endpoint: API endpoint (e.g., '/neighbor/10.0.0.1')
            method: HTTP method (GET, POST, DELETE)
            payload: Request payload for POST/PUT
            timeout: Request timeout in seconds
            use_internal: If True, use container name for Docker DNS (default)
                         If False, use host port mapping

        Returns:
            Dict with 'success', 'status_code', 'data', and 'error' keys
        """
        result = {
            "success": False,
            "status_code": None,
            "data": None,
            "error": None
        }

        try:
            if use_internal:
                # Use Docker internal DNS
                api_url = f"http://{container_name}:5000{endpoint}"
            else:
                # Use host port mapping
                container = self.client.containers.get(container_name)
                api_port = self.get_container_api_port(container)
                if not api_port:
                    result["error"] = "No API port mapping found"
                    return result
                api_host = self.get_daemon_api_host()
                api_url = f"http://{api_host}:{api_port}{endpoint}"

            # Make the request
            if method.upper() == "GET":
                response = requests.get(api_url, timeout=timeout)
            elif method.upper() == "POST":
                response = requests.post(api_url, json=payload or {}, timeout=timeout)
            elif method.upper() == "DELETE":
                response = requests.delete(api_url, timeout=timeout)
            else:
                result["error"] = f"Unsupported HTTP method: {method}"
                return result

            result["status_code"] = response.status_code

            # 409 Conflict is often "already exists" - treat as success
            if response.status_code in [200, 201, 409]:
                result["success"] = True
                try:
                    result["data"] = response.json()
                except Exception:
                    result["data"] = response.text
            else:
                result["error"] = response.text or f"HTTP {response.status_code}"

        except requests.exceptions.RequestException as e:
            result["error"] = f"Request failed: {str(e)}"
        except Exception as e:
            result["error"] = str(e)

        return result

    # =========================================================================
    # GRE Tunnel Utilities
    # =========================================================================

    def restore_gre_tunnel(self, container, tunnel: Dict) -> Dict[str, Any]:
        """
        Restore a single GRE tunnel on a container.

        Args:
            container: Docker container object
            tunnel: Tunnel config dict with keys: tunnel_name, local_ip, remote_ip,
                   tunnel_ip, tunnel_network (optional), ttl (optional), gre_key (optional)

        Returns:
            Dict with 'success', 'tunnel_name', and 'error' keys
        """
        result = {
            "success": False,
            "tunnel_name": tunnel.get('tunnel_name'),
            "error": None
        }

        try:
            tunnel_name = tunnel['tunnel_name']

            # Check if tunnel already exists
            exit_code, _ = container.exec_run(f"ip link show {tunnel_name}")
            if exit_code == 0:
                result["success"] = True
                result["already_exists"] = True
                return result

            # Build GRE tunnel creation command
            cmd_parts = [
                f"ip tunnel add {tunnel_name} mode gre",
                f"local {tunnel['local_ip']}",
                f"remote {tunnel['remote_ip']}",
                f"ttl {tunnel.get('ttl', 64)}"
            ]

            if tunnel.get('gre_key') is not None:
                cmd_parts.append(f"key {tunnel['gre_key']}")

            create_cmd = " ".join(cmd_parts)

            # Execute commands to create and configure tunnel
            commands = [
                create_cmd,
                f"ip addr add {tunnel['tunnel_ip']}/{tunnel.get('tunnel_network', '30')} dev {tunnel_name}",
                f"ip link set {tunnel_name} up"
            ]

            for cmd in commands:
                exit_code, output = container.exec_run(f"sh -c '{cmd}'")
                if exit_code != 0:
                    error_msg = output.decode() if output else "Unknown error"
                    raise Exception(f"Command '{cmd}' failed: {error_msg}")

            result["success"] = True
            logger.info(f"[BaseManager] Restored tunnel '{tunnel_name}' on {container.name}")

        except Exception as e:
            result["error"] = str(e)
            logger.error(f"[BaseManager] Failed to restore tunnel '{tunnel.get('tunnel_name')}': {e}")

        return result

    def restore_gre_tunnels(self, container, container_name: str) -> List[Dict[str, Any]]:
        """
        Restore all GRE tunnels for a container from database.

        Args:
            container: Docker container object
            container_name: Name of the container

        Returns:
            List of result dicts from restore_gre_tunnel
        """
        results = []
        try:
            tunnels = self.db.list_gre_tunnels(container_name=container_name)
            logger.info(f"[BaseManager] Found {len(tunnels)} GRE tunnels for '{container_name}'")

            for tunnel in tunnels:
                result = self.restore_gre_tunnel(container, tunnel)
                results.append(result)

        except Exception as e:
            logger.error(f"[BaseManager] Failed to restore tunnels for '{container_name}': {e}")
            results.append({
                "success": False,
                "tunnel_name": None,
                "error": f"Failed to list tunnels: {str(e)}"
            })

        return results

    # =========================================================================
    # Management Network Utilities
    # =========================================================================

    def ensure_management_network(self, container, management_network: str) -> Dict[str, Any]:
        """
        Ensure container is connected to the management network, handling
        stale connections and conflicting routes.

        Args:
            container: Docker container object
            management_network: Name of the management network

        Returns:
            Dict with 'action' and 'error' keys
        """
        result = {
            "network": management_network,
            "action": None,
            "error": None
        }

        try:
            container.reload()
            current_networks = container.attrs.get('NetworkSettings', {}).get('Networks', {})

            if management_network in current_networks:
                network_info = current_networks[management_network]
                mac_address = network_info.get('MacAddress', '')

                # Check if interface actually exists
                if mac_address:
                    interface_name = self.get_interface_by_mac(container, mac_address)
                    if not interface_name:
                        # Interface missing, need to reconnect
                        logger.warning(f"[BaseManager] Management network interface missing, reconnecting")

                        # Clean up conflicting routes before reconnecting
                        self._clean_conflicting_routes(container, management_network)

                        # Disconnect and reconnect
                        network_obj = self.client.networks.get(management_network)
                        try:
                            network_obj.disconnect(container, force=True)
                        except Exception:
                            pass  # May fail if not really connected
                        network_obj.connect(container)
                        result["action"] = "reconnected"
                    else:
                        result["action"] = "already_connected"
                else:
                    result["action"] = "already_connected"
            else:
                # Not connected, connect now
                network_obj = self.client.networks.get(management_network)
                network_obj.connect(container)
                result["action"] = "connected"
                logger.info(f"[BaseManager] Connected {container.name} to management network")

        except Exception as e:
            result["action"] = "error"
            result["error"] = str(e)
            logger.error(f"[BaseManager] Failed to ensure management network: {e}")

        return result

    def _clean_conflicting_routes(self, container, network_name: str) -> None:
        """
        Remove routes that might conflict with a network's subnet.

        Args:
            container: Docker container object
            network_name: Name of the Docker network
        """
        try:
            import ipaddress

            network_obj = self.client.networks.get(network_name)
            subnet = network_obj.attrs.get('IPAM', {}).get('Config', [{}])[0].get('Subnet', '')

            if not subnet:
                return

            net = ipaddress.ip_network(subnet, strict=False)
            # Get first two octets for matching (e.g., "172.22")
            prefix = ".".join(net.network_address.compressed.split(".")[:2])

            # Find and remove conflicting routes
            cmd = f"ip route | grep '^{prefix}' || true"
            exit_code, output = container.exec_run(["sh", "-c", cmd])

            if exit_code == 0 and output:
                for line in output.decode().strip().split('\n'):
                    if line and ('blackhole' in line or '/32' in line):
                        route_dest = line.split()[1] if 'blackhole' in line else line.split()[0]
                        del_cmd = f"ip route del {route_dest}"
                        container.exec_run(["sh", "-c", del_cmd])
                        logger.debug(f"[BaseManager] Removed conflicting route '{route_dest}'")

        except Exception as e:
            logger.debug(f"[BaseManager] Error cleaning routes: {e}")

    # =========================================================================
    # Container Creation Utilities
    # =========================================================================

    def build_network_config(self, networks: List[Dict[str, str]]) -> Tuple[Optional[str], Dict]:
        """
        Build Docker networking configuration for container creation.

        Args:
            networks: List of dicts with 'name' and optionally 'ipv4_address' keys

        Returns:
            Tuple of (first_network_name, endpoint_config) for use with containers.create()
            The first network must be passed to containers.create(), additional networks
            must be connected after creation.
        """
        from docker.types import EndpointConfig, NetworkingConfig

        if not networks:
            return None, {}

        first_network = networks[0]
        network_name = first_network["name"]

        # Build endpoint config with optional IP
        endpoint_kwargs = {}
        if first_network.get("ipv4_address"):
            endpoint_kwargs["ipv4_address"] = first_network["ipv4_address"]

        endpoint_config = EndpointConfig(
            self.client.api._version,
            **endpoint_kwargs
        )

        networking_config = NetworkingConfig({
            network_name: endpoint_config
        })

        return network_name, {
            "network": network_name,
            "networking_config": networking_config
        }

    def connect_additional_networks(self, container, networks: List[Dict[str, str]], skip_first: bool = True) -> List[Dict]:
        """
        Connect a container to additional networks after creation.

        Args:
            container: Docker container object
            networks: List of dicts with 'name' and optionally 'ipv4_address' keys
            skip_first: If True, skip the first network (already connected at creation)

        Returns:
            List of connection result dicts
        """
        results = []
        networks_to_connect = networks[1:] if skip_first else networks

        for net_config in networks_to_connect:
            network_name = net_config["name"]
            ipv4_address = net_config.get("ipv4_address")

            try:
                network = self.client.networks.get(network_name)
                if ipv4_address:
                    network.connect(container, ipv4_address=ipv4_address)
                else:
                    network.connect(container)

                results.append({
                    "network": network_name,
                    "ip": ipv4_address,
                    "action": "connected"
                })
                logger.info(f"[BaseManager] Connected to '{network_name}' with IP {ipv4_address}")
            except Exception as e:
                results.append({
                    "network": network_name,
                    "action": "failed",
                    "error": str(e)
                })
                logger.warning(f"[BaseManager] Failed to connect to '{network_name}': {e}")

        return results
