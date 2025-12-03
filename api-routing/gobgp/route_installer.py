#!/usr/bin/env python3
"""
GoBGP Route Installer
Monitors GoBGP RIB and automatically installs routes into the Linux kernel routing table.
"""

import time
import logging
import subprocess
from typing import Set, Dict

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class RouteInstaller:
    """Watches GoBGP RIB and installs routes into kernel"""

    def __init__(self, gobgp_host: str = 'localhost', gobgp_port: int = 50051, poll_interval: int = 5):
        self.gobgp_host = gobgp_host
        self.gobgp_port = gobgp_port
        self.poll_interval = poll_interval
        self.installed_routes: Set[str] = set()  # Track what we've installed
        self.gobgp = None

    def connect(self):
        """Connect to GoBGP via gRPC"""
        from pygobgp import PyGoBGP

        # Wait a bit for GoBGP to start
        logger.info("Waiting 5 seconds for GoBGP to initialize...")
        time.sleep(5)

        try:
            self.gobgp = PyGoBGP(address=self.gobgp_host, port=self.gobgp_port)
            logger.info(f"Connected to GoBGP at {self.gobgp_host}:{self.gobgp_port}")
        except Exception as e:
            logger.error(f"Failed to connect to GoBGP: {e}")
            raise

    def _get_local_ips(self) -> Set[str]:
        """Get all local IP addresses on this host

        Returns:
            Set of IP addresses (without netmask)
        """
        local_ips = set()
        try:
            result = subprocess.run(
                ['ip', '-o', 'addr', 'show'],
                capture_output=True,
                text=True,
                timeout=5
            )

            if result.returncode == 0:
                for line in result.stdout.split('\n'):
                    if 'inet ' in line:
                        # Parse lines like: "2: eth0    inet 10.1.0.2/24 brd ..."
                        parts = line.split()
                        for i, part in enumerate(parts):
                            if part == 'inet' and i + 1 < len(parts):
                                ip_with_mask = parts[i + 1]
                                ip_addr = ip_with_mask.split('/')[0]
                                local_ips.add(ip_addr)
                                break
        except Exception as e:
            logger.error(f"Failed to get local IPs: {e}")

        logger.debug(f"Local IPs: {local_ips}")
        return local_ips

    def get_bgp_routes(self) -> Dict[str, str]:
        """Get all BGP routes from GoBGP RIB using gRPC

        Returns:
            Dict mapping prefix -> next_hop
        """
        routes = {}

        if not self.gobgp:
            logger.error("Not connected to GoBGP")
            return routes

        try:
            # Use gRPC to get routes
            rib_routes = self.gobgp.get_rib()

            # Parse routes - only use best paths
            for route in rib_routes:
                prefix = route.get('prefix')
                attrs = route.get('attributes', {})
                next_hop = attrs.get('next_hop')
                is_best = attrs.get('best', False)

                # Only process best paths
                if prefix and next_hop and is_best:
                    logger.debug(f"Found BGP route: {prefix} via {next_hop}")
                    routes[prefix] = next_hop

            logger.debug(f"Retrieved {len(routes)} routes from GoBGP RIB via gRPC")

        except Exception as e:
            logger.error(f"Failed to get BGP routes via gRPC: {e}", exc_info=True)

        return routes

    def install_route(self, prefix: str, next_hop: str) -> bool:
        """Install a route into the kernel routing table"""
        try:
            # Check if route already exists
            check_cmd = f"ip route show {prefix}"
            result = subprocess.run(check_cmd, shell=True, capture_output=True, text=True)

            if result.returncode == 0 and result.stdout.strip():
                # Route exists, check if it matches
                if f"via {next_hop}" in result.stdout:
                    logger.debug(f"Route {prefix} via {next_hop} already exists")
                    return True
                else:
                    # Different next hop, replace it
                    logger.info(f"Replacing route {prefix} with next hop {next_hop}")
                    cmd = f"ip route replace {prefix} via {next_hop}"
            else:
                # Route doesn't exist, add it
                logger.info(f"Installing route {prefix} via {next_hop}")
                cmd = f"ip route add {prefix} via {next_hop}"

            result = subprocess.run(cmd, shell=True, capture_output=True, text=True)

            if result.returncode == 0:
                self.installed_routes.add(prefix)
                return True
            else:
                logger.warning(f"Failed to install route {prefix}: {result.stderr}")
                return False

        except Exception as e:
            logger.error(f"Error installing route {prefix}: {e}")
            return False

    def remove_route(self, prefix: str) -> bool:
        """Remove a route from the kernel routing table"""
        try:
            logger.info(f"Removing route {prefix}")
            cmd = f"ip route del {prefix}"
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True)

            if result.returncode == 0:
                self.installed_routes.discard(prefix)
                return True
            else:
                # Route might not exist, which is fine
                logger.debug(f"Could not remove route {prefix}: {result.stderr}")
                self.installed_routes.discard(prefix)
                return False

        except Exception as e:
            logger.error(f"Error removing route {prefix}: {e}")
            return False

    def sync_routes(self):
        """Synchronize kernel routes with BGP RIB"""
        try:
            logger.info("Starting route sync...")
            # Get current BGP routes
            bgp_routes = self.get_bgp_routes()
            current_prefixes = set(bgp_routes.keys())
            logger.info(f"Found {len(bgp_routes)} BGP routes to process")

            # Get local IP addresses to avoid installing routes with self as next-hop
            local_ips = self._get_local_ips()

            # Install new/updated routes
            for prefix, next_hop in bgp_routes.items():
                # Skip routes where next-hop is one of our own IPs (local routes)
                if next_hop in local_ips:
                    logger.debug(f"Skipping route {prefix} via {next_hop} (next-hop is local IP)")
                    continue
                self.install_route(prefix, next_hop)

            # Remove routes that are no longer in BGP RIB
            removed_prefixes = self.installed_routes - current_prefixes
            for prefix in removed_prefixes:
                self.remove_route(prefix)

            logger.info(f"Sync complete: {len(bgp_routes)} BGP routes, {len(self.installed_routes)} installed")

        except Exception as e:
            logger.error(f"Error during route sync: {e}", exc_info=True)

    def run(self):
        """Main loop: continuously sync routes"""
        logger.info(f"Starting route installer (poll interval: {self.poll_interval}s)")

        while True:
            try:
                self.sync_routes()
                time.sleep(self.poll_interval)
            except KeyboardInterrupt:
                logger.info("Shutting down...")
                break
            except Exception as e:
                logger.error(f"Unexpected error: {e}")
                time.sleep(self.poll_interval)


if __name__ == '__main__':
    import os

    host = os.getenv('GOBGP_HOST', 'localhost')
    port = int(os.getenv('GOBGP_PORT', '50051'))
    interval = int(os.getenv('ROUTE_SYNC_INTERVAL', '5'))

    installer = RouteInstaller(gobgp_host=host, gobgp_port=port, poll_interval=interval)
    installer.connect()
    installer.run()
