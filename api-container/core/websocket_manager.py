"""
WebSocket Connection Management
Manages WebSocket connections for proxying data streams
"""
import logging
from typing import Set
from fastapi import WebSocket
import websockets


logger = logging.getLogger("container-api")


class ConnectionManager:
    """Manages WebSocket connections for proxying data streams"""

    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self.relay_task = None
        self.source_ws = None

    async def connect(self, websocket: WebSocket):
        """Accept a new WebSocket connection"""
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"WebSocket client connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection"""
        self.active_connections.discard(websocket)
        logger.info(f"WebSocket client disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, message: str):
        """Broadcast message to all connected clients"""
        disconnected = set()
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"Error sending to client: {e}")
                disconnected.add(connection)

        # Clean up disconnected clients
        for conn in disconnected:
            self.disconnect(conn)

    async def relay_from_source(self, source_url: str):
        """Connect to source WebSocket and relay messages to all clients"""
        try:
            logger.info(f"Connecting to source WebSocket: {source_url}")
            async with websockets.connect(source_url) as source_ws:
                self.source_ws = source_ws
                logger.info(f"Connected to source WebSocket: {source_url}")

                async for message in source_ws:
                    if len(self.active_connections) > 0:
                        await self.broadcast(message)

        except Exception as e:
            logger.error(f"Error in relay from {source_url}: {e}")
        finally:
            self.source_ws = None
            logger.info(f"Disconnected from source WebSocket: {source_url}")


# Create connection managers for each stream
bmp_manager = ConnectionManager()
netflow_manager = ConnectionManager()  # For trigger notifications
netflow_flows_manager = ConnectionManager()  # For raw flow data streaming
