"""
NetFlow Tap Manager
Creates and manages veth pair "tap" interfaces for traffic monitoring
Taps are tied to container + network (not interface directly)
"""
import logging
import docker
from typing import Optional, Dict, List
from .base import BaseManager

logger = logging.getLogger("container-api")


class TapManager(BaseManager):
    """Manages NetFlow tap containers with veth pair interfaces"""

    def __init__(self, client: docker.DockerClient, db=None):
        super().__init__(client, db)

    def _get_interface_for_network(self, container_name: str, network_name: str) -> Optional[str]:
        """
        Get the interface name in a container that is connected to a specific Docker network.

        Args:
            container_name: Name of the container
            network_name: Name of the Docker network

        Returns:
            Interface name (e.g., 'eth0', 'eth1') or None if not found
        """
        try:
            container = self.client.containers.get(container_name)

            # Get the network info for this container
            networks = container.attrs.get('NetworkSettings', {}).get('Networks', {})

            if network_name not in networks:
                logger.warning(f"[TapManager] Container '{container_name}' is not connected to network '{network_name}'")
                return None

            # Get the endpoint ID for this network
            endpoint_id = networks[network_name].get('EndpointID', '')
            if not endpoint_id:
                logger.warning(f"[TapManager] No endpoint ID for {container_name} on {network_name}")
                return None

            # Get all interfaces and their link indices
            result = container.exec_run("ip -o link show", demux=True)
            if result.exit_code != 0:
                logger.error(f"[TapManager] Failed to get interfaces in container '{container_name}'")
                return None

            stdout = result.output[0].decode('utf-8') if result.output[0] else ''

            # Parse interfaces - look for ones that match the network
            # Docker typically names interfaces ethN where N is the order they were attached
            # We need to match by checking the network's interface index

            # Get the interface index from Docker network inspect
            try:
                docker_network = self.client.networks.get(network_name)
                network_containers = docker_network.attrs.get('Containers', {})

                # Find our container in the network
                for container_id, container_info in network_containers.items():
                    if container_id.startswith(container.id) or container.id.startswith(container_id):
                        # Found our container in the network
                        # The container info might have the interface name or we need to match by IP
                        container_ip = networks[network_name].get('IPAddress')

                        # Find interface with this IP
                        result = container.exec_run(f"ip -o addr show", demux=True)
                        if result.exit_code == 0:
                            stdout = result.output[0].decode('utf-8') if result.output[0] else ''
                            for line in stdout.strip().split('\n'):
                                if container_ip and container_ip in line:
                                    # Extract interface name (second field)
                                    parts = line.split()
                                    if len(parts) >= 2:
                                        iface = parts[1].rstrip(':')
                                        logger.info(f"[TapManager] Found interface '{iface}' for {container_name} on {network_name} (IP: {container_ip})")
                                        return iface
                        break

            except Exception as e:
                logger.warning(f"[TapManager] Error inspecting network: {e}")

            # Fallback: Try to match by network name in container's network settings
            # This uses the order of network attachment
            sorted_networks = sorted(networks.keys())
            if network_name in sorted_networks:
                idx = sorted_networks.index(network_name)
                interface = f"eth{idx}"
                logger.info(f"[TapManager] Using fallback interface '{interface}' for {container_name} on {network_name}")
                return interface

            return None

        except docker.errors.NotFound:
            logger.error(f"[TapManager] Container '{container_name}' not found")
            return None
        except Exception as e:
            logger.error(f"[TapManager] Error getting interface for network: {e}")
            return None

    def create_tap(
        self,
        container_name: str,
        network_name: str,
        collector_ip: str,
        collector_port: int = 2055,
        netflow_version: int = 5
    ) -> Dict:
        """
        Create a NetFlow tap on a container's network connection.

        The tap container:
        1. Shares network namespace with target container (to see the interface)
        2. Sends flows to the collector via the topology's management network

        Args:
            container_name: Name of the container to tap (host or daemon)
            network_name: Name of the Docker network to tap
            collector_ip: NetFlow collector IP address
            collector_port: NetFlow collector port
            netflow_version: NetFlow version (5 or 9)

        Returns:
            Dict with tap information and status
        """
        try:
            # Resolve the interface from container + network
            interface = self._get_interface_for_network(container_name, network_name)
            if not interface:
                return {
                    "status": "error",
                    "message": f"Could not find interface for {container_name} on network '{network_name}'"
                }

            # Generate tap container name using network (more readable than interface)
            tap_name = f"tap-{container_name}-{network_name}"

            # Check if tap already exists
            existing_taps = self.list_taps(container_name)
            if any(tap['tap_name'] == tap_name for tap in existing_taps):
                return {
                    "status": "error",
                    "message": f"Tap already exists for {container_name} on {network_name}"
                }

            # Get target container
            try:
                target_container = self.client.containers.get(container_name)
            except docker.errors.NotFound:
                return {
                    "status": "error",
                    "message": f"Container '{container_name}' not found"
                }

            # Verify interface exists in target container
            check_cmd = f"ip link show {interface}"
            result = target_container.exec_run(check_cmd)
            if result.exit_code != 0:
                return {
                    "status": "error",
                    "message": f"Interface '{interface}' not found in container '{container_name}'"
                }

            logger.info(f"[TapManager] Creating tap container: {tap_name}")
            logger.info(f"[TapManager] Target: {container_name} on {network_name} (interface: {interface}), Collector: {collector_ip}:{collector_port}")

            # Create tap container sharing target's network namespace
            tap_container = self.client.containers.run(
                image="netflow-tap:latest",
                name=tap_name,
                detach=True,
                auto_remove=False,
                network_mode=f"container:{container_name}",  # Share network namespace
                cap_add=["NET_ADMIN", "NET_RAW"],  # Need for packet capture
                environment={
                    "COLLECTOR_IP": collector_ip,
                    "COLLECTOR_PORT": str(collector_port),
                    "TAP_INTERFACE": interface,
                    "NETFLOW_VERSION": str(netflow_version)
                },
                labels={
                    "netflow.tap": "true",
                    "netflow.target_container": container_name,
                    "netflow.target_network": network_name,
                    "netflow.target_interface": interface
                }
            )

            logger.info(f"[TapManager] Tap created successfully: {tap_name}")

            return {
                "status": "success",
                "tap_name": tap_name,
                "target_container": container_name,
                "target_network": network_name,
                "target_interface": interface,
                "collector": f"{collector_ip}:{collector_port}",
                "netflow_version": netflow_version,
                "method": "shared-namespace"
            }

        except Exception as e:
            logger.error(f"[TapManager] Failed to create tap: {e}", exc_info=True)
            # Clean up on failure
            try:
                self.client.containers.get(tap_name).remove(force=True)
            except:
                pass
            return {
                "status": "error",
                "message": str(e)
            }

    def delete_tap(self, container_name: str, network_name: str) -> Dict:
        """
        Delete a NetFlow tap

        Args:
            container_name: Name of the container being tapped
            network_name: Name of the network being tapped

        Returns:
            Dict with deletion status
        """
        try:
            tap_name = f"tap-{container_name}-{network_name}"

            # Get tap container
            try:
                tap_container = self.client.containers.get(tap_name)
            except docker.errors.NotFound:
                return {
                    "status": "error",
                    "message": f"Tap '{tap_name}' not found"
                }

            # Get the interface from the tap container's labels
            interface = tap_container.labels.get("netflow.target_interface")

            # Get target container to remove tc rules
            if interface:
                try:
                    target_container = self.client.containers.get(container_name)

                    # Remove tc rules (ignore errors if already removed)
                    target_container.exec_run(f"tc qdisc del dev {interface} handle ffff: ingress", demux=True)
                    target_container.exec_run(f"tc qdisc del dev {interface} handle 1: root", demux=True)

                except docker.errors.NotFound:
                    logger.warning(f"[TapManager] Target container '{container_name}' not found, skipping tc cleanup")
                except Exception as e:
                    logger.warning(f"[TapManager] Failed to remove tc rules: {e}")

            # Remove tap container (veth pair will be automatically cleaned up)
            logger.info(f"[TapManager] Removing tap container: {tap_name}")
            tap_container.remove(force=True)

            return {
                "status": "success",
                "message": f"Tap '{tap_name}' deleted successfully"
            }

        except Exception as e:
            logger.error(f"[TapManager] Failed to delete tap: {e}")
            return {
                "status": "error",
                "message": str(e)
            }

    def list_taps(self, container_name: Optional[str] = None) -> List[Dict]:
        """
        List all NetFlow taps, optionally filtered by container

        Args:
            container_name: Optional container name to filter by

        Returns:
            List of tap information dictionaries
        """
        try:
            filters = {"label": "netflow.tap=true"}
            if container_name:
                filters["label"] = [
                    "netflow.tap=true",
                    f"netflow.target_container={container_name}"
                ]

            tap_containers = self.client.containers.list(filters=filters, all=True)

            taps = []
            for container in tap_containers:
                labels = container.labels
                taps.append({
                    "tap_name": container.name,
                    "target_container": labels.get("netflow.target_container"),
                    "target_network": labels.get("netflow.target_network"),
                    "target_interface": labels.get("netflow.target_interface"),
                    "status": container.status,
                    "collector": f"{container.attrs['Config']['Env']}",
                    "created": container.attrs['Created']
                })

            return taps

        except Exception as e:
            logger.error(f"[TapManager] Failed to list taps: {e}")
            return []

    def get_tap_stats(self, container_name: str, network_name: str) -> Optional[Dict]:
        """
        Get statistics for a specific tap

        Args:
            container_name: Name of the container being tapped
            network_name: Name of the network being tapped

        Returns:
            Dict with tap statistics or None if tap not found
        """
        try:
            tap_name = f"tap-{container_name}-{network_name}"
            tap_container = self.client.containers.get(tap_name)

            # Get softflowd statistics
            result = tap_container.exec_run("softflowctl statistics")
            stats = result.output.decode('utf-8') if result.exit_code == 0 else "N/A"

            # Get the interface being tapped
            interface = tap_container.labels.get("netflow.target_interface", "unknown")

            # Get interface statistics
            result = tap_container.exec_run(f"ip -s link show {interface}")
            iface_stats = result.output.decode('utf-8') if result.exit_code == 0 else "N/A"

            return {
                "tap_name": tap_name,
                "target_network": network_name,
                "target_interface": interface,
                "status": tap_container.status,
                "softflowd_stats": stats,
                "interface_stats": iface_stats
            }

        except docker.errors.NotFound:
            return None
        except Exception as e:
            logger.error(f"[TapManager] Failed to get tap stats: {e}")
            return None

    def start_tap(self, container_name: str, network_name: str, collector_ip: str = None, collector_port: int = 2055, netflow_version: int = 5) -> Dict:
        """
        Start a tap container with idempotent behavior.
        - If container exists: ensure running, verify config matches DB
        - If container doesn't exist: create from database or provided params

        Args:
            container_name: Name of the container being tapped
            network_name: Name of the network being tapped
            collector_ip: Optional collector IP (will be looked up from DB or discovered)
            collector_port: Collector port (default 2055)
            netflow_version: NetFlow version (default 5)

        Returns:
            Dict with status information
        """
        try:
            tap_name = f"tap-{container_name}-{network_name}"

            # Try to get tap config from database (source of truth)
            tap_config = None
            if self.db:
                active_topology = self.db.get_active_topology()
                if active_topology:
                    tap_config = self.db.tap.get(
                        active_topology['name'],
                        container_name,
                        network_name
                    )

            # Use DB config if available, otherwise use provided params
            if tap_config:
                collector_ip = tap_config.get('collector_ip') or collector_ip
                collector_port = tap_config.get('collector_port', collector_port)
                netflow_version = tap_config.get('netflow_version', netflow_version)
                logger.info(f"[TapManager] Using tap config from database for {tap_name}")

            # Check if tap container exists
            tap_container = None
            needs_create = False

            try:
                tap_container = self.client.containers.get(tap_name)
            except docker.errors.NotFound:
                needs_create = True

            # If container exists, ensure it's running
            if tap_container and not needs_create:
                if tap_container.status == "running":
                    logger.info(f"[TapManager] Tap '{tap_name}' is already running")
                    return {
                        "status": "success",
                        "message": f"Tap '{tap_name}' is already running",
                        "tap_name": tap_name
                    }

                try:
                    logger.info(f"[TapManager] Starting tap container: {tap_name}")
                    tap_container.start()
                    return {
                        "status": "success",
                        "message": f"Tap '{tap_name}' started successfully",
                        "tap_name": tap_name
                    }
                except Exception as start_error:
                    # If start fails (e.g., orphaned network namespace), recreate
                    error_msg = str(start_error)
                    if "No such container" in error_msg or "network namespace" in error_msg:
                        logger.warning(f"[TapManager] Tap container orphaned, will recreate: {error_msg}")
                        needs_create = True
                        # Remove the orphaned container
                        try:
                            tap_container.remove(force=True)
                        except:
                            pass
                    else:
                        raise

            # Create the tap if needed
            if needs_create:
                # Get collector IP if not provided
                final_collector_ip = collector_ip or self._get_default_collector_ip(container_name)

                logger.info(f"[TapManager] Creating tap container: {tap_name}")
                return self.create_tap(
                    container_name=container_name,
                    network_name=network_name,
                    collector_ip=final_collector_ip,
                    collector_port=collector_port,
                    netflow_version=netflow_version
                )

            return {
                "status": "error",
                "message": f"Unexpected state for tap '{tap_name}'"
            }

        except Exception as e:
            logger.error(f"[TapManager] Failed to start tap: {e}")
            return {
                "status": "error",
                "message": str(e)
            }

    def _get_default_collector_ip(self, target_container_name: str = None) -> str:
        """
        Get the collector IP from the monitoring container that is reachable
        from the target container's network namespace.

        Uses the active topology's management_network from the database to find
        the correct network for communication.

        Args:
            target_container_name: Name of the container being tapped (to find common network)

        Returns:
            IP address of the monitoring container on the topology's management network
        """
        try:
            monitoring = self.client.containers.get("netstream-monitoring")
            monitoring_networks = monitoring.attrs.get('NetworkSettings', {}).get('Networks', {})

            # Get the active topology's management network from DB
            mgmt_network_name = None
            if self.db:
                active_topology = self.db.topology.get_active()
                if active_topology:
                    mgmt_network_name = active_topology.get('management_network')
                    logger.info(f"[TapManager] Active topology management_network: {mgmt_network_name}")

            # If we found a management network in the topology, use it
            if mgmt_network_name and mgmt_network_name in monitoring_networks:
                ip = monitoring_networks[mgmt_network_name].get('IPAddress')
                if ip:
                    logger.info(f"[TapManager] Using collector IP {ip} on topology management network '{mgmt_network_name}'")
                    return ip
                else:
                    logger.warning(f"[TapManager] Monitoring container has no IP on '{mgmt_network_name}'")

            # Fallback: If we have a target container, find a common network
            if target_container_name:
                try:
                    target = self.client.containers.get(target_container_name)
                    target_networks = target.attrs.get('NetworkSettings', {}).get('Networks', {})

                    # Find common networks between target and monitoring
                    common_networks = set(target_networks.keys()) & set(monitoring_networks.keys())

                    for net in common_networks:
                        ip = monitoring_networks[net].get('IPAddress')
                        if ip:
                            logger.info(f"[TapManager] Using collector IP {ip} on common network '{net}'")
                            return ip

                    logger.warning(f"[TapManager] No common network between {target_container_name} and monitoring")
                except docker.errors.NotFound:
                    pass

            # Last resort fallback: use first available network
            for net_name, net_info in monitoring_networks.items():
                ip = net_info.get('IPAddress')
                if ip:
                    logger.warning(f"[TapManager] Falling back to collector IP {ip} on '{net_name}'")
                    return ip

        except Exception as e:
            logger.error(f"[TapManager] Error getting collector IP: {e}")
        return "172.20.0.2"  # Absolute last fallback

    def stop_tap(self, container_name: str, network_name: str) -> Dict:
        """
        Stop a running tap container

        Args:
            container_name: Name of the container being tapped
            network_name: Name of the network being tapped

        Returns:
            Dict with status information
        """
        try:
            tap_name = f"tap-{container_name}-{network_name}"

            try:
                tap_container = self.client.containers.get(tap_name)
            except docker.errors.NotFound:
                return {
                    "status": "error",
                    "message": f"Tap '{tap_name}' not found"
                }

            if tap_container.status != "running":
                return {
                    "status": "success",
                    "message": f"Tap '{tap_name}' is already stopped",
                    "tap_name": tap_name
                }

            logger.info(f"[TapManager] Stopping tap container: {tap_name}")
            tap_container.stop()

            return {
                "status": "success",
                "message": f"Tap '{tap_name}' stopped successfully",
                "tap_name": tap_name
            }

        except Exception as e:
            logger.error(f"[TapManager] Failed to stop tap: {e}")
            return {
                "status": "error",
                "message": str(e)
            }
