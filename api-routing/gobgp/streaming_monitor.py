"""
GoBGP Streaming Monitor
Uses GoBGP's gRPC MonitorTable API to stream real-time BGP table changes
and broadcasts them via WebSocket to connected UI clients
"""

import asyncio
import logging
from typing import Optional
import grpc

from pygobgp import PyGoBGP
from ..common.websocket_manager import ws_manager

logger = logging.getLogger("gobgp-streaming-monitor")


class GoBGPStreamingMonitor:
    """Monitors GoBGP table changes via gRPC streaming and broadcasts to WebSocket clients"""

    def __init__(self, host: str = "localhost", port: int = 50051):
        self.host = host
        self.port = port
        self.client: Optional[PyGoBGP] = None
        self.monitoring_task: Optional[asyncio.Task] = None
        self.running = False

    async def start(self):
        """Start the streaming monitor"""
        if self.running:
            logger.warning("Streaming monitor already running")
            return

        self.running = True
        self.client = PyGoBGP(address=self.host, port=self.port)
        self.monitoring_task = asyncio.create_task(self._monitor_table_changes())
        logger.info(f"GoBGP streaming monitor started (connected to {self.host}:{self.port})")

    async def stop(self):
        """Stop the streaming monitor"""
        self.running = False
        if self.monitoring_task:
            self.monitoring_task.cancel()
            try:
                await self.monitoring_task
            except asyncio.CancelledError:
                pass
        logger.info("GoBGP streaming monitor stopped")

    async def _monitor_table_changes(self):
        """Monitor GoBGP routing table changes using MonitorTable gRPC stream"""
        retry_delay = 5
        max_retry_delay = 60

        while self.running:
            try:
                logger.info("Connecting to GoBGP MonitorTable stream...")

                # Use PyGoBGP's monitor_table method to stream table changes
                # This is a blocking call that streams route updates
                for event in self.client.monitor_table():
                    if not self.running:
                        break

                    await self._process_table_event(event)

                    # Reset retry delay on successful stream
                    retry_delay = 5

            except grpc.RpcError as e:
                logger.error(f"gRPC error in MonitorTable stream: {e.code()} - {e.details()}")
                if not self.running:
                    break

                logger.info(f"Retrying in {retry_delay} seconds...")
                await asyncio.sleep(retry_delay)
                retry_delay = min(retry_delay * 2, max_retry_delay)

            except Exception as e:
                logger.exception(f"Unexpected error in MonitorTable stream: {e}")
                if not self.running:
                    break

                logger.info(f"Retrying in {retry_delay} seconds...")
                await asyncio.sleep(retry_delay)
                retry_delay = min(retry_delay * 2, max_retry_delay)

    async def _process_table_event(self, event: dict):
        """Process a routing table change event and broadcast to WebSocket clients"""
        try:
            # Event structure from PyGoBGP monitor_table:
            # {
            #     "is_withdraw": bool,
            #     "path": {
            #         "nlri": { "prefix": "192.0.2.0/24" },
            #         "next_hop": "10.0.0.1",
            #         "attributes": [...],
            #         "source_asn": 65000,
            #         ...
            #     }
            # }

            is_withdrawal = event.get("is_withdraw", False)
            path = event.get("path", {})
            nlri = path.get("nlri", {})
            prefix = nlri.get("prefix", "unknown")

            # Extract route information
            route_data = {
                "prefix": prefix,
                "next_hop": path.get("next_hop"),
                "source_asn": path.get("source_asn"),
                "as_path": path.get("as_path", []),
                "communities": path.get("communities", []),
                "local_pref": path.get("local_pref"),
                "med": path.get("med"),
                "origin": path.get("origin"),
                "best": path.get("best", False)
            }

            # Broadcast to WebSocket clients
            action = "withdraw" if is_withdrawal else "add"
            await ws_manager.broadcast_route_update(route_data, backend="gobgp", action=action)

            logger.debug(f"Broadcasted {action} for route {prefix}")

        except Exception as e:
            logger.exception(f"Error processing table event: {e}")

    async def monitor_peer_state(self):
        """Monitor BGP peer state changes (separate stream)"""
        retry_delay = 5
        max_retry_delay = 60

        while self.running:
            try:
                logger.info("Connecting to GoBGP MonitorPeer stream...")

                # Use PyGoBGP's monitor_peer method to stream peer state changes
                for peer_event in self.client.monitor_peer():
                    if not self.running:
                        break

                    await self._process_peer_event(peer_event)
                    retry_delay = 5

            except grpc.RpcError as e:
                logger.error(f"gRPC error in MonitorPeer stream: {e.code()} - {e.details()}")
                if not self.running:
                    break

                await asyncio.sleep(retry_delay)
                retry_delay = min(retry_delay * 2, max_retry_delay)

            except Exception as e:
                logger.exception(f"Unexpected error in MonitorPeer stream: {e}")
                if not self.running:
                    break

                await asyncio.sleep(retry_delay)
                retry_delay = min(retry_delay * 2, max_retry_delay)

    async def _process_peer_event(self, event: dict):
        """Process a peer state change event"""
        try:
            # Extract neighbor information
            neighbor_data = {
                "neighbor_ip": event.get("peer_address"),
                "state": event.get("state"),
                "remote_as": event.get("remote_as"),
                "uptime": event.get("uptime"),
                "fsm_state": event.get("fsm_state")
            }

            await ws_manager.broadcast_neighbor_update(neighbor_data, backend="gobgp")

            logger.debug(f"Broadcasted neighbor update for {neighbor_data['neighbor_ip']}")

        except Exception as e:
            logger.exception(f"Error processing peer event: {e}")


# Global streaming monitor instance
gobgp_stream_monitor: Optional[GoBGPStreamingMonitor] = None


def get_streaming_monitor() -> GoBGPStreamingMonitor:
    """Get or create the global streaming monitor instance"""
    global gobgp_stream_monitor
    if gobgp_stream_monitor is None:
        gobgp_stream_monitor = GoBGPStreamingMonitor()
    return gobgp_stream_monitor
