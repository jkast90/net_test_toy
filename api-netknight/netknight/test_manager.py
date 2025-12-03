import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone
import logging
import shlex
import signal
from typing import Dict, Literal, Optional
import uuid

from pydantic import BaseModel, ValidationError, field_validator
from starlette.websockets import WebSocket, WebSocketState

from netknight.models import PingArgs, TracerouteArgs, HpingArgs, IperfArgs, CurlArgs, HttpServerArgs
from netknight.tool_runner import build_command

logger = logging.getLogger("default")


class ToolRequest(BaseModel):
    tool: Literal["ping", "traceroute", "hping", "iperf", "curl", "http_server"]
    params: Dict
    cmd: list = None
    init_time: datetime = None

    @field_validator("params")
    def _validate_params(cls, v, info):
        cls.init_time = f"{datetime.now(timezone.utc)}"
        schema_map = {
            "ping": PingArgs,
            "traceroute": TracerouteArgs,
            "hping": HpingArgs,
            "iperf": IperfArgs,
            "curl": CurlArgs,
            "http_server": HttpServerArgs,
        }
        logger.warning(info)
        try:
            schema_map[info.data["tool"]](**v)
        except ValidationError as e:
            raise ValueError(str(e)) from e
        return v


@dataclass
class TestSession:
    tool_request: ToolRequest
    proc: asyncio.subprocess.Process = None
    listeners: list[WebSocket] = None
    test_id: str = None
    output_history: list[str] = None

    def __post_init__(self):
        self.listeners = []
        self.output_history = []
        self.init_time = datetime.utcnow().isoformat()

    @classmethod
    async def create(cls, tool_request: ToolRequest) -> "TestSession":
        self = cls(tool_request=tool_request)
        self.test_id = str(uuid.uuid4())
        tool_request.cmd = build_command(tool_request.tool, tool_request.params)
        self.proc = await asyncio.create_subprocess_exec(
            *tool_request.cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            preexec_fn=lambda: signal.signal(signal.SIGINT, signal.SIG_IGN),
        )
        return self

    def to_dict(self) -> dict:
        return {
            "test_id": self.test_id,
            "tool": self.tool_request.tool,
            "start": self.tool_request.init_time,
            "status": "running" if self.proc.returncode is None else "finished",
            "viewers": len(self.listeners),
            "params": self.tool_request.params,
        }

    async def register_listener(self, ws: WebSocket):
        if ws not in self.listeners:
            self.listeners.append(ws)
            await self._record_and_broadcast(f"### {len(self.listeners)} viewer(s) connected ###")
            await test_manager.notify_active_tests_update()

    async def _forward_test_output(self) -> None:
        if not self.proc or not self.proc.stdout:
            return

        await self._record_and_broadcast(f"## Output from test_id: {self.test_id} ##")
        await self._record_and_broadcast(
            "# Results from command: " + " ".join(shlex.quote(c) for c in self.tool_request.cmd)
        )

        logger.warning(dir(self.proc))
        self.listeners = [ws for ws in self.listeners if ws.application_state == WebSocketState.CONNECTED]
        if hasattr(self.proc, "stderr") and self.proc.stderr is not None:
            async for raw in self.proc.stderr:
                line = raw.decode().rstrip()
                await self._record_and_broadcast(line)
        async for raw in self.proc.stdout:
            line = raw.decode().rstrip()
            await self._record_and_broadcast(line)

            self.listeners = [ws for ws in self.listeners if ws.application_state == WebSocketState.CONNECTED]

        rc = await self.proc.wait()
        await self._record_and_broadcast(f"--- process exited with code {rc} ---")
        await test_manager.notify_active_tests_update() 

    async def _record_and_broadcast(self, text: str) -> None:
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
        for line in self.output_history:
            try:
                await ws.send_text(line)
            except Exception:
                break


class TestManager:
    def __init__(self):
        self.running_tests: Dict[str, TestSession] = {}
        self.finished_tests: Dict[str, TestSession] = {}
        self.active_ws_connections: list[WebSocket] = []  # NEW

    async def register(self, session: TestSession):
        self.running_tests[session.test_id] = session

    async def list_active_tests(self) -> list[dict]:
        await self.clean_completed_tests()
        return [
            *[session.to_dict() for session in self.running_tests.values()],
            *[session.to_dict() for session in self.finished_tests.values()],
        ]
    
    async def clean_completed_tests(self):
        completed = []
        for test_id in list(self.running_tests.keys()):
            session = self.running_tests[test_id]
            if session.proc.returncode is not None:  # <-- do NOT await wait()
                self.finished_tests[test_id] = session
                completed.append(test_id)
        for test_id in completed:
            self.running_tests.pop(test_id, None)

    def get_session(self, test_id: str) -> Optional[TestSession]:
        return self.running_tests.get(test_id) or self.finished_tests.get(test_id)

    async def stop(self, test_id: str) -> bool:
        session = self.running_tests.pop(test_id, None)
        if self.finished_tests.get(test_id):
            self.finished_tests.pop(test_id)
            return True
        if session:
            self.finished_tests[test_id] = session
            if session.proc and session.proc.returncode is None:
                session.proc.kill()
                return True
        return False

    async def register_ws_connection(self, ws: WebSocket):
        self.active_ws_connections.append(ws)

    async def unregister_ws_connection(self, ws: WebSocket):
        if ws in self.active_ws_connections:
            self.active_ws_connections.remove(ws)

    async def notify_active_tests_update(self):
        active_tests = await self.list_active_tests()
        disconnected = []
        for ws in list(self.active_ws_connections):
            try:
                if ws.application_state == WebSocketState.CONNECTED:
                    await ws.send_json({ "tests": active_tests })
                else:
                    disconnected.append(ws)
            except Exception:
                disconnected.append(ws)
        for ws in disconnected:
            await self.unregister_ws_connection(ws)

test_manager = TestManager()
