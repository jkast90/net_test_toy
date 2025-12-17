"""
IPsec Manager - Manages StrongSwan IPsec tunnel operations
"""
from fastapi import HTTPException
from typing import List, Dict, Optional
import docker
import logging
import re
import secrets
from .base import BaseManager

logger = logging.getLogger("container-manager")


class IPsecManager(BaseManager):
    """Manages StrongSwan IPsec tunnel operations for containers"""

    def _generate_psk(self, length: int = 32) -> str:
        """Generate a secure pre-shared key"""
        return secrets.token_urlsafe(length)

    def _generate_swanctl_config(self, tunnel_name: str, local_ip: str, remote_ip: str,
                                  tunnel_ip: str, tunnel_network: str, psk: str,
                                  ike_version: int = 2,
                                  ike_cipher: str = "aes256-sha256-modp2048",
                                  esp_cipher: str = "aes256-sha256",
                                  ike_lifetime: int = 86400, sa_lifetime: int = 3600,
                                  dpd_delay: int = 30, dpd_timeout: int = 120) -> str:
        """Generate swanctl.conf configuration for a tunnel"""
        config = f"""connections {{
    {tunnel_name} {{
        version = {ike_version}
        local_addrs = {local_ip}
        remote_addrs = {remote_ip}

        local {{
            auth = psk
            id = {local_ip}
        }}
        remote {{
            auth = psk
            id = {remote_ip}
        }}

        children {{
            {tunnel_name}-child {{
                local_ts = {tunnel_ip}/{tunnel_network}
                remote_ts = 0.0.0.0/0
                esp_proposals = {esp_cipher}
                start_action = start
                dpd_action = restart
            }}
        }}

        proposals = {ike_cipher}
        dpd_delay = {dpd_delay}s
        rekey_time = {ike_lifetime}s
    }}
}}

secrets {{
    ike-{tunnel_name} {{
        id = {remote_ip}
        secret = "{psk}"
    }}
}}
"""
        return config

    def _generate_ipsec_conf(self, tunnel_name: str, local_ip: str, remote_ip: str,
                             tunnel_ip: str, remote_tunnel_ip: str,
                             psk: str, ike_version: int = 2) -> str:
        """Generate ipsec.conf configuration (legacy format)"""
        config = f"""conn {tunnel_name}
    type=tunnel
    keyexchange=ikev{ike_version}
    left={local_ip}
    leftid={local_ip}
    leftsubnet={tunnel_ip}/32
    right={remote_ip}
    rightid={remote_ip}
    rightsubnet={remote_tunnel_ip}/32
    authby=secret
    auto=start
    ike=aes256-sha256-modp2048!
    esp=aes256-sha256!
    dpdaction=restart
    dpddelay=30s
    dpdtimeout=120s
"""
        return config

    def create_ipsec_tunnel(self, container_name: str, tunnel_name: str, local_ip: str,
                            remote_ip: str, tunnel_ip: str, tunnel_network: str = '30',
                            psk: Optional[str] = None, ike_version: int = 2,
                            ike_cipher: str = "aes256-sha256-modp2048",
                            esp_cipher: str = "aes256-sha256",
                            topology_name: Optional[str] = None) -> Dict:
        """
        Create an IPsec tunnel on a container using StrongSwan.

        Args:
            container_name: Name of the container (daemon or host)
            tunnel_name: Name of the IPsec connection
            local_ip: Source IP for the IPsec tunnel
            remote_ip: Destination IP for the IPsec tunnel
            tunnel_ip: IP address to assign to the VTI interface
            tunnel_network: CIDR prefix length for tunnel IP (default: 30)
            psk: Pre-shared key (auto-generated if not provided)
            ike_version: IKE version (1 or 2, default: 2)
            ike_cipher: IKE cipher suite
            esp_cipher: ESP cipher suite
            topology_name: Name of the topology

        Returns:
            Dict with tunnel details and status
        """
        logger.info(f"[IPsecManager] Creating IPsec tunnel '{tunnel_name}' on '{container_name}'")

        # Generate PSK if not provided
        if psk is None:
            psk = self._generate_psk()
            logger.info(f"[IPsecManager] Generated PSK for tunnel '{tunnel_name}'")

        try:
            # Check if container_name is an external node
            external_nodes = self.db.list_external_nodes()
            is_external_container = any(node['name'] == container_name for node in external_nodes)

            if is_external_container:
                logger.info(f"[IPsecManager] Container '{container_name}' is an external node, saving to database only")

                if topology_name is None:
                    topology_name = 'default'

                self.db.create_ipsec_tunnel(
                    container_name=container_name,
                    tunnel_name=tunnel_name,
                    local_ip=local_ip,
                    remote_ip=remote_ip,
                    tunnel_ip=tunnel_ip,
                    tunnel_network=tunnel_network,
                    psk=psk,
                    ike_version=ike_version,
                    ike_cipher=ike_cipher,
                    esp_cipher=esp_cipher,
                    topology_name=topology_name
                )

                return {
                    "container_name": container_name,
                    "tunnel_name": tunnel_name,
                    "local_ip": local_ip,
                    "remote_ip": remote_ip,
                    "tunnel_ip": tunnel_ip,
                    "tunnel_network": tunnel_network,
                    "psk": psk,
                    "status": "saved_to_database",
                    "is_external": True,
                    "message": "External node - tunnel configuration saved to database only"
                }

            # Get container
            container = self.client.containers.get(container_name)

            # Check if StrongSwan is installed
            exit_code, output = container.exec_run("which ipsec")
            if exit_code != 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"StrongSwan not installed on container '{container_name}'. Install with: apt-get install strongswan"
                )

            # Generate configuration
            ipsec_secrets = f'{local_ip} {remote_ip} : PSK "{psk}"\n'

            # Write secrets file
            exit_code, output = container.exec_run(
                f"sh -c 'echo \"{ipsec_secrets}\" >> /etc/ipsec.secrets'"
            )
            if exit_code != 0:
                logger.warning(f"Failed to write ipsec.secrets: {output.decode()}")

            # Generate and write ipsec.conf
            # Calculate remote tunnel IP (assume next IP in /30)
            tunnel_ip_parts = tunnel_ip.split('.')
            last_octet = int(tunnel_ip_parts[3])
            remote_tunnel_ip = '.'.join(tunnel_ip_parts[:3] + [str(last_octet + 1 if last_octet % 2 == 0 else last_octet - 1)])

            ipsec_conf = self._generate_ipsec_conf(
                tunnel_name, local_ip, remote_ip, tunnel_ip, remote_tunnel_ip,
                psk, ike_version
            )

            # Append to ipsec.conf
            exit_code, output = container.exec_run(
                f"sh -c 'cat >> /etc/ipsec.conf << \"EOF\"\n{ipsec_conf}\nEOF'"
            )
            if exit_code != 0:
                error_msg = output.decode() if output else "Unknown error"
                raise Exception(f"Failed to write ipsec.conf: {error_msg}")

            # Create VTI interface for route-based VPN
            vti_name = f"vti-{tunnel_name[:8]}"
            commands = [
                f"ip tunnel add {vti_name} mode vti local {local_ip} remote {remote_ip} key 100",
                f"ip addr add {tunnel_ip}/{tunnel_network} dev {vti_name}",
                f"ip link set {vti_name} up",
                "sysctl -w net.ipv4.conf.all.forwarding=1",
                f"sysctl -w net.ipv4.conf.{vti_name}.disable_policy=1",
                f"sysctl -w net.ipv4.conf.{vti_name}.rp_filter=0"
            ]

            for cmd in commands:
                exit_code, output = container.exec_run(f"sh -c '{cmd} 2>/dev/null || true'")
                logger.debug(f"Executed: {cmd}")

            # Reload IPsec configuration
            exit_code, output = container.exec_run("ipsec reload")
            if exit_code != 0:
                # Try restarting if reload fails
                container.exec_run("ipsec restart")
                logger.info("IPsec service restarted")

            # Start the connection
            exit_code, output = container.exec_run(f"ipsec up {tunnel_name}")
            ipsec_output = output.decode() if output else ""

            # Auto-detect topology if not provided
            if topology_name is None:
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
            self.db.create_ipsec_tunnel(
                container_name=container_name,
                tunnel_name=tunnel_name,
                local_ip=local_ip,
                remote_ip=remote_ip,
                tunnel_ip=tunnel_ip,
                tunnel_network=tunnel_network,
                psk=psk,
                ike_version=ike_version,
                ike_cipher=ike_cipher,
                esp_cipher=esp_cipher,
                topology_name=topology_name
            )

            # Get tunnel status
            exit_code, status_output = container.exec_run(f"ipsec status {tunnel_name}")
            status_info = status_output.decode() if status_output else ""

            result = {
                "container_name": container_name,
                "tunnel_name": tunnel_name,
                "vti_interface": vti_name,
                "local_ip": local_ip,
                "remote_ip": remote_ip,
                "tunnel_ip": tunnel_ip,
                "tunnel_network": tunnel_network,
                "psk": psk,
                "ike_version": ike_version,
                "status": "created",
                "ipsec_output": ipsec_output,
                "status_info": status_info
            }

            logger.info(f"[IPsecManager] IPsec tunnel '{tunnel_name}' created on '{container_name}'")
            return result

        except docker.errors.NotFound:
            logger.error(f"[IPsecManager] Container '{container_name}' not found")
            raise HTTPException(status_code=404, detail=f"Container '{container_name}' not found")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[IPsecManager] Failed to create IPsec tunnel: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to create IPsec tunnel: {str(e)}")

    def delete_ipsec_tunnel(self, container_name: str, tunnel_name: str) -> Dict:
        """
        Delete an IPsec tunnel from a container.

        Args:
            container_name: Name of the container
            tunnel_name: Name of the IPsec connection

        Returns:
            Dict with deletion status
        """
        logger.info(f"[IPsecManager] Deleting IPsec tunnel '{tunnel_name}' from '{container_name}'")

        try:
            try:
                container = self.client.containers.get(container_name)

                # Bring down the connection
                container.exec_run(f"ipsec down {tunnel_name}")

                # Remove VTI interface
                vti_name = f"vti-{tunnel_name[:8]}"
                container.exec_run(f"ip tunnel del {vti_name}")

                # Note: We don't remove config from files as it would require parsing
                # The connection will simply not be used anymore
                logger.info(f"Deleted IPsec tunnel '{tunnel_name}' from container '{container_name}'")

            except docker.errors.NotFound:
                logger.warning(f"Container '{container_name}' not found, removing from database only")

            # Delete from database
            self.db.delete_ipsec_tunnel(container_name, tunnel_name)

            return {
                "container_name": container_name,
                "tunnel_name": tunnel_name,
                "status": "deleted"
            }

        except Exception as e:
            logger.error(f"[IPsecManager] Failed to delete IPsec tunnel: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to delete IPsec tunnel: {str(e)}")

    def list_ipsec_tunnels(self, container_name: Optional[str] = None) -> List[Dict]:
        """
        List IPsec tunnels, optionally filtered by container.

        Args:
            container_name: Optional container name to filter by

        Returns:
            List of IPsec tunnel configurations
        """
        return self.db.list_ipsec_tunnels(container_name)

    def get_ipsec_tunnel_state(self, container_name: str, tunnel_name: str) -> Dict:
        """
        Get detailed state of an IPsec tunnel in a container.

        Args:
            container_name: Name of the container
            tunnel_name: Name of the IPsec connection

        Returns:
            Dict with tunnel state including IKE SA, Child SA, and connectivity status
        """
        logger.info(f"[IPsecManager] Getting state for IPsec tunnel '{tunnel_name}' on '{container_name}'")

        try:
            # Get DB configuration
            db_config = self.db.get_ipsec_tunnel(container_name, tunnel_name)

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

            # Get IPsec status
            exit_code, output = container.exec_run(f"ipsec status {tunnel_name}")
            status_output = output.decode() if output else ""

            # Get detailed SA info
            exit_code, output = container.exec_run(f"ipsec statusall {tunnel_name}")
            statusall_output = output.decode() if output else ""

            # Parse IKE SA state
            ike_established = "ESTABLISHED" in statusall_output
            child_installed = "INSTALLED" in statusall_output

            # Extract stats
            bytes_in = None
            bytes_out = None
            bytes_match = re.search(r'(\d+) bytes_i.*?(\d+) bytes_o', statusall_output)
            if bytes_match:
                bytes_in = int(bytes_match.group(1))
                bytes_out = int(bytes_match.group(2))

            # Get VTI interface state
            vti_name = f"vti-{tunnel_name[:8]}"
            exit_code, vti_output = container.exec_run(f"ip addr show {vti_name}")
            vti_exists = exit_code == 0
            vti_info = vti_output.decode() if vti_output else ""

            actual_state = {
                "ike_established": ike_established,
                "child_sa_installed": child_installed,
                "bytes_in": bytes_in,
                "bytes_out": bytes_out,
                "vti_exists": vti_exists,
                "vti_info": vti_info,
                "status_output": status_output,
                "statusall_output": statusall_output
            }

            # Determine overall status
            if ike_established and child_installed:
                status = "established"
            elif ike_established:
                status = "ike_only"
            else:
                status = "down"

            return {
                "container_name": container_name,
                "tunnel_name": tunnel_name,
                "container_exists": True,
                "db_config": db_config,
                "actual_state": actual_state,
                "status": status
            }

        except Exception as e:
            logger.error(f"[IPsecManager] Failed to get tunnel state: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to get tunnel state: {str(e)}")

    def restart_ipsec_tunnel(self, container_name: str, tunnel_name: str) -> Dict:
        """
        Restart an IPsec tunnel connection.

        Args:
            container_name: Container with the tunnel
            tunnel_name: IPsec connection name

        Returns:
            Dict with operation status
        """
        logger.info(f"[IPsecManager] Restarting IPsec tunnel '{tunnel_name}' on '{container_name}'")

        try:
            container = self.client.containers.get(container_name)

            # Bring down then up
            container.exec_run(f"ipsec down {tunnel_name}")
            exit_code, output = container.exec_run(f"ipsec up {tunnel_name}")

            ipsec_output = output.decode() if output else ""

            # Get new status
            exit_code, status_output = container.exec_run(f"ipsec status {tunnel_name}")
            status_info = status_output.decode() if status_output else ""

            return {
                "container_name": container_name,
                "tunnel_name": tunnel_name,
                "action": "restarted",
                "output": ipsec_output,
                "status": status_info
            }

        except docker.errors.NotFound:
            raise HTTPException(status_code=404, detail=f"Container '{container_name}' not found")
        except Exception as e:
            logger.error(f"[IPsecManager] Failed to restart tunnel: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to restart tunnel: {str(e)}")

    def test_ipsec_tunnel_connectivity(self, container_name: str, tunnel_name: str,
                                        remote_ip: Optional[str] = None) -> Dict:
        """
        Test connectivity through an IPsec tunnel.

        Args:
            container_name: Name of the container with the tunnel
            tunnel_name: Name of the IPsec connection
            remote_ip: Optional remote IP to ping

        Returns:
            Dict with ping test results
        """
        logger.info(f"[IPsecManager] Testing connectivity for tunnel '{tunnel_name}' on '{container_name}'")

        try:
            container = self.client.containers.get(container_name)

            # Get remote IP from DB if not provided
            if not remote_ip:
                db_config = self.db.get_ipsec_tunnel(container_name, tunnel_name)
                if not db_config:
                    raise HTTPException(
                        status_code=404,
                        detail=f"Tunnel '{tunnel_name}' not found in database"
                    )
                remote_ip = db_config.get('remote_ip')

            # Ping through the tunnel
            exit_code, output = container.exec_run(
                f"sh -c 'ping -c 4 -W 2 {remote_ip}'",
                demux=False
            )

            ping_output = output.decode() if output else ""

            # Parse ping statistics
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

            return result

        except docker.errors.NotFound:
            raise HTTPException(status_code=404, detail=f"Container '{container_name}' not found")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[IPsecManager] Failed to test connectivity: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to test connectivity: {str(e)}")

    def diagnose_ipsec_tunnel(self, container_name: str, tunnel_name: str) -> Dict:
        """
        Diagnose common IPsec tunnel issues.

        Args:
            container_name: Container with the tunnel
            tunnel_name: IPsec connection name

        Returns:
            Dict with diagnostic results and recommendations
        """
        logger.info(f"[IPsecManager] Diagnosing IPsec tunnel '{tunnel_name}' on '{container_name}'")

        try:
            container = self.client.containers.get(container_name)
            diagnostics = {
                "container_name": container_name,
                "tunnel_name": tunnel_name,
                "issues": [],
                "recommendations": [],
                "status": "healthy"
            }

            # 1. Check if StrongSwan is running
            exit_code, output = container.exec_run("ipsec status")
            if exit_code != 0:
                diagnostics["issues"].append("StrongSwan daemon is not running")
                diagnostics["recommendations"].append("Start StrongSwan with: ipsec start")
                diagnostics["status"] = "critical"
                return diagnostics

            # 2. Check if connection exists in config
            exit_code, output = container.exec_run(f"ipsec status {tunnel_name}")
            status_output = output.decode() if output else ""

            if "no matching" in status_output.lower() or exit_code != 0:
                diagnostics["issues"].append(f"Connection '{tunnel_name}' not found in IPsec configuration")
                diagnostics["recommendations"].append("Verify ipsec.conf contains the connection definition")
                diagnostics["status"] = "critical"
                return diagnostics

            # 3. Check IKE SA status
            exit_code, output = container.exec_run(f"ipsec statusall {tunnel_name}")
            statusall = output.decode() if output else ""

            if "ESTABLISHED" not in statusall:
                diagnostics["issues"].append("IKE SA is not established")
                diagnostics["recommendations"].append("Check if remote peer is reachable and PSK matches")
                diagnostics["status"] = "warning"

            if "INSTALLED" not in statusall:
                diagnostics["issues"].append("Child SA (ESP) is not installed")
                diagnostics["recommendations"].append("Check traffic selectors and ESP proposals match")
                if diagnostics["status"] == "healthy":
                    diagnostics["status"] = "warning"

            # 4. Check VTI interface
            vti_name = f"vti-{tunnel_name[:8]}"
            exit_code, output = container.exec_run(f"ip link show {vti_name}")
            if exit_code != 0:
                diagnostics["issues"].append(f"VTI interface '{vti_name}' does not exist")
                diagnostics["recommendations"].append("Recreate the VTI interface")
                if diagnostics["status"] == "healthy":
                    diagnostics["status"] = "warning"

            # 5. Get DB config and compare
            db_config = self.db.get_ipsec_tunnel(container_name, tunnel_name)
            if db_config:
                # Check if remote is reachable
                remote_ip = db_config.get('remote_ip')
                if remote_ip:
                    exit_code, _ = container.exec_run(f"ping -c 2 -W 2 {remote_ip}")
                    if exit_code != 0:
                        diagnostics["issues"].append(f"Cannot reach remote endpoint {remote_ip}")
                        diagnostics["recommendations"].append("Check network connectivity to remote peer")
                        if diagnostics["status"] == "healthy":
                            diagnostics["status"] = "warning"

            diagnostics["statusall"] = statusall

            if not diagnostics["issues"]:
                diagnostics["recommendations"].append("IPsec tunnel appears healthy")

            return diagnostics

        except docker.errors.NotFound:
            raise HTTPException(status_code=404, detail=f"Container '{container_name}' not found")
        except Exception as e:
            logger.error(f"[IPsecManager] Failed to diagnose tunnel: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to diagnose tunnel: {str(e)}")
