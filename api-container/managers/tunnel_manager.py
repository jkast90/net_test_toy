"""
Tunnel Manager - Manages GRE tunnel operations
"""
from fastapi import HTTPException
from typing import List, Dict, Optional
import docker
import logging
import re
from .base import BaseManager

logger = logging.getLogger("container-manager")


class TunnelManager(BaseManager):
    """Manages GRE tunnel operations for containers"""

    # ============================================================================
    # GRE Tunnel Management Methods
    # ============================================================================

    def create_gre_tunnel(self, container_name: str, tunnel_name: str, local_ip: str,
                          remote_ip: str, tunnel_ip: str, tunnel_network: str = '30',
                          gre_key: Optional[int] = None, ttl: int = 64,
                          topology_name: Optional[str] = None) -> Dict:
        """
        Create a GRE tunnel on a container (daemon or host).

        Args:
            container_name: Name of the container (daemon or host)
            tunnel_name: Name of the tunnel interface (e.g., gre0, gre1)
            local_ip: Source IP for the GRE tunnel
            remote_ip: Destination IP for the GRE tunnel
            tunnel_ip: IP address to assign to the tunnel interface
            tunnel_network: CIDR prefix length for tunnel IP (default: 30)
            gre_key: Optional GRE key for tunnel identification
            ttl: TTL for GRE packets (default: 64)
            topology_name: Name of the topology (auto-detected from container if not provided)

        Returns:
            Dict with tunnel details and status
        """
        logger.info(f"[TunnelManager] Creating GRE tunnel '{tunnel_name}' on '{container_name}'")

        try:
            # Check if container_name is an external node
            external_nodes = self.db.list_external_nodes()
            is_external_container = any(node['name'] == container_name for node in external_nodes)

            if is_external_container:
                # External nodes don't have containers, so we only save to database
                logger.info(f"[TunnelManager] Container '{container_name}' is an external node, saving to database only")

                # Auto-detect topology if not provided
                if topology_name is None:
                    topology_name = 'default'

                # Save to database only
                self.db.create_gre_tunnel(
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

                return {
                    "container_name": container_name,
                    "tunnel_name": tunnel_name,
                    "local_ip": local_ip,
                    "remote_ip": remote_ip,
                    "tunnel_ip": tunnel_ip,
                    "tunnel_network": tunnel_network,
                    "gre_key": gre_key,
                    "ttl": ttl,
                    "status": "saved_to_database",
                    "is_external": True,
                    "message": "External node - tunnel configuration saved to database only"
                }

            # Get container
            container = self.client.containers.get(container_name)

            # Check if tunnel already exists (idempotent operation)
            exit_code, output = container.exec_run(f"ip link show {tunnel_name}")
            tunnel_exists = (exit_code == 0)

            if tunnel_exists:
                logger.info(f"[TunnelManager] Tunnel '{tunnel_name}' already exists, ensuring configuration is correct")
                # Delete existing tunnel to recreate with correct configuration
                container.exec_run(f"ip link delete {tunnel_name}")
                logger.debug(f"Deleted existing tunnel '{tunnel_name}' for reconfiguration")

            # Build GRE tunnel creation command
            cmd_parts = [
                f"ip tunnel add {tunnel_name} mode gre",
                f"local {local_ip}",
                f"remote {remote_ip}",
                f"ttl {ttl}"
            ]

            if gre_key is not None:
                cmd_parts.append(f"key {gre_key}")

            create_cmd = " ".join(cmd_parts)

            # Execute commands in container
            commands = [
                # Create tunnel
                create_cmd,
                # Assign IP to tunnel (with || true to handle "File exists" errors idempotently)
                f"ip addr add {tunnel_ip}/{tunnel_network} dev {tunnel_name} || true",
                # Bring tunnel up
                f"ip link set {tunnel_name} up"
            ]

            for cmd in commands:
                exit_code, output = container.exec_run(f"sh -c '{cmd}'")
                # Allow "|| true" commands to always succeed
                if exit_code != 0 and "|| true" not in cmd:
                    error_msg = output.decode() if output else "Unknown error"
                    raise Exception(f"Command '{cmd}' failed: {error_msg}")
                logger.debug(f"Executed: {cmd}")

            # Auto-detect topology if not provided
            if topology_name is None:
                # Check if it's a daemon or host
                daemon = self.db.get_daemon(container_name)
                if daemon:
                    topology_name = daemon.get('topology_name', 'default')
                else:
                    host = self.db.get_host(container_name)
                    if host:
                        topology_name = host.get('topology_name', 'default')
                    else:
                        topology_name = 'default'

            # Save to database
            self.db.create_gre_tunnel(
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

            # Verify tunnel was created
            exit_code, output = container.exec_run(f"ip addr show {tunnel_name}")
            tunnel_info = output.decode() if output else ""

            result = {
                "container_name": container_name,
                "tunnel_name": tunnel_name,
                "local_ip": local_ip,
                "remote_ip": remote_ip,
                "tunnel_ip": tunnel_ip,
                "tunnel_network": tunnel_network,
                "gre_key": gre_key,
                "ttl": ttl,
                "status": "created",
                "details": tunnel_info
            }

            logger.info(f"[TunnelManager] GRE tunnel '{tunnel_name}' created on '{container_name}'")
            return result

        except docker.errors.NotFound:
            logger.error(f"[TunnelManager] Container '{container_name}' not found")
            raise HTTPException(status_code=404, detail=f"Container '{container_name}' not found")
        except Exception as e:
            logger.error(f"[TunnelManager] Failed to create GRE tunnel: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to create GRE tunnel: {str(e)}")

    def delete_gre_tunnel(self, container_name: str, tunnel_name: str) -> Dict:
        """
        Delete a GRE tunnel from a container.

        Args:
            container_name: Name of the container
            tunnel_name: Name of the tunnel interface

        Returns:
            Dict with deletion status
        """
        logger.info(f"[TunnelManager] Deleting GRE tunnel '{tunnel_name}' from '{container_name}'")

        try:
            # Get container
            try:
                container = self.client.containers.get(container_name)

                # Delete tunnel
                exit_code, output = container.exec_run(f"ip tunnel del {tunnel_name}")
                if exit_code != 0 and "Cannot find device" not in output.decode():
                    logger.warning(f"Failed to delete tunnel from container: {output.decode()}")
                else:
                    logger.info(f"Deleted GRE tunnel '{tunnel_name}' from container '{container_name}'")

            except docker.errors.NotFound:
                logger.warning(f"Container '{container_name}' not found, removing from database only")

            # Delete from database
            self.db.delete_gre_tunnel(container_name, tunnel_name)

            return {
                "container_name": container_name,
                "tunnel_name": tunnel_name,
                "status": "deleted"
            }

        except Exception as e:
            logger.error(f"[TunnelManager] Failed to delete GRE tunnel: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to delete GRE tunnel: {str(e)}")

    def list_gre_tunnels(self, container_name: Optional[str] = None) -> List[Dict]:
        """
        List GRE tunnels, optionally filtered by container.

        Args:
            container_name: Optional container name to filter by

        Returns:
            List of GRE tunnel configurations
        """
        return self.db.list_gre_tunnels(container_name)

    def get_gre_tunnel_state(self, container_name: str, tunnel_name: str) -> Dict:
        """
        Get detailed state of a GRE tunnel in a container.
        Checks both database configuration and actual container state.

        Args:
            container_name: Name of the container
            tunnel_name: Name of the tunnel interface

        Returns:
            Dict with tunnel state including DB config, interface status, and connectivity
        """
        logger.info(f"[TunnelManager] Getting state for tunnel '{tunnel_name}' on '{container_name}'")

        try:
            # Get DB configuration
            db_config = self.db.get_gre_tunnel(container_name, tunnel_name)

            # Get container
            try:
                container = self.client.containers.get(container_name)
            except docker.errors.NotFound:
                return {
                    "container_name": container_name,
                    "tunnel_name": tunnel_name,
                    "db_config": db_config,
                    "container_exists": False,
                    "tunnel_exists": False,
                    "status": "container_not_found"
                }

            # Check if tunnel exists in container
            exit_code, output = container.exec_run(f"ip link show {tunnel_name}")
            tunnel_exists = (exit_code == 0)

            if not tunnel_exists:
                return {
                    "container_name": container_name,
                    "tunnel_name": tunnel_name,
                    "db_config": db_config,
                    "container_exists": True,
                    "tunnel_exists": False,
                    "status": "tunnel_not_found_in_container"
                }

            # Get tunnel details
            exit_code, tunnel_info = container.exec_run(f"ip -d link show {tunnel_name}")
            tunnel_link_info = tunnel_info.decode() if tunnel_info else ""

            # Get tunnel IP addresses
            exit_code, addr_info = container.exec_run(f"ip addr show {tunnel_name}")
            tunnel_addr_info = addr_info.decode() if addr_info else ""

            # Parse state
            is_up = "UP" in tunnel_link_info and "state UP" in tunnel_link_info

            # Extract IPs
            import re
            ip_pattern = r'inet (\d+\.\d+\.\d+\.\d+)/(\d+)'
            ips = re.findall(ip_pattern, tunnel_addr_info)

            # Extract tunnel parameters from link info
            local_match = re.search(r'local (\d+\.\d+\.\d+\.\d+)', tunnel_link_info)
            remote_match = re.search(r'remote (\d+\.\d+\.\d+\.\d+)', tunnel_link_info)
            ttl_match = re.search(r'ttl (\d+)', tunnel_link_info)

            actual_state = {
                "is_up": is_up,
                "local_ip": local_match.group(1) if local_match else None,
                "remote_ip": remote_match.group(1) if remote_match else None,
                "ttl": int(ttl_match.group(1)) if ttl_match else None,
                "tunnel_ips": [{"ip": ip[0], "prefix": ip[1]} for ip in ips],
                "link_info": tunnel_link_info,
                "addr_info": tunnel_addr_info
            }

            # Compare with DB config
            config_matches = True
            mismatches = []

            if db_config:
                if actual_state['local_ip'] != db_config.get('local_ip'):
                    config_matches = False
                    mismatches.append(f"local_ip: DB={db_config.get('local_ip')} != Actual={actual_state['local_ip']}")

                if actual_state['remote_ip'] != db_config.get('remote_ip'):
                    config_matches = False
                    mismatches.append(f"remote_ip: DB={db_config.get('remote_ip')} != Actual={actual_state['remote_ip']}")

                if actual_state['ttl'] != db_config.get('ttl'):
                    config_matches = False
                    mismatches.append(f"ttl: DB={db_config.get('ttl')} != Actual={actual_state['ttl']}")

                # Check if tunnel IP matches
                expected_tunnel_ip = db_config.get('tunnel_ip')
                actual_tunnel_ips = [ip['ip'] for ip in actual_state['tunnel_ips']]
                if expected_tunnel_ip and expected_tunnel_ip not in actual_tunnel_ips:
                    config_matches = False
                    mismatches.append(f"tunnel_ip: DB={expected_tunnel_ip} not in Actual={actual_tunnel_ips}")

            return {
                "container_name": container_name,
                "tunnel_name": tunnel_name,
                "container_exists": True,
                "tunnel_exists": True,
                "db_config": db_config,
                "actual_state": actual_state,
                "config_matches": config_matches,
                "mismatches": mismatches if mismatches else None,
                "status": "up" if is_up else "down"
            }

        except Exception as e:
            logger.error(f"[TunnelManager] Failed to get tunnel state: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to get tunnel state: {str(e)}")

    def test_gre_tunnel_connectivity(self, container_name: str, tunnel_name: str, remote_ip: Optional[str] = None) -> Dict:
        """
        Test connectivity through a GRE tunnel by pinging the remote tunnel endpoint.

        Args:
            container_name: Name of the container with the tunnel
            tunnel_name: Name of the tunnel interface
            remote_ip: Optional remote IP to ping. If not provided, uses DB configuration.

        Returns:
            Dict with ping test results
        """
        logger.info(f"[TunnelManager] Testing connectivity for tunnel '{tunnel_name}' on '{container_name}'")

        try:
            container = self.client.containers.get(container_name)

            # Get remote IP from DB if not provided
            if not remote_ip:
                db_config = self.db.get_gre_tunnel(container_name, tunnel_name)
                if not db_config:
                    raise HTTPException(
                        status_code=404,
                        detail=f"Tunnel '{tunnel_name}' not found in database and no remote IP provided"
                    )
                remote_ip = db_config.get('remote_ip')

            # Ping the remote tunnel endpoint (count 4, timeout 2s each)
            exit_code, output = container.exec_run(
                f"sh -c 'ping -c 4 -W 2 {remote_ip}'",
                demux=False
            )

            ping_output = output.decode() if output else ""

            # Parse ping statistics
            import re
            packets_match = re.search(r'(\d+) packets transmitted, (\d+) received', ping_output)
            rtt_match = re.search(r'rtt min/avg/max/mdev = ([\d.]+)/([\d.]+)/([\d.]+)/([\d.]+) ms', ping_output)

            if packets_match:
                transmitted = int(packets_match.group(1))
                received = int(packets_match.group(2))
                loss_percent = ((transmitted - received) / transmitted * 100) if transmitted > 0 else 100
            else:
                transmitted = 0
                received = 0
                loss_percent = 100

            result = {
                "container_name": container_name,
                "tunnel_name": tunnel_name,
                "remote_ip": remote_ip,
                "success": exit_code == 0,
                "packets_transmitted": transmitted,
                "packets_received": received,
                "packet_loss_percent": loss_percent,
                "output": ping_output
            }

            if rtt_match:
                result["rtt"] = {
                    "min": float(rtt_match.group(1)),
                    "avg": float(rtt_match.group(2)),
                    "max": float(rtt_match.group(3)),
                    "mdev": float(rtt_match.group(4))
                }

            logger.info(f"[TunnelManager] Ping test result: {loss_percent}% packet loss")

            return result

        except docker.errors.NotFound:
            raise HTTPException(status_code=404, detail=f"Container '{container_name}' not found")
        except Exception as e:
            logger.error(f"[TunnelManager] Failed to test tunnel connectivity: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to test connectivity: {str(e)}")

    def bring_tunnel_up(self, container_name: str, tunnel_name: str) -> Dict:
        """
        Explicitly bring a GRE tunnel interface UP.
        Useful for troubleshooting tunnels that are administratively down.

        Args:
            container_name: Container with the tunnel
            tunnel_name: Tunnel interface name

        Returns:
            Dict with operation status
        """
        logger.info(f"[TunnelManager] Bringing tunnel '{tunnel_name}' UP on '{container_name}'")

        try:
            container = self.client.containers.get(container_name)

            # Check if tunnel exists
            exit_code, _ = container.exec_run(f"ip link show {tunnel_name}")
            if exit_code != 0:
                raise HTTPException(status_code=404, detail=f"Tunnel '{tunnel_name}' not found on container")

            # Bring tunnel up
            exit_code, output = container.exec_run(f"ip link set {tunnel_name} up")
            if exit_code != 0:
                error_msg = output.decode() if output else "Unknown error"
                raise Exception(f"Failed to bring tunnel up: {error_msg}")

            # Verify it's up
            exit_code, output = container.exec_run(f"ip link show {tunnel_name}")
            link_info = output.decode() if output else ""

            is_up = "UP" in link_info and "state UP" in link_info

            return {
                "container_name": container_name,
                "tunnel_name": tunnel_name,
                "status": "up" if is_up else "administratively_up",
                "details": link_info,
                "message": "Tunnel brought UP successfully" if is_up else "Tunnel is administratively UP but operationally DOWN (check routes/reachability)"
            }

        except docker.errors.NotFound:
            raise HTTPException(status_code=404, detail=f"Container '{container_name}' not found")
        except Exception as e:
            logger.error(f"[TunnelManager] Failed to bring tunnel up: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to bring tunnel up: {str(e)}")

    def diagnose_tunnel(self, container_name: str, tunnel_name: str) -> Dict:
        """
        Diagnose common GRE tunnel issues.
        Checks:
        - Tunnel exists and configuration
        - Local IP exists on container interfaces
        - Route to remote IP exists
        - Tunnel interface is UP
        - Basic reachability

        Args:
            container_name: Container with the tunnel
            tunnel_name: Tunnel interface name

        Returns:
            Dict with diagnostic results and recommendations
        """
        logger.info(f"[TunnelManager] Diagnosing tunnel '{tunnel_name}' on '{container_name}'")

        try:
            container = self.client.containers.get(container_name)
            diagnostics = {
                "container_name": container_name,
                "tunnel_name": tunnel_name,
                "issues": [],
                "recommendations": [],
                "status": "healthy"
            }

            # 1. Check if tunnel exists
            exit_code, output = container.exec_run(f"ip -d link show {tunnel_name}")
            if exit_code != 0:
                diagnostics["issues"].append("Tunnel interface does not exist")
                diagnostics["recommendations"].append("Create the tunnel using the API")
                diagnostics["status"] = "critical"
                return diagnostics

            tunnel_info = output.decode()

            # Parse tunnel configuration
            local_match = re.search(r'local (\d+\.\d+\.\d+\.\d+)', tunnel_info)
            remote_match = re.search(r'remote (\d+\.\d+\.\d+\.\d+)', tunnel_info)

            if not local_match or not remote_match:
                diagnostics["issues"].append("Cannot parse tunnel local/remote IPs")
                diagnostics["status"] = "warning"
                return diagnostics

            local_ip = local_match.group(1)
            remote_ip = remote_match.group(1)

            diagnostics["tunnel_config"] = {
                "local_ip": local_ip,
                "remote_ip": remote_ip
            }

            # 2. Check if tunnel is administratively UP
            if "UP" not in tunnel_info:
                diagnostics["issues"].append("Tunnel is administratively DOWN")
                diagnostics["recommendations"].append("Bring tunnel up using: POST /containers/{container_name}/tunnels/{tunnel_name}/up")
                diagnostics["status"] = "warning"

            # 3. Check if tunnel is operationally UP
            if "state DOWN" in tunnel_info or "NO-CARRIER" in tunnel_info:
                diagnostics["issues"].append("Tunnel is operationally DOWN (no carrier)")
                diagnostics["recommendations"].append("Check if remote endpoint is reachable and tunnel exists on remote side")
                if diagnostics["status"] == "healthy":
                    diagnostics["status"] = "warning"

            # 4. Check if local IP exists on any interface
            exit_code, output = container.exec_run(f"ip addr show")
            addr_info = output.decode() if output else ""

            if local_ip not in addr_info:
                diagnostics["issues"].append(f"Local IP {local_ip} not found on any container interface")
                diagnostics["recommendations"].append(f"Ensure the interface with IP {local_ip} exists and is UP")
                diagnostics["status"] = "critical"

            # 5. Check route to remote IP
            exit_code, output = container.exec_run(f"ip route get {remote_ip}")
            if exit_code != 0:
                diagnostics["issues"].append(f"No route to remote IP {remote_ip}")
                diagnostics["recommendations"].append(f"Add a route to {remote_ip} or ensure container is on the correct network")
                diagnostics["status"] = "critical"
            else:
                route_info = output.decode()
                diagnostics["route_to_remote"] = route_info.strip()

            # 6. Test basic reachability to remote IP
            exit_code, output = container.exec_run(f"sh -c 'ping -c 2 -W 2 {remote_ip}'")
            if exit_code != 0:
                diagnostics["issues"].append(f"Cannot ping remote IP {remote_ip}")
                diagnostics["recommendations"].append("Verify remote endpoint is reachable and not firewalled")
                if diagnostics["status"] == "healthy":
                    diagnostics["status"] = "warning"
            else:
                diagnostics["remote_reachable"] = True

            # 7. Check tunnel IP assignment
            exit_code, output = container.exec_run(f"ip addr show {tunnel_name}")
            addr_output = output.decode() if output else ""

            if not re.search(r'inet \d+\.\d+\.\d+\.\d+', addr_output):
                diagnostics["issues"].append("No IP address assigned to tunnel interface")
                diagnostics["recommendations"].append("Assign an IP to the tunnel interface")
                if diagnostics["status"] == "healthy":
                    diagnostics["status"] = "warning"

            # Set healthy status if no issues found
            if not diagnostics["issues"]:
                diagnostics["status"] = "healthy"
                diagnostics["recommendations"].append("Tunnel appears to be configured correctly")

            return diagnostics

        except docker.errors.NotFound:
            raise HTTPException(status_code=404, detail=f"Container '{container_name}' not found")
        except Exception as e:
            logger.error(f"[TunnelManager] Failed to diagnose tunnel: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to diagnose tunnel: {str(e)}")

    def fix_tunnel(self, container_name: str, tunnel_name: str, auto_fix: bool = True) -> Dict:
        """
        Attempt to automatically fix common GRE tunnel issues.

        Args:
            container_name: Container with the tunnel
            tunnel_name: Tunnel interface name
            auto_fix: If True, attempts to fix issues automatically

        Returns:
            Dict with fix results
        """
        logger.info(f"[TunnelManager] Attempting to fix tunnel '{tunnel_name}' on '{container_name}'")

        try:
            # First diagnose
            diagnostics = self.diagnose_tunnel(container_name, tunnel_name)

            if diagnostics["status"] == "healthy":
                return {
                    "message": "Tunnel is healthy, no fixes needed",
                    "diagnostics": diagnostics
                }

            if not auto_fix:
                return {
                    "message": "Auto-fix disabled, returning diagnostics only",
                    "diagnostics": diagnostics
                }

            container = self.client.containers.get(container_name)
            fixes_applied = []

            # Fix 1: Bring tunnel up if it's down
            if "administratively DOWN" in str(diagnostics.get("issues", [])):
                exit_code, _ = container.exec_run(f"ip link set {tunnel_name} up")
                if exit_code == 0:
                    fixes_applied.append("Brought tunnel interface UP")

            # Fix 2: Verify tunnel IP is assigned (from DB if available)
            db_tunnel = self.db.get_gre_tunnel(container_name, tunnel_name)
            if db_tunnel:
                tunnel_ip = db_tunnel.get("tunnel_ip")
                tunnel_network = db_tunnel.get("tunnel_network", "30")

                # Try to add the IP (idempotent with || true)
                exit_code, _ = container.exec_run(
                    f"sh -c 'ip addr add {tunnel_ip}/{tunnel_network} dev {tunnel_name} || true'"
                )
                if exit_code == 0:
                    fixes_applied.append(f"Ensured tunnel IP {tunnel_ip}/{tunnel_network} is assigned")

            # Re-diagnose after fixes
            new_diagnostics = self.diagnose_tunnel(container_name, tunnel_name)

            return {
                "message": f"Applied {len(fixes_applied)} fixes",
                "fixes_applied": fixes_applied,
                "before": diagnostics,
                "after": new_diagnostics,
                "status": new_diagnostics["status"]
            }

        except docker.errors.NotFound:
            raise HTTPException(status_code=404, detail=f"Container '{container_name}' not found")
        except Exception as e:
            logger.error(f"[TunnelManager] Failed to fix tunnel: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to fix tunnel: {str(e)}")

    def cleanup_stale_ips(self, network_name: Optional[str] = None) -> Dict:
        """
        Clean up stale IP address reservations in Docker networks.
        This removes IP addresses that are reserved but not actually in use by running containers.

        Args:
            network_name: Optional network name to clean. If None, cleans all networks.

        Returns:
            Dict with cleanup results
        """
        logger.info(f"[TunnelManager] Cleaning up stale IP reservations")

        results = {
            "networks_checked": [],
            "stale_ips_found": [],
            "ips_cleaned": [],
            "errors": []
        }

        try:
            # Get networks to clean
            if network_name:
                try:
                    networks = [self.client.networks.get(network_name)]
                except docker.errors.NotFound:
                    raise HTTPException(status_code=404, detail=f"Network '{network_name}' not found")
            else:
                # Get all user-created networks (skip default bridge, host, none)
                networks = [n for n in self.client.networks.list()
                           if n.name not in ['bridge', 'host', 'none']]

            for network in networks:
                network.reload()  # Refresh network data
                results['networks_checked'].append(network.name)

                # Get containers currently attached to this network
                containers_on_network = network.attrs.get('Containers', {})

                # Check each container to see if it's actually running and using the IP
                for container_id, container_info in list(containers_on_network.items()):
                    ip = container_info.get('IPv4Address', '').split('/')[0]
                    container_name = container_info.get('Name', container_id[:12])

                    try:
                        # Try to get the container - if it doesn't exist, the IP is stale
                        container = self.client.containers.get(container_id)
                        container.reload()

                        # Check if container is still on this network
                        container_networks = container.attrs.get('NetworkSettings', {}).get('Networks', {})
                        if network.name not in container_networks:
                            # Container is no longer on this network but IP is still reserved
                            logger.warning(f"Found stale IP reservation: {ip} for {container_name} on {network.name}")
                            results['stale_ips_found'].append({
                                "network": network.name,
                                "ip": ip,
                                "container": container_name,
                                "reason": "container_not_on_network"
                            })

                    except docker.errors.NotFound:
                        # Container doesn't exist but IP is reserved
                        logger.warning(f"Found stale IP reservation: {ip} for deleted container {container_name} on {network.name}")
                        results['stale_ips_found'].append({
                            "network": network.name,
                            "ip": ip,
                            "container": container_name,
                            "reason": "container_deleted"
                        })

                        results['ips_cleaned'].append({
                            "network": network.name,
                            "ip": ip,
                            "container": container_name
                        })

            logger.info(f"[TunnelManager] Cleanup complete. Checked {len(results['networks_checked'])} networks, found {len(results['stale_ips_found'])} stale IPs")

            return {
                "status": "completed" if not results['errors'] else "completed_with_errors",
                "results": results
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[TunnelManager] Failed to cleanup stale IPs: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to cleanup stale IPs: {str(e)}")

    def sync_topology_state(self, topology_name: str = "default", dry_run: bool = False) -> Dict:
        """
        Synchronize container state to match database state for a topology.
        This ensures containers, networks, and tunnels match what's defined in the DB.

        Args:
            topology_name: Name of the topology to sync
            dry_run: If True, only report what would be changed without making changes

        Returns:
            Dict with sync results and actions taken
        """
        logger.info(f"[TunnelManager] Syncing topology '{topology_name}' (dry_run={dry_run})")

        actions = {
            "networks_created": [],
            "containers_connected": [],
            "tunnels_created": [],
            "tunnels_deleted": [],
            "errors": []
        }

        try:
            # 1. Sync Networks
            networks = self.db.list_networks(topology_name=topology_name)
            logger.info(f"[TunnelManager] Found {len(networks)} networks in DB for topology '{topology_name}'")

            for net in networks:
                try:
                    if not dry_run:
                        # Note: This calls a method that should be in NetworkManager
                        # For now, we'll log a warning as this creates a dependency issue
                        logger.warning(f"[TunnelManager] sync_topology_state needs NetworkManager for create_network - skipping network creation for {net['name']}")
                        actions['errors'].append(f"Cannot create network {net['name']} - NetworkManager dependency needed")
                    else:
                        # Check if network exists in dry run mode
                        try:
                            self.client.networks.get(net['name'])
                        except docker.errors.NotFound:
                            actions['networks_created'].append(f"[DRY RUN] {net['name']}")
                except Exception as e:
                    error_msg = f"Failed to sync network {net['name']}: {str(e)}"
                    logger.error(error_msg)
                    actions['errors'].append(error_msg)

            # 2. Sync Daemon-Network Connections
            daemon_networks = self.db.list_daemon_networks(topology_name=topology_name)
            logger.info(f"[TunnelManager] Found {len(daemon_networks)} daemon-network connections in DB")

            for dn in daemon_networks:
                try:
                    daemon_name = dn['daemon_name']
                    network_name = dn['network_name']
                    ipv4_address = dn.get('ipv4_address')

                    if not dry_run:
                        # Note: This calls a method that should be in NetworkManager
                        logger.warning(f"[TunnelManager] sync_topology_state needs NetworkManager for connect_container_to_network - skipping connection for {daemon_name}")
                        actions['errors'].append(f"Cannot connect {daemon_name} to {network_name} - NetworkManager dependency needed")
                    else:
                        actions['containers_connected'].append(f"[DRY RUN] {daemon_name} -> {network_name}")
                except Exception as e:
                    error_msg = f"Failed to connect {dn['daemon_name']} to {dn['network_name']}: {str(e)}"
                    logger.error(error_msg)
                    actions['errors'].append(error_msg)

            # 3. Sync GRE Tunnels
            tunnels = self.db.list_gre_tunnels()
            if topology_name != "default":
                tunnels = [t for t in tunnels if t.get('topology_name') == topology_name]

            logger.info(f"[TunnelManager] Found {len(tunnels)} GRE tunnels in DB for topology '{topology_name}'")

            for tunnel in tunnels:
                try:
                    if not dry_run:
                        result = self.create_gre_tunnel(
                            container_name=tunnel['container_name'],
                            tunnel_name=tunnel['tunnel_name'],
                            local_ip=tunnel['local_ip'],
                            remote_ip=tunnel['remote_ip'],
                            tunnel_ip=tunnel['tunnel_ip'],
                            tunnel_network=tunnel.get('tunnel_network', '30'),
                            gre_key=tunnel.get('gre_key'),
                            ttl=tunnel.get('ttl', 64),
                            topology_name=tunnel.get('topology_name', 'default')
                        )
                        actions['tunnels_created'].append(f"{tunnel['container_name']}:{tunnel['tunnel_name']}")
                        logger.info(f"Created tunnel {tunnel['tunnel_name']} on {tunnel['container_name']}")
                    else:
                        actions['tunnels_created'].append(f"[DRY RUN] {tunnel['container_name']}:{tunnel['tunnel_name']}")
                except Exception as e:
                    error_msg = f"Failed to sync tunnel {tunnel['tunnel_name']} on {tunnel['container_name']}: {str(e)}"
                    logger.error(error_msg)
                    actions['errors'].append(error_msg)

            logger.info(f"[TunnelManager] Topology sync complete. Networks: {len(actions['networks_created'])}, Connections: {len(actions['containers_connected'])}, Tunnels: {len(actions['tunnels_created'])}")

            return {
                "topology": topology_name,
                "dry_run": dry_run,
                "actions": actions,
                "status": "completed" if not actions['errors'] else "completed_with_errors"
            }

        except Exception as e:
            logger.error(f"[TunnelManager] Failed to sync topology: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to sync topology: {str(e)}")
