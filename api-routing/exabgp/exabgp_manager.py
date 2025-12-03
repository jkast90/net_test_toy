"""
ExaBGP Manager - Wrapper to provide unified interface
"""
import logging
import os
import re
import signal
import sys
from pathlib import Path
from typing import Optional, Dict, List

# Add netstream-common to path if running locally
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "netstream-common"))

try:
    from netstream_common.interfaces import BGPManager as BGPManagerInterface
except ImportError:
    # Fallback if netstream-common not installed
    BGPManagerInterface = object

logger = logging.getLogger("exabgp-manager")


class ExaBGPManager(BGPManagerInterface):
    """
    Manager class for ExaBGP to provide a unified interface
    similar to FRR and GoBGP managers.
    """

    def __init__(
        self,
        asn: int,
        router_id: str,
        config_path: str = "/etc/exabgp/exabgp.conf",
        pid_file: str = "/var/run/exabgp.pid"
    ):
        self.asn = asn
        self.router_id = router_id
        self.config_path = config_path
        self.pid_file = pid_file
        logger.info(f"ExaBGP Manager initialized (AS{asn}, {router_id})")

    def _get_exabgp_pid(self) -> int:
        """Get ExaBGP process PID"""
        pid_env = os.getenv("EXABGP_PID")
        if pid_env:
            return int(pid_env)
        try:
            with open(self.pid_file) as f:
                return int(f.read().strip())
        except Exception as e:
            raise Exception(f"Cannot determine ExaBGP PID: {e}")

    def _reload_exabgp(self):
        """Send SIGUSR1 to ExaBGP to reload config"""
        pid = self._get_exabgp_pid()
        try:
            os.kill(pid, signal.SIGUSR1)
        except ProcessLookupError:
            raise Exception(f"ExaBGP process {pid} not found")
        except Exception as e:
            raise Exception(f"Failed to signal ExaBGP: {e}")

    def _send_command(self, command: str):
        """Send command to ExaBGP via stdout"""
        sys.stdout.write(f"{command}\n")
        sys.stdout.flush()
        logger.info(f"Sent command to ExaBGP: {command}")

    def advertise_route(
        self,
        prefix: str,
        cidr: str,
        next_hop: Optional[str] = None,
        community: Optional[str] = None,
        ext_community: Optional[str] = None,
        as_path: Optional[str] = None,
        med: Optional[int] = None,
    ):
        """Advertise a BGP route via ExaBGP"""
        route = f"{prefix}/{cidr}"

        cmd_parts = [f"announce route {route}"]

        if next_hop:
            cmd_parts.append(f"next-hop {next_hop}")

        if community:
            communities = community.replace(" ", ",")
            cmd_parts.append(f"community [{communities}]")

        if as_path:
            cmd_parts.append(f"as-path [{as_path.replace(' ', ',')}]")

        if med is not None:
            cmd_parts.append(f"med {med}")

        command = " ".join(cmd_parts)
        self._send_command(command)

    def withdraw_route(self, prefix: str, cidr: str):
        """Withdraw a BGP route via ExaBGP"""
        route = f"{prefix}/{cidr}"
        command = f"withdraw route {route}"
        self._send_command(command)

    def configure_neighbor(
        self,
        ip: str,
        remote_as: int,
        local_as: int,
        out_policy: Optional[str] = None,
        in_policy: Optional[str] = None,
        description: str = "",
        local_address: Optional[str] = None,
        ebgp_multihop: Optional[bool] = True,
        ebgp_multihop_ttl: Optional[int] = 255,
        auth_password: Optional[str] = None,
    ):
        """Configure a BGP neighbor - requires config file modification"""
        # This would require modifying exabgp.conf
        # For now, just log it as ExaBGP typically uses static config
        logger.warning(f"ExaBGP neighbor configuration requires manual config file edit for {ip}")
        raise NotImplementedError("ExaBGP neighbor configuration requires config file modification")

    def bring_up_neighbor(self, ip: str, remote_asn: int):
        """Enable a BGP neighbor"""
        self._toggle_shutdown(ip, enable=True)

    def shut_down_neighbor(self, ip: str):
        """Disable a BGP neighbor"""
        self._toggle_shutdown(ip, enable=False)

    def delete_neighbor(self, ip: str):
        """
        Delete a BGP neighbor from the ExaBGP configuration.
        """
        try:
            with open(self.config_path) as f:
                text = f.read().splitlines()
        except Exception as e:
            raise Exception(f"Failed to read config: {e}")

        out = []
        in_block = False
        neigh_re = re.compile(rf'^\s*neighbor\s+{re.escape(ip)}\s*\{{')
        brace_count = 0

        for line in text:
            if neigh_re.match(line):
                in_block = True
                brace_count = 1
                continue

            if in_block:
                # Count braces to handle nested blocks
                brace_count += line.count('{')
                brace_count -= line.count('}')

                if brace_count == 0:
                    in_block = False
                continue

            out.append(line)

        try:
            with open(self.config_path, 'w') as f:
                f.write('\n'.join(out) + '\n')
        except Exception as e:
            raise Exception(f"Failed to write config: {e}")

        self._reload_config()

    def _toggle_shutdown(self, neighbor: str, enable: bool):
        """
        Toggle neighbor shutdown state in config file.
        If enable==False, add 'shutdown;'
        If enable==True, remove 'shutdown;'
        """
        try:
            with open(self.config_path) as f:
                text = f.read().splitlines()
        except Exception as e:
            raise Exception(f"Failed to read config: {e}")

        out = []
        in_block = False
        neigh_re = re.compile(rf'^\s*neighbor\s+{re.escape(neighbor)}\s*\{{')
        shutdown_added = False

        for line in text:
            if neigh_re.match(line):
                in_block = True
                out.append(line)
                continue

            # If we leave the block
            if in_block and line.strip().startswith('}'):
                # Add shutdown if needed and not already added
                if not enable and not shutdown_added:
                    out.append("    shutdown;")
                in_block = False
                out.append(line)
                continue

            if in_block and line.strip().startswith('shutdown;'):
                # Remove shutdown if enabling
                if enable:
                    continue
                else:
                    shutdown_added = True
                    out.append(line)
                    continue

            out.append(line)

        # Write back
        try:
            with open(self.config_path, 'w') as f:
                f.write("\n".join(out) + "\n")
        except Exception as e:
            raise Exception(f"Failed to write config: {e}")

        # Trigger reload
        self._reload_exabgp()

    def get_all_neighbors_full_state(self):
        """
        Get all neighbors from ExaBGP HTTP API.
        The ExaBGP container runs a FastAPI server that parses the config file.
        """
        try:
            # Call the ExaBGP HTTP API running in the exabgp_1 container
            import requests
            import os
            # Use environment variable or fall back to container name
            exabgp_host = os.getenv("EXABGP_API_HOST", "exabgp_1")
            exabgp_port = os.getenv("EXABGP_API_PORT", "5000")
            exabgp_api_url = f"http://{exabgp_host}:{exabgp_port}/neighbors"

            response = requests.get(exabgp_api_url, timeout=5)
            response.raise_for_status()

            data = response.json()
            neighbors = data.get("neighbors", [])

            logger.info(f"[ExaBGP] Retrieved {len(neighbors)} neighbors from HTTP API")
            return neighbors

        except Exception as e:
            logger.error(f"[ExaBGP] Failed to get neighbors from HTTP API: {e}")
            return []

    def get_neighbor_routes(self, ip: str):
        """Get routes for a neighbor"""
        logger.warning("ExaBGP doesn't expose neighbor routes via API")
        return {"advertised": [], "received": []}

    def get_route_status(self, prefix: str, cidr: str):
        """Get route status"""
        logger.warning("ExaBGP doesn't expose route status via API")
        return "ExaBGP route status not available"

    def list_route_maps(self):
        """List route policies"""
        logger.warning("ExaBGP uses config-based policies")
        return []

    def create_or_update_policy(self, name: str, policy):
        """Create or update a policy"""
        raise NotImplementedError("ExaBGP policies are config-based")

    def delete_policy(self, name: str):
        """Delete a policy"""
        raise NotImplementedError("ExaBGP policies are config-based")

    def list_prefix_lists(self):
        """List prefix lists"""
        return []

    def create_or_update_prefix_list(self, name: str, prefix_list):
        """Create or update prefix list"""
        raise NotImplementedError("ExaBGP prefix lists are config-based")

    def delete_prefix_list(self, name: str):
        """Delete prefix list"""
        raise NotImplementedError("ExaBGP prefix lists are config-based")

    def save_config(self):
        """Save config - ExaBGP uses file-based config"""
        return "ExaBGP uses file-based configuration"
