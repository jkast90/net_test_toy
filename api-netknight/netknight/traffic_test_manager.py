"""
traffic_test_manager.py
=======================

Manages traffic test sessions and integrates the TrafficController
from the traffic_tester package with the async FastAPI framework.
"""

import asyncio
import logging
import threading
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, Optional

from starlette.websockets import WebSocket, WebSocketState

from traffic_tester.test_runner.traffic_controller import TrafficController
from traffic_tester.test_runner.traffic_test import TrafficTest
from netknight.models import TrafficTestArgs

logger = logging.getLogger("default")


@dataclass
class TrafficTestSession:
    """Represents a single traffic test session."""

    test_id: str
    args: TrafficTestArgs
    controller: TrafficController
    test_obj: Optional[TrafficTest] = None
    listeners: list[WebSocket] = field(default_factory=list)
    output_history: list[str] = field(default_factory=list)
    init_time: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    is_running: bool = False

    def to_dict(self) -> dict:
        """Return a dict representation of the test session."""
        return {
            "test_id": self.test_id,
            "is_sender": self.args.is_sender,
            "test_type": self.args.test_type,
            "traffic_protocol": self.args.traffic_protocol,
            "traffic_dst_ip": self.args.traffic_dst_ip,
            "traffic_dst_port": self.args.traffic_dst_port,
            "status": "running" if self.is_running else "finished",
            "init_time": self.init_time,
            "viewers": len(self.listeners),
        }

    async def register_listener(self, ws: WebSocket):
        """Register a WebSocket listener for this test."""
        if ws not in self.listeners:
            self.listeners.append(ws)
            await self._record_and_broadcast(f"### {len(self.listeners)} viewer(s) connected ###")
            await traffic_test_manager.notify_active_tests_update()

    async def _record_and_broadcast(self, text: str) -> None:
        """Record output and broadcast to all listeners."""
        if not isinstance(text, (str, bytes)):
            text = str(text)

        timestamp = datetime.now(timezone.utc).isoformat()
        stamped_text = f"[{timestamp}] {text}"

        self.output_history.append(stamped_text)

        still_connected = []
        for ws in list(self.listeners):
            try:
                await ws.send_text(stamped_text)
                if ws.application_state == WebSocketState.CONNECTED:
                    still_connected.append(ws)
            except Exception:
                pass
        self.listeners = still_connected

    async def replay_history(self, ws: WebSocket):
        """Replay output history to a new listener."""
        for line in self.output_history:
            try:
                await ws.send_text(line)
            except Exception:
                break


class TrafficTestManager:
    """Manages all traffic test sessions."""

    def __init__(self):
        self.sessions: Dict[str, TrafficTestSession] = {}
        self.active_ws_connections: list[WebSocket] = []
        self._lock = threading.Lock()

    async def create_session(self, args: TrafficTestArgs) -> TrafficTestSession:
        """Create a new traffic test session."""
        # Use integer timestamp for test_id to match TrafficTest expectations
        test_id = str(int(time.time() * 1000000))  # microsecond timestamp as string

        # Create the TrafficController
        controller = TrafficController(
            receiver_control_ip=args.receiver_control_ip,
            receiver_control_port=args.receiver_control_port,
            sender_control_ip=args.sender_control_ip,
            sender_control_port=args.sender_control_port,
            is_sender=args.is_sender,
            packet_count=args.packet_count,
        )

        session = TrafficTestSession(
            test_id=test_id,
            args=args,
            controller=controller,
        )

        with self._lock:
            self.sessions[test_id] = session

        # Start the controller's WebSocket server in a background thread
        def start_controller():
            try:
                controller.start_server()
            except Exception as e:
                logger.exception(f"Error starting controller: {e}")

        thread = threading.Thread(target=start_controller, daemon=True)
        thread.start()

        # Give the server a moment to start
        await asyncio.sleep(0.5)

        return session

    def _broadcast_sync(self, session: TrafficTestSession, text: str):
        """Synchronous version of broadcast for use in threads."""
        timestamp = datetime.now(timezone.utc).isoformat()
        stamped_text = f"[{timestamp}] {text}"
        session.output_history.append(stamped_text)
        logger.info(stamped_text)

    async def run_sender_test(self, session: TrafficTestSession) -> None:
        """
        Run a sender test in a background thread.
        This initiates the test and sends packets.
        """
        test_id = session.test_id

        def run_test():
            try:
                session.is_running = True
                self._broadcast_sync(session, f"Starting sender test {test_id}")

                # Prepare callback URL
                callback_url = f"{session.args.sender_control_ip}:{session.args.sender_control_port}"

                # Send start command to receiver
                session.controller.send_start_command(
                    receiver_control_ip=session.args.receiver_control_ip,
                    receiver_control_port=session.args.receiver_control_port,
                    traffic_dst_ip=session.args.traffic_dst_ip,
                    traffic_src_ip=session.args.traffic_src_ip,
                    traffic_dst_port=session.args.traffic_dst_port,
                    callback_url=callback_url,
                    test_type=session.args.test_type,
                    traffic_protocol=session.args.traffic_protocol,
                    packet_count=session.args.packet_count,
                    test_id=test_id,
                )

                # Create the TrafficTest object
                traffic_test = TrafficTest(
                    test_id=int(test_id),  # Convert string to int for TrafficTest
                    traffic_protocol=session.args.traffic_protocol,
                    traffic_dst_ip=session.args.traffic_dst_ip,
                    traffic_dst_port=session.args.traffic_dst_port,
                    traffic_src_ip=session.args.traffic_src_ip,
                    packet_count=session.args.packet_count,
                    interval=session.args.interval,
                    callback_url=callback_url,
                    is_sender=True,
                )

                session.controller.traffic_tests[test_id] = traffic_test
                session.test_obj = traffic_test

                # Run the test
                traffic_test.run(process_traffic_response=session.controller.process_traffic_response)

                self._broadcast_sync(session, f"Test {test_id} completed")
                session.is_running = False

            except Exception as e:
                logger.exception(f"Error running sender test: {e}")
                self._broadcast_sync(session, f"Error: {str(e)}")
                session.is_running = False

        # Run in thread pool
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, run_test)

    def get_session(self, test_id: str) -> Optional[TrafficTestSession]:
        """Get a session by test_id."""
        with self._lock:
            return self.sessions.get(test_id)

    async def list_active_tests(self) -> list[dict]:
        """List all active and finished tests."""
        with self._lock:
            return [session.to_dict() for session in self.sessions.values()]

    async def stop_test(self, test_id: str) -> bool:
        """Stop a running test."""
        session = self.get_session(test_id)
        if session and session.test_obj:
            session.test_obj.stop()
            session.is_running = False
            return True
        return False

    async def register_ws_connection(self, ws: WebSocket):
        """Register a WebSocket connection for updates."""
        self.active_ws_connections.append(ws)

    async def unregister_ws_connection(self, ws: WebSocket):
        """Unregister a WebSocket connection."""
        if ws in self.active_ws_connections:
            self.active_ws_connections.remove(ws)

    async def notify_active_tests_update(self):
        """Notify all connected WebSockets of active tests update."""
        active_tests = await self.list_active_tests()
        disconnected = []
        for ws in list(self.active_ws_connections):
            try:
                if ws.application_state == WebSocketState.CONNECTED:
                    await ws.send_json({"tests": active_tests})
                else:
                    disconnected.append(ws)
            except Exception:
                disconnected.append(ws)
        for ws in disconnected:
            await self.unregister_ws_connection(ws)


# Global instance
traffic_test_manager = TrafficTestManager()
