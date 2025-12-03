"""
Simple BMP (BGP Monitoring Protocol) Server
Listens on TCP port 11019 and collects BGP route information from BMP clients (GoBGP, FRR, etc.)
Also provides an HTTP API to query collected routes.
"""

import asyncio
import logging
import os
import struct
import sys
from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [BMP] %(message)s",
    stream=sys.stderr
)
logger = logging.getLogger("bmp-server")

# BMP message types (RFC 7854)
BMP_MSG_TYPE_ROUTE_MONITORING = 0
BMP_MSG_TYPE_STATISTICS = 1
BMP_MSG_TYPE_PEER_DOWN = 2
BMP_MSG_TYPE_PEER_UP = 3
BMP_MSG_TYPE_INITIATION = 4
BMP_MSG_TYPE_TERMINATION = 5
BMP_MSG_TYPE_ROUTE_MIRRORING = 6

# Global storage for BMP data
bmp_peers = {}  # peer_key -> peer_info
bmp_routes = defaultdict(lambda: {"advertised": [], "received": []})  # peer_key -> {advertised: [{prefix, timestamp}], received: []}
bmp_stats = defaultdict(dict)  # peer_key -> stats
flowspec_timestamps = {}  # flowspec_key -> timestamp

app = FastAPI(title="BMP Server", description="BGP Monitoring Protocol Collector", version="1.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def parse_bmp_header(data: bytes):
    """
    Parse BMP common header (RFC 7854 Section 4.1)

    0                   1                   2                   3
    0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
    +-+-+-+-+-+-+-+-+
    |    Version    |
    +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
    |                        Message Length                         |
    +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
    |   Msg. Type   |
    +-+-+-+-+-+-+-+-+
    """
    if len(data) < 6:
        return None

    version = data[0]
    msg_length = struct.unpack("!I", data[1:5])[0]
    msg_type = data[5]

    return {
        "version": version,
        "length": msg_length,
        "type": msg_type,
        "payload": data[6:msg_length] if len(data) >= msg_length else data[6:]
    }


def parse_bmp_per_peer_header(data: bytes):
    """
    Parse BMP Per-Peer Header (RFC 7854 Section 4.2)
    Returns peer information and offset to message payload
    """
    if len(data) < 42:
        return None, 0

    peer_type = data[0]
    peer_flags = data[1]
    peer_distinguisher = data[2:10]

    # Parse peer address (IPv4 or IPv6)
    peer_addr_bytes = data[10:26]
    is_ipv6 = (peer_flags & 0x80) != 0
    is_post_policy = (peer_flags & 0x01) != 0  # L flag: 0=Adj-RIB-In (received), 1=Loc-RIB (advertised)

    if is_ipv6:
        # IPv6 address
        peer_address = ":".join([f"{b:02x}" for b in peer_addr_bytes])
    else:
        # IPv4 address (last 4 bytes)
        peer_address = ".".join([str(b) for b in peer_addr_bytes[12:16]])

    peer_as = struct.unpack("!I", data[26:30])[0]
    peer_bgp_id = ".".join([str(b) for b in data[30:34]])

    timestamp_sec = struct.unpack("!I", data[34:38])[0]
    timestamp_usec = struct.unpack("!I", data[38:42])[0]

    peer_info = {
        "type": peer_type,
        "address": peer_address,
        "as": peer_as,
        "bgp_id": peer_bgp_id,
        "timestamp": datetime.fromtimestamp(timestamp_sec).isoformat(),
        "is_post_policy": is_post_policy,  # True = advertised (Loc-RIB), False = received (Adj-RIB-In)
    }

    return peer_info, 42  # Per-peer header is 42 bytes


def parse_bgp_path_attributes(data: bytes, attr_len: int):
    """
    Parse BGP path attributes to extract useful information
    Returns dict with: next_hop, as_path, communities, local_pref, med, origin, mp_reach_nlri, mp_unreach_nlri
    """
    attributes = {
        "next_hop": None,
        "as_path": [],
        "communities": [],
        "local_pref": None,
        "med": None,
        "origin": None,
        "mp_reach_nlri": None,
        "mp_unreach_nlri": None
    }

    offset = 0
    while offset < attr_len:
        if offset + 2 > attr_len:
            break

        flags = data[offset]
        type_code = data[offset + 1]
        offset += 2

        # Check if length is 1 or 2 bytes (extended length flag)
        extended = (flags & 0x10) != 0
        if extended:
            if offset + 2 > attr_len:
                break
            length = struct.unpack("!H", data[offset:offset+2])[0]
            offset += 2
        else:
            if offset + 1 > attr_len:
                break
            length = data[offset]
            offset += 1

        if offset + length > attr_len:
            break

        attr_data = data[offset:offset+length]

        # Parse specific attribute types
        if type_code == 1:  # ORIGIN
            if length >= 1:
                origin_val = attr_data[0]
                attributes["origin"] = ["IGP", "EGP", "INCOMPLETE"][origin_val] if origin_val < 3 else f"Unknown({origin_val})"

        elif type_code == 2:  # AS_PATH
            as_path = []
            i = 0
            while i < length:
                if i + 2 > length:
                    break
                segment_type = attr_data[i]
                segment_len = attr_data[i+1]
                i += 2

                asns = []
                for _ in range(segment_len):
                    if i + 4 > length:
                        break
                    asn = struct.unpack("!I", attr_data[i:i+4])[0]
                    asns.append(asn)
                    i += 4

                if segment_type == 2:  # AS_SEQUENCE
                    as_path.extend(asns)
                elif segment_type == 1:  # AS_SET
                    as_path.append(f"{{{','.join(map(str, asns))}}}")

            attributes["as_path"] = as_path

        elif type_code == 3:  # NEXT_HOP
            if length == 4:
                attributes["next_hop"] = ".".join([str(b) for b in attr_data[:4]])

        elif type_code == 4:  # MULTI_EXIT_DISC (MED)
            if length == 4:
                attributes["med"] = struct.unpack("!I", attr_data[:4])[0]

        elif type_code == 5:  # LOCAL_PREF
            if length == 4:
                attributes["local_pref"] = struct.unpack("!I", attr_data[:4])[0]

        elif type_code == 8:  # COMMUNITIES
            communities = []
            for i in range(0, length, 4):
                if i + 4 <= length:
                    asn = struct.unpack("!H", attr_data[i:i+2])[0]
                    val = struct.unpack("!H", attr_data[i+2:i+4])[0]
                    communities.append(f"{asn}:{val}")
            attributes["communities"] = communities

        elif type_code == 14:  # MP_REACH_NLRI
            # Store raw data for later parsing based on AFI/SAFI
            attributes["mp_reach_nlri"] = attr_data[:length]

        elif type_code == 15:  # MP_UNREACH_NLRI
            # Store raw data for later parsing based on AFI/SAFI
            attributes["mp_unreach_nlri"] = attr_data[:length]

        offset += length

    return attributes


def parse_flowspec_nlri(data: bytes):
    """
    Parse FlowSpec NLRI from MP_REACH_NLRI
    Returns list of flowspec rules
    """
    rules = []
    try:
        if len(data) < 3:
            return rules

        # Skip AFI (2 bytes) and SAFI (1 byte) - already validated
        offset = 3

        # Next hop length
        if offset >= len(data):
            return rules
        nh_len = data[offset]
        offset += 1 + nh_len  # Skip next hop

        # Reserved byte
        offset += 1

        # Parse flowspec NLRI components
        while offset < len(data):
            if offset + 2 > len(data):
                break

            # FlowSpec NLRI length (2 bytes)
            nlri_len = struct.unpack("!H", data[offset:offset+2])[0]
            offset += 2

            if offset + nlri_len > len(data):
                break

            nlri_data = data[offset:offset+nlri_len]
            rule = parse_flowspec_components(nlri_data)
            if rule:
                rules.append(rule)

            offset += nlri_len

    except Exception as e:
        logger.debug(f"[BMP] Error parsing flowspec NLRI: {e}")

    return rules


def parse_flowspec_components(data: bytes):
    """
    Parse individual flowspec rule components
    Returns dict with match criteria
    """
    rule = {}
    offset = 0

    try:
        while offset < len(data):
            if offset >= len(data):
                break

            comp_type = data[offset]
            offset += 1

            # Type 1: Destination Prefix
            if comp_type == 1:
                if offset >= len(data):
                    break
                prefix_len = data[offset]
                offset += 1
                bytes_needed = (prefix_len + 7) // 8
                if offset + bytes_needed > len(data):
                    break
                prefix_bytes = data[offset:offset+bytes_needed] + b'\x00' * (4 - bytes_needed)
                prefix_ip = ".".join([str(b) for b in prefix_bytes[:4]])
                rule["destination"] = f"{prefix_ip}/{prefix_len}"
                offset += bytes_needed

            # Type 2: Source Prefix
            elif comp_type == 2:
                if offset >= len(data):
                    break
                prefix_len = data[offset]
                offset += 1
                bytes_needed = (prefix_len + 7) // 8
                if offset + bytes_needed > len(data):
                    break
                prefix_bytes = data[offset:offset+bytes_needed] + b'\x00' * (4 - bytes_needed)
                prefix_ip = ".".join([str(b) for b in prefix_bytes[:4]])
                rule["source"] = f"{prefix_ip}/{prefix_len}"
                offset += bytes_needed

            # Type 3: IP Protocol
            elif comp_type == 3:
                # Skip operator byte and get value
                if offset + 1 >= len(data):
                    break
                offset += 1  # Skip operator
                rule["protocol"] = data[offset]
                offset += 1

            # Types 4-6: Ports
            elif comp_type in [4, 5, 6]:
                # Skip operator and get port value (2 bytes)
                if offset + 2 >= len(data):
                    break
                offset += 1  # Skip operator
                port = struct.unpack("!H", data[offset:offset+2])[0]
                if comp_type == 4:
                    rule["port"] = port
                elif comp_type == 5:
                    rule["dest_port"] = port
                elif comp_type == 6:
                    rule["source_port"] = port
                offset += 2

            else:
                # Unknown component, try to skip it
                break

    except Exception as e:
        logger.debug(f"[BMP] Error parsing flowspec components: {e}")

    return rule if rule else None


def parse_vpn_nlri(data: bytes):
    """
    Parse VPNv4/VPNv6 NLRI from MP_REACH_NLRI
    Returns list of VPN routes
    """
    routes = []
    try:
        if len(data) < 3:
            return routes

        # Skip AFI (2 bytes) and SAFI (1 byte)
        offset = 3

        # Next hop length
        if offset >= len(data):
            return routes
        nh_len = data[offset]
        offset += 1

        # Parse next hop (RD + IPv4 address for VPNv4)
        next_hop = None
        if nh_len >= 12:  # 8 bytes RD + 4 bytes IPv4
            rd = data[offset:offset+8]
            nh_bytes = data[offset+8:offset+12]
            next_hop = ".".join([str(b) for b in nh_bytes])
            offset += nh_len

        # Reserved byte
        if offset < len(data):
            offset += 1

        # Parse VPN prefixes
        while offset < len(data):
            if offset + 1 > len(data):
                break

            # Prefix length (in bits, includes RD + label + prefix)
            bit_len = data[offset]
            offset += 1

            # Calculate total bytes needed
            byte_len = (bit_len + 7) // 8

            if offset + byte_len > len(data):
                break

            prefix_data = data[offset:offset+byte_len]

            # Parse label stack (3 bytes per label)
            label_offset = 0
            labels = []
            while label_offset + 3 <= len(prefix_data):
                label_bytes = prefix_data[label_offset:label_offset+3]
                label = (label_bytes[0] << 12) | (label_bytes[1] << 4) | (label_bytes[2] >> 4)
                bottom_of_stack = (label_bytes[2] & 0x01) != 0
                labels.append(label)
                label_offset += 3
                if bottom_of_stack:
                    break

            # Parse Route Distinguisher (8 bytes)
            if label_offset + 8 <= len(prefix_data):
                rd_bytes = prefix_data[label_offset:label_offset+8]
                rd_type = struct.unpack("!H", rd_bytes[0:2])[0]
                if rd_type == 0:  # Type 0: ASN:nn
                    rd_asn = struct.unpack("!H", rd_bytes[2:4])[0]
                    rd_num = struct.unpack("!I", rd_bytes[4:8])[0]
                    rd = f"{rd_asn}:{rd_num}"
                elif rd_type == 1:  # Type 1: IP:nn
                    rd_ip = ".".join([str(b) for b in rd_bytes[2:6]])
                    rd_num = struct.unpack("!H", rd_bytes[6:8])[0]
                    rd = f"{rd_ip}:{rd_num}"
                else:
                    rd = "unknown"
                label_offset += 8

            # Parse IP prefix
            prefix_bit_len = bit_len - (label_offset * 8)
            prefix_byte_len = (prefix_bit_len + 7) // 8
            if label_offset + prefix_byte_len <= len(prefix_data):
                prefix_bytes = prefix_data[label_offset:label_offset+prefix_byte_len]
                # Pad to 4 bytes for IPv4
                prefix_bytes = prefix_bytes + b'\x00' * (4 - len(prefix_bytes))
                prefix_ip = ".".join([str(b) for b in prefix_bytes[:4]])

                routes.append({
                    "prefix": f"{prefix_ip}/{prefix_bit_len}",
                    "rd": rd,
                    "labels": labels,
                    "next_hop": next_hop
                })

            offset += byte_len

    except Exception as e:
        logger.debug(f"[BMP] Error parsing VPN NLRI: {e}")

    return routes


def parse_bgp_update(data: bytes, peer_key: str, is_post_policy: bool = True):
    """
    BGP UPDATE message parser
    Extracts prefixes and path attributes (next hop, communities, AS path, etc.)

    Args:
        data: BGP UPDATE message bytes
        peer_key: Unique identifier for the peer (address_asn)
        is_post_policy: True if routes are from Loc-RIB (advertised), False if from Adj-RIB-In (received)
    """
    try:
        if len(data) < 23:  # Minimum BGP message size
            return

        # Determine which list to use based on policy flag
        route_direction = "advertised" if is_post_policy else "received"

        # BGP header is 19 bytes, skip to UPDATE-specific data
        marker = data[0:16]
        length = struct.unpack("!H", data[16:18])[0]
        msg_type = data[18]

        if msg_type != 2:  # UPDATE message type
            return

        offset = 19

        # Withdrawn routes length
        if len(data) < offset + 2:
            return
        withdrawn_len = struct.unpack("!H", data[offset:offset+2])[0]
        offset += 2 + withdrawn_len

        # Path attributes length
        if len(data) < offset + 2:
            return
        path_attr_len = struct.unpack("!H", data[offset:offset+2])[0]

        # Parse path attributes
        path_attrs = {}
        if path_attr_len > 0:
            attr_data = data[offset+2:offset+2+path_attr_len]
            path_attrs = parse_bgp_path_attributes(attr_data, path_attr_len)

        offset += 2 + path_attr_len

        # NLRI (advertised prefixes)
        advertised_prefixes = []
        while offset < length:
            if offset >= len(data):
                break
            prefix_len = data[offset]
            offset += 1
            bytes_needed = (prefix_len + 7) // 8

            if offset + bytes_needed > len(data):
                break

            prefix_bytes = data[offset:offset+bytes_needed]
            # Pad to 4 bytes for IPv4
            prefix_bytes = prefix_bytes + b'\x00' * (4 - len(prefix_bytes))
            prefix_ip = ".".join([str(b) for b in prefix_bytes[:4]])
            advertised_prefixes.append(f"{prefix_ip}/{prefix_len}")
            offset += bytes_needed

        # Check for MP_REACH_NLRI (flowspec, VPN routes, etc.)
        if path_attrs.get("mp_reach_nlri"):
            mp_data = path_attrs["mp_reach_nlri"]
            if len(mp_data) >= 3:
                afi = struct.unpack("!H", mp_data[0:2])[0]
                safi = mp_data[2]

                # IPv4 FlowSpec (AFI=1, SAFI=133)
                if afi == 1 and safi == 133:
                    flowspec_rules = parse_flowspec_nlri(mp_data)
                    if flowspec_rules:
                        timestamp = datetime.now().isoformat()
                        for rule in flowspec_rules:
                            route_data = {
                                "type": "flowspec",
                                "rule": rule,
                                "timestamp": timestamp,
                                "as_path": path_attrs.get("as_path", []),
                                "communities": path_attrs.get("communities", []),
                                "origin": path_attrs.get("origin")
                            }
                            # Use a unique key for flowspec rules
                            rule_key = f"flowspec:{rule.get('destination', rule.get('source', 'unknown'))}"
                            existing_prefixes = {r.get("prefix", r.get("rule_key", "")): r for r in bmp_routes[peer_key][route_direction]}
                            existing_prefixes[rule_key] = route_data
                            bmp_routes[peer_key][route_direction] = list(existing_prefixes.values())
                        logger.info(f"[BMP] Peer {peer_key} advertised {len(flowspec_rules)} flowspec rules")

                # IPv4 VPN (AFI=1, SAFI=128)
                elif afi == 1 and safi == 128:
                    vpn_routes = parse_vpn_nlri(mp_data)
                    if vpn_routes:
                        timestamp = datetime.now().isoformat()
                        for vpn_route in vpn_routes:
                            route_data = {
                                "type": "vpn",
                                "prefix": vpn_route["prefix"],
                                "rd": vpn_route["rd"],
                                "labels": vpn_route["labels"],
                                "timestamp": timestamp,
                                "next_hop": vpn_route.get("next_hop"),
                                "as_path": path_attrs.get("as_path", []),
                                "communities": path_attrs.get("communities", []),
                                "origin": path_attrs.get("origin")
                            }
                            vpn_key = f"{vpn_route['rd']}:{vpn_route['prefix']}"
                            existing_prefixes = {r.get("prefix", ""): r for r in bmp_routes[peer_key][route_direction]}
                            existing_prefixes[vpn_key] = route_data
                            bmp_routes[peer_key][route_direction] = list(existing_prefixes.values())
                        logger.info(f"[BMP] Peer {peer_key} advertised {len(vpn_routes)} VPN routes")

        # Regular IPv4 unicast routes
        if advertised_prefixes:
            logger.info(f"[BMP] Peer {peer_key} advertised: {advertised_prefixes} with attrs: {path_attrs}")
            # Add timestamp and attributes to each route
            timestamp = datetime.now().isoformat()
            routes_with_data = [
                {
                    "type": "unicast",
                    "prefix": prefix,
                    "timestamp": timestamp,
                    "next_hop": path_attrs.get("next_hop"),
                    "as_path": path_attrs.get("as_path", []),
                    "communities": path_attrs.get("communities", []),
                    "local_pref": path_attrs.get("local_pref"),
                    "med": path_attrs.get("med"),
                    "origin": path_attrs.get("origin")
                }
                for prefix in advertised_prefixes
            ]

            # Deduplicate by prefix - keep newer timestamp
            existing_prefixes = {r.get("prefix", ""): r for r in bmp_routes[peer_key][route_direction]}
            for route in routes_with_data:
                existing_prefixes[route["prefix"]] = route
            bmp_routes[peer_key][route_direction] = list(existing_prefixes.values())

    except Exception as e:
        logger.debug(f"[BMP] Error parsing BGP UPDATE: {e}")


async def handle_bmp_message(data: bytes, client_addr: str):
    """Handle a complete BMP message"""
    try:
        header = parse_bmp_header(data)
        if not header:
            logger.warning(f"[BMP] Invalid BMP header from {client_addr}")
            return

        msg_type = header["type"]
        payload = header["payload"]

        if msg_type == BMP_MSG_TYPE_INITIATION:
            logger.info(f"[BMP] Initiation message from {client_addr}")

        elif msg_type == BMP_MSG_TYPE_PEER_UP:
            peer_info, offset = parse_bmp_per_peer_header(payload)
            if peer_info:
                peer_key = f"{peer_info['address']}_{peer_info['as']}"
                bmp_peers[peer_key] = peer_info
                logger.info(f"[BMP] Peer UP: {peer_info['address']} AS{peer_info['as']}")

        elif msg_type == BMP_MSG_TYPE_PEER_DOWN:
            peer_info, offset = parse_bmp_per_peer_header(payload)
            if peer_info:
                peer_key = f"{peer_info['address']}_{peer_info['as']}"
                logger.info(f"[BMP] Peer DOWN: {peer_info['address']} AS{peer_info['as']}")
                # Keep peer in list but mark as down
                if peer_key in bmp_peers:
                    bmp_peers[peer_key]["state"] = "down"

        elif msg_type == BMP_MSG_TYPE_ROUTE_MONITORING:
            peer_info, offset = parse_bmp_per_peer_header(payload)
            if peer_info:
                peer_key = f"{peer_info['address']}_{peer_info['as']}"
                # Ensure peer exists
                if peer_key not in bmp_peers:
                    bmp_peers[peer_key] = peer_info

                # Parse BGP UPDATE message that follows per-peer header
                bgp_message = payload[offset:]
                is_post_policy = peer_info.get("is_post_policy", True)
                parse_bgp_update(bgp_message, peer_key, is_post_policy)

        elif msg_type == BMP_MSG_TYPE_STATISTICS:
            peer_info, offset = parse_bmp_per_peer_header(payload)
            if peer_info:
                peer_key = f"{peer_info['address']}_{peer_info['as']}"
                logger.debug(f"[BMP] Statistics from peer {peer_key}")

        elif msg_type == BMP_MSG_TYPE_ROUTE_MIRRORING:
            logger.debug(f"[BMP] Route mirroring message from {client_addr}")

        elif msg_type == BMP_MSG_TYPE_TERMINATION:
            logger.info(f"[BMP] Termination message from {client_addr}")

        else:
            logger.warning(f"[BMP] Unknown message type {msg_type} from {client_addr}")

    except Exception as e:
        logger.error(f"[BMP] Error handling message from {client_addr}: {e}")


async def handle_bmp_client(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
    """Handle a BMP client connection"""
    client_addr = writer.get_extra_info('peername')
    logger.info(f"[BMP] New connection from {client_addr}")

    try:
        while True:
            # Read BMP common header first (6 bytes: version + length + type)
            header_data = await reader.readexactly(6)
            if not header_data:
                break

            # Extract message length
            msg_length = struct.unpack("!I", header_data[1:5])[0]

            # Read the rest of the message
            remaining = msg_length - 6
            if remaining > 0:
                payload_data = await reader.readexactly(remaining)
                full_message = header_data + payload_data
            else:
                full_message = header_data

            # Handle the complete message
            await handle_bmp_message(full_message, str(client_addr))

    except asyncio.IncompleteReadError:
        logger.info(f"[BMP] Client {client_addr} disconnected")
    except Exception as e:
        logger.error(f"[BMP] Error with client {client_addr}: {e}")
    finally:
        writer.close()
        await writer.wait_closed()


async def start_bmp_server(host: str, port: int):
    """Start the BMP TCP server"""
    server = await asyncio.start_server(handle_bmp_client, host, port)
    logger.info(f"[BMP] Server listening on {host}:{port}")

    async with server:
        await server.serve_forever()


# FastAPI HTTP endpoints for querying BMP data

@app.get("/peers")
async def get_peers():
    """Get all BMP peers"""
    return {"peers": list(bmp_peers.values())}


@app.get("/routes")
async def get_all_routes():
    """Get all routes from all peers"""
    return {"routes": dict(bmp_routes)}


@app.get("/routes/{peer_address}")
async def get_peer_routes(peer_address: str):
    """Get routes for a specific peer"""
    # Find peer by address
    matching_keys = [k for k in bmp_routes.keys() if k.startswith(peer_address)]
    if not matching_keys:
        raise HTTPException(404, f"No routes found for peer {peer_address}")

    peer_key = matching_keys[0]
    return {
        "peer": peer_address,
        "routes": bmp_routes[peer_key]
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "peers_count": len(bmp_peers),
        "routes_count": sum(len(r["advertised"]) + len(r["received"]) for r in bmp_routes.values())
    }


@app.get("/flowspec")
async def get_flowspec_routes():
    """
    Get flowspec routes from GoBGP directly
    Since flowspec routes are often locally originated and not in BMP,
    we fetch them directly from GoBGP's API
    """
    try:
        import aiohttp
        import os

        # Query the unified API for flowspec rules
        flowspec_host = os.getenv("FLOWSPEC_API_HOST", "gobgp1")
        flowspec_port = os.getenv("FLOWSPEC_API_PORT", "5000")
        url = f'http://{flowspec_host}:{flowspec_port}/flowspec?backend=gobgp'

        timeout = aiohttp.ClientTimeout(total=2)  # Reduced from 5 to 2 seconds
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(url) as response:
                data = await response.json()
                rules = data.get("rules", [])

                # Add timestamps to each rule (track first seen time)
                current_time = datetime.now().isoformat()
                for rule in rules:
                    # Create a key from the match criteria
                    match = rule.get("match", {})
                    rule_key = f"{match.get('destination', '')}{match.get('source', '')}{match.get('protocol', '')}{match.get('destination_port', '')}"

                    # If we haven't seen this rule before, record current time
                    if rule_key not in flowspec_timestamps:
                        flowspec_timestamps[rule_key] = current_time

                    # Add timestamp to the rule
                    rule["timestamp"] = flowspec_timestamps[rule_key]

                return {
                    "source": "gobgp_api",
                    "rules": rules,
                    "count": len(rules)
                }
    except asyncio.TimeoutError:
        logger.warning(f"[BMP] Timeout fetching flowspec from GoBGP")
        return {"source": "gobgp_api", "rules": [], "count": 0, "error": "Timeout connecting to GoBGP API"}
    except aiohttp.ClientError as e:
        logger.warning(f"[BMP] Connection error fetching flowspec from GoBGP: {e}")
        return {"source": "gobgp_api", "rules": [], "count": 0, "error": f"Connection error: {str(e)}"}
    except Exception as e:
        logger.error(f"[BMP] Error fetching flowspec from GoBGP: {e}")
        return {"source": "gobgp_api", "rules": [], "count": 0, "error": str(e)}


# Start BMP server in background
@app.on_event("startup")
async def startup_event():
    """Start BMP TCP server when FastAPI starts"""
    host = os.getenv("BMP_LISTEN_HOST", "0.0.0.0")
    port = int(os.getenv("BMP_LISTEN_PORT", "11019"))

    # Run BMP server in background
    asyncio.create_task(start_bmp_server(host, port))
    logger.info("[BMP] FastAPI server started with BMP collector")


if __name__ == "__main__":
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
                "uvicorn": {"handlers": ["default"], "level": "INFO"},
                "uvicorn.error": {"level": "INFO"},
                "uvicorn.access": {"handlers": [], "level": "ERROR"},
            },
        }
    )
