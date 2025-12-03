from __future__ import annotations
from typing import Optional
import json
import logging

import asyncio
from fastapi import FastAPI, Query, Path
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError
import uvicorn
from starlette.websockets import WebSocket, WebSocketDisconnect, WebSocketState

from netknight.common import clean_params
from netknight.test_manager import test_manager, TestSession, ToolRequest


app = FastAPI(title="NetKnight API", version="1.0")

logger = logging.getLogger("default")

origins = [
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ⚡ OR set specific domains like ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],  # ← important for WebSocket compatibility
)


def _parse_raw(raw: str) -> dict:
    """Validate & normalise the JSON sent by the client."""
    logger.debug(f"raw: {raw}")
    data = json.loads(raw)
    return data


def _parse_tool_request(data: dict) -> ToolRequest:
    """Validate & normalise the JSON sent by the client."""
    data["params"] = clean_params(data["params"])
    return ToolRequest(**data)


@app.websocket("/tools/ws/start")
async def tool_runner_ws(
    ws: WebSocket,
    query: Optional[str] = Query(default=None),
) -> None:
    await ws.accept()

    data = _parse_raw(query or await ws.receive_text())
    logger.debug(f"parsed data at start route : {data}")

    try:
        new_request = _parse_tool_request(data)
    except (json.JSONDecodeError, ValidationError, ValueError) as exc:
        await ws.close(code=4000, reason=str(exc))
        return
    logger.debug(f"new request: {new_request}")
    new_session = await TestSession.create(new_request)
    await test_manager.register(new_session)
    await new_session.register_listener(ws)
    await new_session._forward_test_output()


@app.websocket("/tools/ws/subscribe/{test_id}")
async def subscribe_test_ws(ws: WebSocket, test_id: str = Path(...)):
    await ws.accept()
    logger.warning(f"test id in subscribe: {test_id}")

    existing_test = test_manager.get_session(test_id)
    if not existing_test:
        await ws.send_text("no test found")
        await ws.close()
        return

    await existing_test.register_listener(ws)
    await existing_test.replay_history(ws)

    try:
        while True:
            if ws.application_state != WebSocketState.CONNECTED:
                logger.info(f"/subscribe/{test_id} disconnected")
                break
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        logger.info(f"/subscribe/{test_id} disconnected (disconnect)")
    except Exception as e:
        logger.error(f"Unexpected error on /subscribe/{test_id}: {e}")
    finally:
        if ws.application_state != WebSocketState.DISCONNECTED:
            try:
                await ws.close()
            except Exception:
                pass

@app.websocket("/tools/ws/stop/{test_id}")
async def stop_test_ws(
    ws: WebSocket,
    test_id: str = Path(..., description="ID of the running test"),
) -> None:
    await _do_stop(ws, test_id)


async def _do_stop(ws: WebSocket, test_id: str) -> None:
    await ws.accept()
    stopped = await test_manager.stop(test_id)
    await ws.send_json({"test_id": test_id, "stopped": stopped})
    # await ws.close()
    return


@app.websocket("/tools/ws/active")
async def active_tests_ws(ws: WebSocket):
    await ws.accept()
    logger.info("/tools/ws/active connection open")

    try:
        while True:
            if ws.application_state != WebSocketState.CONNECTED:
                logger.info("/tools/ws/active connection closed (state)")
                break

            active_tests = await test_manager.list_active_tests()

            try:
                await ws.send_json({ "tests": active_tests })
            except Exception as e:
                logger.warning(f"Failed to send active tests: {e}")
                break

            await asyncio.sleep(1)

    except WebSocketDisconnect:
        logger.info("/tools/ws/active client disconnected")
    except Exception as e:
        logger.error(f"Unexpected error in active_tests_ws: {e}")
    finally:
        if ws.application_state != WebSocketState.DISCONNECTED:
            try:
                await ws.close()
            except Exception as e:
                logger.warning(f"Tried to close already closed websocket: {e}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="DEBUG")
