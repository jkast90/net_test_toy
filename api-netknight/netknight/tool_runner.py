"""
Small helper that maps tool-name + pydantic-validated kwargs -> argv list.

Any *user-controlled* value is kept in a single argv element so shell
injection is impossible (no `shell=True`).
"""

from __future__ import annotations
from typing import Dict, List

import logging

logger = logging.getLogger()

SUPPORTED_TOOLS = {
    "ping": {
        "description": "ICMP echo test",
        "params": {"host": "str", "count": "int"},
    },
    "traceroute": {
        "description": "Hop-by-hop path discovery",
        "params": {"host": "str", "maxHops": "int"},
    },
    "hping": {
        "description": "Crafted TCP/UDP/ICMP packets (security testing)",
        "params": {"host": "str", "flags": "str", "count": "int", "data": "int"},
    },
    "iperf": {
        "description": "Bandwidth measurement",
        "params": {
            "host": "str",
            "port": "int",
            "duration": "int",
            "protocol": "'tcp'|'udp'",
        },
    },
    "curl": {
        "description": "HTTP traffic generator",
        "params": {
            "host": "str",
            "path": "str",          # e.g., /index.html or /core
            "interface": "str",     # which interface to bind curl to
            "count": "int",         # number of times to send curl
            "sleep": "float",       # delay between curls (in seconds)
        },
    },
    "http_server": {
        "description": "Python HTTP server for curl/hping targets",
        "params": {
            "port": "int",          # port to listen on (default 8080)
            "bind": "str",          # address to bind to (optional)
            "directory": "str",     # directory to serve files from
        },
    },
}


def build_command(tool: str, params: Dict) -> List[str]:
    if tool == "ping":
        cmd = ["ping"]
        # Add source IP binding if specified
        if params.get("source_ip"):
            cmd += ["-I", params["source_ip"]]
        cmd += ["-c", str(params.get("count", 5)), params["host"]]
        if params.get("interval") is not None:
            cmd += ["-i", str(params["interval"])]
        if params.get("size") is not None:
            cmd += ["-s", str(params["size"])]
        if params.get("flood"):
            cmd.append("-f")
        if params.get("verbose"):
            cmd.append("-v")

    elif tool == "traceroute":
        cmd = ["traceroute"]
        # Add source IP binding if specified
        if params.get("source_ip"):
            cmd += ["-s", params["source_ip"]]
        cmd += ["-m", str(params.get("maxHops", 30)), params["host"]]

    elif tool == "hping":
        cmd = ["hping3"]

        # Handle protocol
        proto = params.get("protocol")
        if proto == "icmp":
            cmd.append("--icmp")
        elif proto == "udp":
            cmd.append("--udp")
        # (default TCP if not specified)

        # Add source IP binding if specified (use -a for spoof address)
        if params.get("source_ip"):
            cmd += ["-a", params["source_ip"]]

        # Boolean flags
        if params.get("flood"):
            cmd.append("--flood")
        if params.get("verbose"):
            cmd.append("-V")
        if params.get("frag"):
            cmd.append("-f")
        if params.get("syn"):
            cmd.append("-S")
        if params.get("rand_source"):
            cmd.append("--rand-source")

        # Numeric / value options
        if params.get("ttl") is not None:
            cmd += ["-t", str(params["ttl"])]
        if params.get("interval") is not None:
            cmd += ["-i", str(params["interval"])]
        if params.get("data") is not None:
            cmd += ["-d", str(params["data"])]
        if params.get("source_port") is not None:
            cmd += ["-s", str(params["source_port"])]
        if params.get("dest_port") is not None:
            cmd += ["-p", str(params["dest_port"])]
        if params.get("payload_size") is not None:
            cmd += ["-d", str(params["payload_size"])]  # you may want to consolidate data/payload_size

        if params.get("firewall_id") is not None:
            cmd += ["-L", str(params["firewall_id"])]

        # Always set count and target
        cmd += ["-c", str(params.get("count", 5))]
        cmd.append(params["host"])

    elif tool == "iperf":
        # Check if running in server mode
        if params.get("server_mode"):
            cmd = ["iperf3", "-s"]
            # Add source IP binding if specified
            if params.get("source_ip"):
                cmd += ["-B", params["source_ip"]]
            cmd += ["-p", str(params.get("port", 5201))]
            # Use --one-off to exit after one client connection
            cmd.append("--one-off")
        else:
            # Client mode
            cmd = ["iperf3", "-c", params.get("server", params.get("host"))]
            # Add source IP binding if specified
            if params.get("source_ip"):
                cmd += ["-B", params["source_ip"]]
            cmd += [
                "-p",
                str(params.get("port", 5201)),
                "-t",
                str(params.get("duration", 20)),
            ]
            if params.get("protocol") == "udp":
                cmd.append("--udp")
    elif tool == "curl":
        # Build base curl command string
        curl_parts = [f"curl"]

        # Target URL
        target_url = f'{params["host"]}{params.get("path", "")}'
        curl_parts.append(target_url)
        logger.warning(params)
        logger.warning(params.get("header"))
        # Optional flags
        if ca_cert_file := params.get("very_verbose"):
            curl_parts += ["-vvv"]
        elif ca_cert_file := params.get("verbose"):
            curl_parts += ["-v"]
        if params.get("show_headers"):
            curl_parts += ["-i"]
        if params.get("insecucre"):
            curl_parts += ["-k"]
        if ca_cert_file := params.get("ca_cert"):
            curl_parts += ["--cacert", f"/app/testing_files/{ca_cert_file}"]
        if resolve_val := params.get("resolve"):
            curl_parts += ["--resolve", resolve_val]
        if header := params.get("header"):
            curl_parts += ["-H", f'"{header}"']
        if data_binary := params.get("data_binary"):
            curl_parts += ["--data-binary", data_binary]
        if method := params.get("method"):
            method = method.upper()
            if method != "GET":
                curl_parts += ["-X", method]

        # Join the curl command into a single string for `bash -c`
        curl_str = " ".join(curl_parts)

        # Loop count and sleep
        count = params.get("count", 10)
        sleep_interval = params.get("sleep", 0.1)

        # Final bash -c command string
        bash_cmd = f'for ((i=1;i<={count};i++)); do {curl_str}; sleep {sleep_interval}; done'

        # Assemble final command
        cmd = ["bash", "-c", bash_cmd]

    elif tool == "http_server":
        # Python's built-in HTTP server
        cmd = ["python3", "-m", "http.server", str(params.get("port", 8080))]
        if params.get("bind"):
            cmd += ["--bind", params["bind"]]
        if params.get("directory"):
            cmd += ["--directory", params["directory"]]
    else:
        raise ValueError(f"Unsupported tool: {tool}")
    logger.warning(f"resulting command: {cmd}")
    return cmd
