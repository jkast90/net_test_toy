"""
WebSocket Manager for Real-Time BGP Updates
Provides WebSocket connections for streaming BGP neighbor and route updates
"""

import asyncio
import json
import logging
from typing import Dict, Set, Optional
from datetime import datetime
from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger("websocket-manager")


class ConnectionManager:
    """Manages WebSocket connections and broadcasts BGP updates"""

    def __init__(self):
        # Active WebSocket connections grouped by subscription type
        self.active_connections: Dict[str, Set[WebSocket]] = {
            "neighbors": set(),
            "routes": set(),
            "bmp": set(),
            "all": set()
        }

    async def connect(self, websocket: WebSocket, subscription_type: str = "all"):
        """Accept a new WebSocket connection"""
        await websocket.accept()
        if subscription_type in self.active_connections:
            self.active_connections[subscription_type].add(websocket)
            logger.info(f"WebSocket client connected to '{subscription_type}' channel")
        else:
            self.active_connections["all"].add(websocket)
            logger.warning(f"Unknown subscription type '{subscription_type}', defaulting to 'all'")

    def disconnect(self, websocket: WebSocket, subscription_type: str = "all"):
        """Remove a WebSocket connection"""
        if subscription_type in self.active_connections:
            self.active_connections[subscription_type].discard(websocket)
            logger.info(f"WebSocket client disconnected from '{subscription_type}' channel")

    async def send_personal_message(self, message: str, websocket: WebSocket):
        """Send a message to a specific WebSocket"""
        await websocket.send_text(message)

    async def broadcast(self, message: dict, channel: str = "all"):
        """Broadcast a message to all connections in a specific channel"""
        # Add timestamp if not present
        if "timestamp" not in message:
            message["timestamp"] = datetime.utcnow().isoformat()

        message_str = json.dumps(message)

        # Get all connections for this channel
        connections = self.active_connections.get(channel, set()).copy()

        # Also send to "all" subscribers if not broadcasting to "all"
        if channel != "all":
            connections.update(self.active_connections.get("all", set()))

        # Send to all connections
        disconnected = []
        for connection in connections:
            try:
                await connection.send_text(message_str)
            except Exception as e:
                logger.error(f"Error sending message to WebSocket: {e}")
                disconnected.append(connection)

        # Clean up disconnected clients
        for conn in disconnected:
            for channel_name, channel_connections in self.active_connections.items():
                channel_connections.discard(conn)

    async def broadcast_neighbor_update(self, neighbor_data: dict, backend: str):
        """Broadcast a neighbor state change"""
        message = {
            "type": "neighbor_update",
            "backend": backend,
            "data": neighbor_data,
            "timestamp": datetime.utcnow().isoformat()
        }
        await self.broadcast(message, channel="neighbors")

    async def broadcast_route_update(self, route_data: dict, backend: str, action: str = "add"):
        """
        Broadcast a route advertisement/withdrawal
        action: "add" or "withdraw"
        """
        message = {
            "type": "route_update",
            "action": action,
            "backend": backend,
            "data": route_data,
            "timestamp": datetime.utcnow().isoformat()
        }
        await self.broadcast(message, channel="routes")

    async def broadcast_bmp_event(self, event_data: dict, event_type: str):
        """Broadcast a BMP event"""
        message = {
            "type": "bmp_event",
            "event_type": event_type,
            "data": event_data,
            "timestamp": datetime.utcnow().isoformat()
        }
        await self.broadcast(message, channel="bmp")

    def get_stats(self) -> dict:
        """Get connection statistics"""
        return {
            "total_connections": sum(len(conns) for conns in self.active_connections.values()),
            "by_channel": {
                channel: len(conns)
                for channel, conns in self.active_connections.items()
            }
        }


# Global connection manager instance
ws_manager = ConnectionManager()
