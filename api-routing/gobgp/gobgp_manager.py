import logging
import sys
from pathlib import Path
from typing import Optional, List, Dict

from fastapi import HTTPException
from pygobgp import PyGoBGP, PeerNotFound

from ..common.models import PolicyDefinition, PrefixListDefinition

# Add netstream-common to path if running locally
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "netstream-common"))

try:
    from netstream_common.interfaces import BGPManager as BGPManagerInterface
except ImportError:
    # Fallback if netstream-common not installed
    BGPManagerInterface = object

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("gobgp-manager")


def session_state_to_string(state: int) -> str:
    """Convert GoBGP session state integer to human-readable string"""
    state_map = {
        0: "Idle",
        1: "Connect",
        2: "Active",
        3: "OpenSent",
        4: "OpenConfirm",
        5: "OpenConfirm",  # Alternative value
        6: "Established"
    }
    return state_map.get(state, f"unknown({state})")


class GoBGPManager(BGPManagerInterface):
    def __init__(self, asn: int, router_id: str, host: str = "localhost", port: int = 50051):
        self.asn = asn
        self.router_id = router_id
        self.host = host
        self.port = port
        self.client = PyGoBGP(address=host, port=port)

    def advertise_route(
        self,
        prefix: str,
        cidr: str,
        *,
        next_hop: Optional[str] = None,
        community: Optional[str] = None,
        ext_community: Optional[str] = None,
        as_path: Optional[str] = None,
        med: Optional[int] = None,
    ) -> None:
        """
        Advertise a route via GoBGP using the PyGoBGP v3 gRPC API.
        """
        try:
            nh = next_hop or self.router_id
            full_prefix = f"{prefix}/{cidr}"

            # Build attributes dict for PyGoBGP
            attributes = {}

            # AS path
            if as_path:
                # Convert space-separated string to list
                attributes['as_path'] = [int(asn) for asn in as_path.split()]

            # Communities
            if community:
                # Convert space-separated string to list
                attributes['communities'] = community.split()

            # Extended Communities
            if ext_community:
                # Convert space-separated extended communities to list
                # Format: "rt 65000:100 soo 65000:200" -> ["rt 65000:100", "soo 65000:200"]
                ext_comms = []
                parts = ext_community.split()
                i = 0
                while i < len(parts):
                    if i + 1 < len(parts):
                        # Combine type and value (e.g., "rt" + "65000:100")
                        ext_comms.append(f"{parts[i]} {parts[i+1]}")
                        i += 2
                    else:
                        i += 1
                attributes['extended_communities'] = ext_comms

            # MED
            if med is not None:
                attributes['med'] = med

            # Use PyGoBGP v3 API
            self.client.advertise_route(full_prefix, nh, attributes if attributes else None)

            logger.info(f"[GoBGP] Advertised route {full_prefix} via {nh}")

        except Exception as e:
            logger.exception(f"Failed to advertise route {prefix}/{cidr}")
            raise HTTPException(status_code=500, detail=f"Failed to advertise route: {str(e)}")

    def withdraw_route(self, prefix: str, cidr: str):
        """
        Withdraw a route from GoBGP using the PyGoBGP v3 gRPC API.
        """
        try:
            full_prefix = f"{prefix}/{cidr}"

            # Use PyGoBGP v3 API
            self.client.withdraw_route(full_prefix)

            logger.info(f"[GoBGP] Withdrawn route {full_prefix}")

        except Exception as e:
            logger.exception(f"Failed to withdraw route {prefix}/{cidr}")
            raise HTTPException(status_code=500, detail=f"Failed to withdraw route: {str(e)}")

    def get_route_status(self, prefix: str, cidr: str) -> dict:
        """
        Get the status of a specific route in the RIB.
        """
        try:
            routes = self.client.get_rib()
            net = f"{prefix}/{cidr}"
            for route in routes:
                if route.get("prefix") == net:
                    return route
            return {"error": f"Route {net} not found"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to get route status: {str(e)}")

    def get_all_routes(self) -> List[dict]:
        """Get all routes in the BGP RIB"""
        try:
            routes = self.client.get_rib()
            return routes
        except Exception as e:
            logger.error(f"Failed to get all routes: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to get all routes: {str(e)}")

    def get_neighbor_routes(self, ip: str) -> dict:
        """
        Get advertised and received routes for a specific neighbor.
        """
        try:
            # Get global RIB (received routes)
            received = self.client.get_rib()

            # Get routes advertised to this specific neighbor
            advertised = self.client.get_advertised_routes(neighbor_address=ip)

            return {
                "received_routes": received,
                "advertised_routes": advertised,
            }
        except Exception as e:
            logger.error(f"Failed to get neighbor routes for {ip}: {e}")
            return {"received_routes": [], "advertised_routes": []}

    def configure_neighbor(
        self,
        ip: str,
        remote_as: int,
        local_as: int,
        description: str,
        out_policy: Optional[str] = None,
        in_policy: Optional[str] = None,
        local_address: Optional[str] = None,
        ebgp_multihop: bool = True,
        ebgp_multihop_ttl: int = 255,
        auth_password: Optional[str] = None,
        next_hop_self: bool = False,
        enable_flowspec: bool = True,
        afi_safis: Optional[List[str]] = None,
    ):
        """
        Configure a BGP neighbor using PyGoBGP v3 API.

        Args:
            ip: Neighbor IP address
            remote_as: Remote AS number
            local_as: Local AS number
            description: Neighbor description
            out_policy: Outbound policy name (not yet implemented)
            in_policy: Inbound policy name (not yet implemented)
            local_address: Local address to use (not yet implemented)
            ebgp_multihop: Enable EBGP multihop (not yet implemented)
            ebgp_multihop_ttl: EBGP multihop TTL (not yet implemented)
            auth_password: BGP MD5 password (not yet implemented)
            next_hop_self: Set next-hop to self (not yet implemented)
            enable_flowspec: Enable FlowSpec address family (default: True)
            afi_safis: Optional list of address families (e.g., ['ipv4-unicast', 'ipv4-flowspec'])
        """
        try:
            # Delete if exists, then add (update pattern)
            try:
                self.client.delete_neighbor(address=ip)
            except:
                pass

            # Use simplified PyGoBGP v3 API with FlowSpec enabled by default
            # Note: PyGoBGP v3 doesn't support description, router_id (global setting), or route_server_client
            # route_server_client (next-hop-self) would need to be configured via GoBGP config file or policies
            self.client.add_neighbor(
                neighbor_address=ip,
                peer_as=remote_as,
                local_as=local_as,
                enable_flowspec=enable_flowspec,
                afi_safis=afi_safis
            )

            if next_hop_self:
                logger.warning(f"[GoBGP] next_hop_self requested for {ip}, but not supported via gRPC API - configure via GoBGP policy")

            logger.info(f"[GoBGP] Configured neighbor {ip} (AS{remote_as}) with flowspec={enable_flowspec} - {description}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to configure neighbor: {str(e)}")

    def bring_up_neighbor(self, ip: str, remote_as: int):
        """
        Enable a BGP neighbor.
        """
        try:
            neighbor = self.client.get_neighbor(address=ip)
            if neighbor:
                logger.info(f"[GoBGP] Neighbor {ip} is already configured")
            else:
                self.configure_neighbor(ip, remote_as, self.asn, "")
        except PeerNotFound:
            self.configure_neighbor(ip, remote_as, self.asn, "")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to bring up neighbor: {str(e)}")

    def shut_down_neighbor(self, ip: str):
        """
        Shut down a BGP neighbor by removing it.
        """
        try:
            self.client.delete_neighbor(address=ip)
            logger.info(f"[GoBGP] Shut down neighbor {ip}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to shut down neighbor: {str(e)}")

    def delete_neighbor(self, ip: str):
        """
        Delete a BGP neighbor (same as shut down).
        """
        self.shut_down_neighbor(ip)

    def get_all_neighbors_full_state(self) -> List[dict]:
        """
        Get all BGP neighbors with their full state information using PyGoBGP v3 API.
        """
        try:
            peers = self.client.get_all_neighbors()
            neighbors = []

            for peer in peers:
                # Extract message counts
                msg_sent = 0
                msg_rcvd = 0
                updates_sent = 0
                updates_rcvd = 0

                if hasattr(peer.state, 'messages'):
                    msg_sent = int(peer.state.messages.sent.total) if hasattr(peer.state.messages.sent, 'total') else 0
                    msg_rcvd = int(peer.state.messages.received.total) if hasattr(peer.state.messages.received, 'total') else 0
                    updates_sent = int(peer.state.messages.sent.update) if hasattr(peer.state.messages.sent, 'update') else 0
                    updates_rcvd = int(peer.state.messages.received.update) if hasattr(peer.state.messages.received, 'update') else 0

                # Extract uptime (Timestamp protobuf object)
                # Note: peer.timers.state.uptime is an epoch timestamp, not a duration
                # We need to calculate the duration from now
                from ..common.utils import format_uptime
                import time
                uptime = 0
                uptime_str = "00:00:00"
                if hasattr(peer, 'timers') and hasattr(peer.timers, 'state'):
                    uptime_val = peer.timers.state.uptime
                    if uptime_val and hasattr(uptime_val, 'seconds'):
                        established_epoch = int(uptime_val.seconds)
                        current_time = int(time.time())
                        uptime = current_time - established_epoch  # Calculate duration
                        uptime_str = format_uptime(uptime)

                # Get routes for this neighbor
                neighbor_ip_str = str(peer.conf.neighbor_address)
                try:
                    routes = self.get_neighbor_routes(neighbor_ip_str)
                    advertised_routes = routes.get("advertised_routes", [])
                    received_routes = routes.get("received_routes", [])
                except Exception as e:
                    logger.warning(f"[GoBGP] Failed to get routes for {neighbor_ip_str}: {e}")
                    advertised_routes = []
                    received_routes = []

                neighbor_data = {
                    "neighbor_ip": neighbor_ip_str,
                    "remote_as": int(peer.conf.peer_asn),
                    "local_as": int(peer.state.local_asn) if peer.state.local_asn else self.asn,
                    "state": session_state_to_string(int(peer.state.session_state)),
                    "admin_shutdown": bool(peer.conf.admin_down),
                    "description": str(peer.conf.description) if peer.conf.description else "",
                    "hostname": "",
                    "local_router_id": self.router_id,
                    "remote_router_id": str(peer.state.router_id) if peer.state.router_id else "",
                    "uptime": uptime,
                    "uptime_str": uptime_str,
                    "established_epoch": 0,
                    "msg_sent": msg_sent,
                    "msg_rcvd": msg_rcvd,
                    "updates_sent": updates_sent,
                    "updates_rcvd": updates_rcvd,
                    "update_source": "",
                    "families": {},
                    "advertised_routes": advertised_routes,
                    "received_routes": received_routes,
                }
                neighbors.append(neighbor_data)

            logger.info(f"[GoBGP] Parsed {len(neighbors)} BGP neighbors")
            return neighbors
        except Exception as e:
            logger.exception("[GoBGP] Failed to get BGP neighbor summary")
            return []

    def create_or_update_policy(self, name: str, policy: PolicyDefinition):
        """
        Create or update a BGP policy using gRPC DefinedSets and Statements.

        Note: Full policy implementation requires complex protobuf construction.
        This is a placeholder for future implementation.
        """
        logger.warning(f"[GoBGP] Policy management via gRPC not yet fully implemented: {name}")
        raise HTTPException(
            status_code=501,
            detail="Policy management not yet fully implemented for GoBGP via gRPC."
        )

    def delete_policy(self, name: str):
        """
        Delete a BGP policy.
        """
        logger.warning(f"[GoBGP] Policy deletion not yet implemented: {name}")
        raise HTTPException(
            status_code=501,
            detail="Policy management not yet implemented for GoBGP."
        )

    def list_route_maps(self) -> List[dict]:
        """
        List all route-map policies.
        """
        logger.warning("[GoBGP] Policy listing not yet implemented")
        return []

    def create_or_update_prefix_list(self, name: str, definition: PrefixListDefinition):
        """
        Create or update a prefix-list using gRPC DefinedSets.
        """
        logger.warning(f"[GoBGP] Prefix-list management not yet implemented: {name}")
        raise HTTPException(
            status_code=501,
            detail="Prefix-list management not yet implemented for GoBGP."
        )

    def delete_prefix_list(self, name: str):
        """
        Delete a prefix-list.
        """
        logger.warning(f"[GoBGP] Prefix-list deletion not yet implemented: {name}")
        raise HTTPException(
            status_code=501,
            detail="Prefix-list management not yet implemented for GoBGP."
        )

    def list_prefix_lists(self) -> List[dict]:
        """
        List all prefix-lists.
        """
        logger.warning("[GoBGP] Prefix-list listing not yet implemented")
        return []

    def save_config(self) -> str:
        """
        Save GoBGP configuration.
        """
        logger.warning("[GoBGP] Config persistence not implemented - changes are runtime only")
        return "GoBGP configuration changes are runtime only and not persisted to disk"

    def get_global_status(self) -> dict:
        """
        Get global BGP daemon status via gRPC.

        Returns:
            Dict with global BGP information (AS, router ID, listening port, etc.)
        """
        try:
            config = self.client.get_global_config()
            return {
                "status": "running",
                "asn": config.get("asn", self.asn),
                "router_id": config.get("router_id", self.router_id),
                "listening_port": config.get("listening_port", self.port),
                "listening_addresses": config.get("listening_addresses", []),
            }
        except Exception as e:
            logger.exception("[GoBGP] Failed to get global status via gRPC")
            raise HTTPException(status_code=500, detail=f"Failed to get daemon status: {str(e)}")

    def add_flowspec_rule(self, family: str, match: dict, actions: dict):
        """
        Add a FlowSpec rule for traffic filtering, policing, or redirection

        Args:
            family: Address family ('ipv4' or 'ipv6')
            match: Dict of match conditions
            actions: Dict of actions (discard, rate-limit, redirect)
        """
        try:
            self.client.add_flowspec_rule(family=family, rules=match, actions=actions)
            logger.info(f"[GoBGP] Added FlowSpec rule: {match} -> {actions}")
        except Exception as e:
            logger.exception(f"Failed to add FlowSpec rule")
            raise HTTPException(status_code=500, detail=f"Failed to add FlowSpec rule: {str(e)}")

    def delete_flowspec_rule(self, family: str, match: dict):
        """
        Delete a FlowSpec rule

        Args:
            family: Address family ('ipv4' or 'ipv6')
            match: Dict of match conditions
        """
        try:
            self.client.delete_flowspec_rule(family=family, rules=match)
            logger.info(f"[GoBGP] Deleted FlowSpec rule: {match}")
        except Exception as e:
            logger.exception(f"Failed to delete FlowSpec rule")
            raise HTTPException(status_code=500, detail=f"Failed to delete FlowSpec rule: {str(e)}")

    def get_flowspec_rules(self, family: str = "ipv4") -> List[dict]:
        """
        Get all FlowSpec rules

        Args:
            family: Address family ('ipv4' or 'ipv6')

        Returns:
            List of FlowSpec rules
        """
        try:
            rules = self.client.get_flowspec_rules(family=family)
            logger.info(f"[GoBGP] Retrieved {len(rules)} FlowSpec rules")
            return rules
        except Exception as e:
            logger.exception(f"Failed to get FlowSpec rules")
            return []

    # ========================================
    # BMP (BGP Monitoring Protocol) Support
    # ========================================

    def add_bmp_server(self, address: str, port: int = 11019,
                      route_monitoring_policy: str = 'pre-policy',
                      statistics_timeout: int = 0,
                      route_mirroring_enabled: bool = False):
        """
        Add a BMP server for event-driven route monitoring.

        Args:
            address: BMP server IP address
            port: BMP server port (default: 11019)
            route_monitoring_policy: 'pre-policy', 'post-policy', 'local-rib', 'all'
            statistics_timeout: Statistics reporting interval in seconds (0 = disabled)
            route_mirroring_enabled: Enable route mirroring for debugging
        """
        try:
            self.client.add_bmp_server(
                address=address,
                port=port,
                route_monitoring_policy=route_monitoring_policy,
                statistics_timeout=statistics_timeout,
                route_mirroring_enabled=route_mirroring_enabled
            )
            logger.info(f"[BMP] Added BMP server {address}:{port} with policy '{route_monitoring_policy}'")
        except Exception as e:
            error_str = str(e)
            # Check if already configured
            if "already configured" in error_str.lower():
                logger.info(f"[BMP] BMP server {address}:{port} already configured")
                raise HTTPException(status_code=409, detail="BMP server already configured")
            logger.exception(f"Failed to add BMP server")
            raise HTTPException(status_code=500, detail=f"Failed to add BMP server: {str(e)}")

    def delete_bmp_server(self, address: str, port: int = 11019):
        """Delete a BMP server"""
        try:
            self.client.delete_bmp_server(address=address, port=port)
            logger.info(f"[BMP] Deleted BMP server {address}:{port}")
        except Exception as e:
            logger.exception(f"Failed to delete BMP server")
            raise HTTPException(status_code=500, detail=f"Failed to delete BMP server: {str(e)}")

    def list_bmp_servers(self) -> List[dict]:
        """List all BMP servers"""
        try:
            # PyGoBGP v3 doesn't have list_bmp_servers method yet
            # Return empty list for now
            logger.warning("[BMP] list_bmp_servers not implemented in PyGoBGP v3")
            return []
        except Exception as e:
            logger.exception(f"Failed to list BMP servers")
            return []

    # ========================================
    # Event-Driven Monitoring
    # ========================================

    def start_event_watcher(self, callback, peer_address=None, table_type=None):
        """
        Start watching for BGP events (blocking).

        This is typically run in a background thread for event-driven routing decisions.

        Args:
            callback: Function to call for each event
            peer_address: Optional - filter events for specific peer
            table_type: Optional - filter events for specific table type
        """
        try:
            logger.info("[Event Watcher] Starting BGP event monitoring...")
            self.client.watch_events(
                callback=callback,
                peer_address=peer_address,
                table_type=table_type
            )
        except Exception as e:
            logger.exception(f"Event watcher stopped with error")
            raise

    def add_netflow_collector(self, address: str, port: int = 2055, **kwargs):
        """
        Configure NetFlow export via softflowd.

        For GoBGP, this restarts softflowd with the new collector settings.
        """
        import subprocess

        try:
            # Kill existing softflowd processes
            subprocess.run(['pkill', '-9', 'softflowd'], check=False)

            # Start new softflowd with collector configuration
            collector_address = f"{address}:{port}"
            cmd = [
                'softflowd',
                '-i', 'any',  # Monitor all interfaces
                '-n', collector_address,
                '-v', '5',  # NetFlow v5
                '-t', 'maxlife=60'
            ]

            subprocess.Popen(cmd)
            logger.info(f"[GoBGP] Started softflowd exporting to {collector_address}")

        except Exception as e:
            logger.exception(f"Failed to configure NetFlow collector")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to configure NetFlow: {str(e)}"
            )

    def remove_netflow_collector(self, address: str, port: int = 2055):
        """
        Stop NetFlow export.

        For GoBGP, this stops softflowd.
        """
        import subprocess

        try:
            # Kill softflowd processes
            subprocess.run(['pkill', '-9', 'softflowd'], check=False)
            logger.info(f"[GoBGP] Stopped softflowd NetFlow export")

        except Exception as e:
            logger.exception(f"Failed to remove NetFlow collector")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to remove NetFlow: {str(e)}"
            )
