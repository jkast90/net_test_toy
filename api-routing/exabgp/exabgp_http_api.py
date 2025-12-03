import logging
import os
import re
import signal
import sys
import time
import threading

from fastapi import FastAPI, Form, HTTPException, status
from fastapi.responses import PlainTextResponse

logger = logging.getLogger("exabgp-api")
# Log to stderr to avoid confusing ExaBGP
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    stream=sys.stderr
)

app = FastAPI(title="ExaBGP HTTP API",
              description="A FastAPI-based HTTP API to send commands to ExaBGP via STDOUT.",
              version="1.0")

# Track neighbor uptimes (neighbor_ip -> timestamp when it came up)
neighbor_uptimes = {}

# Environment variables (override as needed)
CONFIG_PATH = os.getenv("EXABGP_CONF", "/etc/exabgp/exabgp.conf")
PID_ENV     = os.getenv("EXABGP_PID")            # e.g. exported by your entrypoint
PID_FILE    = os.getenv("EXABGP_PID_FILE", "/var/run/exabgp.pid")


def listen_to_exabgp_stdin():
    """
    Read messages from ExaBGP on STDIN and track neighbor state changes.
    ExaBGP sends JSON messages about BGP state changes.
    """
    logger.info("[ExaBGP] Starting STDIN listener thread")
    try:
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue

            # Log every message we receive for debugging
            logger.info(f"[ExaBGP] STDIN received: {line[:200]}")

            # Parse neighbor state messages
            # ExaBGP sends messages like: "neighbor 192.168.70.10 up"
            if 'neighbor' in line.lower() and 'up' in line.lower():
                up_match = re.search(r'neighbor\s+([\d\.]+).*up', line, re.IGNORECASE)
                if up_match:
                    neighbor_ip = up_match.group(1)
                    neighbor_uptimes[neighbor_ip] = time.time()
                    logger.info(f"[ExaBGP] ✓ Neighbor {neighbor_ip} came up")

            # Parse neighbor down messages
            elif 'neighbor' in line.lower() and 'down' in line.lower():
                down_match = re.search(r'neighbor\s+([\d\.]+).*down', line, re.IGNORECASE)
                if down_match:
                    neighbor_ip = down_match.group(1)
                    if neighbor_ip in neighbor_uptimes:
                        del neighbor_uptimes[neighbor_ip]
                    logger.info(f"[ExaBGP] ✗ Neighbor {neighbor_ip} went down")

            # Also try to parse JSON messages from ExaBGP
            elif line.startswith('{'):
                try:
                    import json
                    msg = json.loads(line)
                    # ExaBGP JSON format might have neighbor info
                    if 'neighbor' in msg and 'state' in msg:
                        neighbor_ip = msg['neighbor']['address']['peer']
                        state = msg['neighbor']['state']
                        if state == 'up' or state == 'connected':
                            neighbor_uptimes[neighbor_ip] = time.time()
                            logger.info(f"[ExaBGP] ✓ Neighbor {neighbor_ip} state: {state}")
                        elif state == 'down':
                            if neighbor_ip in neighbor_uptimes:
                                del neighbor_uptimes[neighbor_ip]
                            logger.info(f"[ExaBGP] ✗ Neighbor {neighbor_ip} state: {state}")
                except Exception as e:
                    logger.debug(f"[ExaBGP] JSON parse error: {e}")
    except Exception as e:
        logger.error(f"[ExaBGP] STDIN listener error: {e}")


def format_uptime(seconds: int) -> str:
    """Format uptime in seconds to a human-readable string."""
    if seconds == 0:
        return "00:00:00"

    days = seconds // 86400
    hours = (seconds % 86400) // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60

    if days > 0:
        return f"{days}d {hours}h {minutes}m"
    elif hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    else:
        return f"{minutes:02d}:{secs:02d}"


# Start STDIN listener in background thread
@app.on_event("startup")
async def startup_event():
    """Start the STDIN listener when FastAPI starts"""
    logger.info("[ExaBGP] Starting FastAPI application")
    stdin_thread = threading.Thread(target=listen_to_exabgp_stdin, daemon=True)
    stdin_thread.start()
    logger.info("[ExaBGP] STDIN listener thread started")


def get_exabgp_pid() -> int:
    if PID_ENV:
        return int(PID_ENV)
    try:
        with open(PID_FILE) as f:
            return int(f.read().strip())
    except Exception:
        raise HTTPException(500, "Cannot determine ExaBGP PID")


def reload_exabgp():
    pid = get_exabgp_pid()
    try:
        os.kill(pid, signal.SIGUSR1)
    except ProcessLookupError:
        raise HTTPException(404, f"ExaBGP process {pid} not found")
    except Exception as e:
        raise HTTPException(500, f"Failed to signal ExaBGP: {e}")


def toggle_shutdown(neighbor: str, enable: bool):
    """
    If enable==False, ensure 'shutdown;' is present under the neighbor.
    If enable==True, remove any 'shutdown;' under the neighbor.
    """
    try:
        text = open(CONFIG_PATH).splitlines()
    except Exception as e:
        raise HTTPException(500, f"Failed to read config: {e}")

    out = []
    in_block = False
    neigh_re = re.compile(rf'^\s*neighbor\s+{re.escape(neighbor)}\s*\{{')
    for line in text:
        if neigh_re.match(line):
            in_block = True
            out.append(line)
            continue

        # If we leave the block
        if in_block and line.strip().startswith('}'):
            in_block = False
            out.append(line)
            continue

        if in_block and line.strip().startswith('shutdown;'):
            # remove shutdown if enabling
            if enable:
                continue
            # leave shutdown if disabling
            out.append(line)
            continue

        # If disabling (adding shutdown) and we're at first non-empty inside block
        if in_block and not enable and not any(l.strip() == 'shutdown;' for l in out if in_block):
            # Insert shutdown just after the first line inside the block
            out.append("    shutdown;")
            enable = None  # only once
        out.append(line)

    # Write back
    try:
        with open(CONFIG_PATH, 'w') as f:
            f.write("\n".join(out) + "\n")
    except Exception as e:
        raise HTTPException(500, f"Failed to write config: {e}")

    # trigger reload
    reload_exabgp()

@app.post("/neighbor/{addr}/disable", response_class=PlainTextResponse)
async def disable_neighbor(addr: str):
    """
    Add `shutdown;` under neighbor {addr} and reload.
    """
    toggle_shutdown(addr, enable=False)
    return f"Neighbor {addr} disabled (shutdown; added) and configuration reloaded\n"

@app.post("/neighbor/{addr}/enable", response_class=PlainTextResponse)
async def enable_neighbor(addr: str):
    """
    Remove `shutdown;` under neighbor {addr} and reload.
    """
    toggle_shutdown(addr, enable=True)
    return f"Neighbor {addr} enabled (shutdown; removed) and configuration reloaded\n"


@app.get("/neighbors")
async def get_neighbors():
    """
    Parse the ExaBGP config file and return a list of configured neighbors.
    Returns the same format as GoBGP and FRR for consistency.
    Also includes runtime uptime information from tracked neighbor state.
    """
    try:
        with open(CONFIG_PATH, 'r') as f:
            config_text = f.read()
    except Exception as e:
        raise HTTPException(500, f"Failed to read config: {e}")

    neighbors = []
    # Parse neighbor blocks
    neighbor_blocks = re.findall(r'neighbor\s+([\d\.]+)\s+\{([^}]+)\}', config_text, re.MULTILINE | re.DOTALL)

    for neighbor_ip, block in neighbor_blocks:
        # Extract info from block
        remote_as_match = re.search(r'peer-as\s+(\d+)', block)
        local_as_match = re.search(r'local-as\s+(\d+)', block)
        description_match = re.search(r'description\s+"([^"]+)"', block)
        router_id_match = re.search(r'router-id\s+([\d\.]+)', block)
        is_shutdown = 'shutdown;' in block

        # Calculate uptime if neighbor is tracked as up
        uptime_str = "N/A"
        state = "Shutdown" if is_shutdown else "Unknown"

        if neighbor_ip in neighbor_uptimes:
            uptime_seconds = int(time.time() - neighbor_uptimes[neighbor_ip])
            uptime_str = format_uptime(uptime_seconds)
            state = "Established"

        neighbor_info = {
            "neighbor_ip": neighbor_ip,
            "remote_as": int(remote_as_match.group(1)) if remote_as_match else None,
            "local_as": int(local_as_match.group(1)) if local_as_match else None,
            "state": state,
            "description": description_match.group(1) if description_match else "",
            "router_id": router_id_match.group(1) if router_id_match else "",
            "uptime_str": uptime_str,
            "admin_shutdown": is_shutdown,
            "advertised_routes": [],
            "received_routes": [],
        }
        neighbors.append(neighbor_info)

    return {"neighbors": neighbors}


@app.post("/", response_class=PlainTextResponse)
async def send_command(command: str = Form(...)):
    """
    Receive a POST form with a field 'command', print it to STDOUT and return it.
    ExaBGP (executing this script) will capture the STDOUT to execute the command.
    """
    logger.info(f"received command - {command}")

    # Write the command to STDOUT, followed by a newline.
    resp = sys.stdout.write(f"{command}\n")
    logger.info(f"received response - {type(resp)} {resp}")
    sys.stdout.flush()
    return f"{command}\n" 

# def main():
#     import uvicorn
#     # Run the FastAPI app with uvicorn.
#     return uvicorn.run(app, host="0.0.0.0", port=5000)
    
if __name__ == "__main__":
    import uvicorn
    # Run the FastAPI app with uvicorn.
    # Configure logging to stderr and disable access logs
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=5000,
        log_config={
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "default": {
                    "format": "%(asctime)s %(levelname)s %(message)s",
                },
            },
            "handlers": {
                "default": {
                    "formatter": "default",
                    "class": "logging.StreamHandler",
                    "stream": "ext://sys.stderr",
                },
            },
            "loggers": {
                "uvicorn": {"handlers": ["default"], "level": "ERROR"},
                "uvicorn.error": {"level": "ERROR"},
                "uvicorn.access": {"handlers": [], "level": "ERROR"},  # Disable access logs
            },
        }
    )
    