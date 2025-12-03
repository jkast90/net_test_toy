#!/usr/bin/env python3
"""
NetFlow/IPFIX Collector Server
Receives NetFlow v5/v9 and IPFIX flow exports from routers
Provides REST API for querying flow data
"""

import asyncio
import json
import logging
import socket
import struct
import time
import requests
from collections import defaultdict, deque
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="NetFlow Collector API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Flow storage - keep last 10,000 flows in memory
MAX_FLOWS = 10000
flows_storage = deque(maxlen=MAX_FLOWS)
flow_stats = {
    'total_flows': 0,
    'total_packets': 0,
    'total_bytes': 0,
    'exporters': {},
    'protocols': defaultdict(int),
    'top_talkers': defaultdict(lambda: {'bytes': 0, 'packets': 0, 'flows': 0})
}

# Time-windowed traffic tracking for rate-based trigger evaluation
# This tracks traffic per IP address over a sliding time window (same as Top Talkers pane)
TRAFFIC_WINDOW_SECONDS = 60  # Track traffic over the last 60 seconds
traffic_window = {
    'entries': deque(maxlen=10000),  # (timestamp, src_addr, dst_addr, bytes, packets)
    'last_cleanup': time.time()
}

# Trigger storage
triggers_storage = []
triggered_events = deque(maxlen=1000)  # Keep last 1000 trigger events

# Container manager URL for syncing triggers from topology database
CONTAINER_MANAGER_URL = "http://container-manager:5000"

def sync_triggers_from_topology():
    """
    Sync triggers from the topology database via container-manager API.
    This allows triggers created in the UI to be evaluated by the monitoring service.
    """
    global triggers_storage

    try:
        # Get active topology
        response = requests.get(f"{CONTAINER_MANAGER_URL}/topologies/active", timeout=5)
        if response.status_code != 200:
            logger.debug("No active topology found for trigger sync")
            return

        data = response.json()
        active_topology = data.get('active')
        if not active_topology:
            logger.debug("No active topology")
            return

        topology_name = active_topology.get('name')
        if not topology_name:
            return

        # Get triggers for this topology
        response = requests.get(f"{CONTAINER_MANAGER_URL}/topologies/{topology_name}/triggers", timeout=5)
        if response.status_code != 200:
            logger.warning(f"Failed to fetch triggers for topology {topology_name}")
            return

        trigger_data = response.json()
        db_triggers = trigger_data.get('triggers', [])

        # Convert database format to in-memory format
        new_triggers = []
        for t in db_triggers:
            trigger = {
                'id': str(t.get('id')),
                'name': t.get('name'),
                'enabled': bool(t.get('enabled', True)),
                'conditions': {},
                'action': {
                    'type': t.get('action_type', 'log')
                }
            }

            # Build conditions from flat fields
            if t.get('min_kbps'):
                trigger['conditions']['min_kbps'] = float(t['min_kbps'])
            if t.get('min_mbps'):
                trigger['conditions']['min_mbps'] = float(t['min_mbps'])
            if t.get('min_pps'):
                trigger['conditions']['min_pps'] = float(t['min_pps'])
            if t.get('min_bytes'):
                trigger['conditions']['min_bytes'] = int(t['min_bytes'])
            if t.get('src_addr'):
                trigger['conditions']['src_addr'] = t['src_addr']
            if t.get('dst_addr'):
                trigger['conditions']['dst_addr'] = t['dst_addr']
            if t.get('src_or_dst_addr'):
                trigger['conditions']['src_or_dst_addr'] = t['src_or_dst_addr']
            if t.get('protocol'):
                trigger['conditions']['protocol'] = int(t['protocol'])

            # Build action
            if t.get('action_message'):
                trigger['action']['message'] = t['action_message']
            if t.get('rate_limit_kbps'):
                trigger['action']['rate_limit_kbps'] = float(t['rate_limit_kbps'])

            new_triggers.append(trigger)

        # Only update if there are changes
        if len(new_triggers) != len(triggers_storage):
            triggers_storage.clear()
            triggers_storage.extend(new_triggers)
            logger.info(f"Synced {len(new_triggers)} triggers from topology '{topology_name}'")
        else:
            # Check if content changed
            current_ids = {t.get('id') for t in triggers_storage}
            new_ids = {t.get('id') for t in new_triggers}
            if current_ids != new_ids:
                triggers_storage.clear()
                triggers_storage.extend(new_triggers)
                logger.info(f"Synced {len(new_triggers)} triggers from topology '{topology_name}'")

    except requests.exceptions.RequestException as e:
        logger.debug(f"Could not sync triggers from container-manager: {e}")
    except Exception as e:
        logger.error(f"Error syncing triggers: {e}")

# WebSocket connections for real-time notifications (trigger events)
active_websockets: List[WebSocket] = []

# WebSocket connections for raw flow streaming
flow_stream_websockets: List[WebSocket] = []

# Track recently notified flows to prevent duplicate notifications
# Key: (trigger_id, flow_key), Value: timestamp of last notification
recent_notifications = {}
NOTIFICATION_COOLDOWN_SECONDS = 60  # Don't re-notify for same flow within 60 seconds

async def broadcast_notification(notification: dict):
    """Broadcast notification to all connected WebSocket clients"""
    disconnected = []
    for websocket in active_websockets:
        try:
            await websocket.send_json(notification)
        except Exception as e:
            logger.warning(f"Failed to send notification to WebSocket client: {e}")
            disconnected.append(websocket)

    # Remove disconnected clients
    for ws in disconnected:
        if ws in active_websockets:
            active_websockets.remove(ws)


async def broadcast_flow(flow: dict):
    """Broadcast raw flow data to all connected flow stream clients"""
    if not flow_stream_websockets:
        return

    disconnected = []
    for websocket in flow_stream_websockets:
        try:
            await websocket.send_json({
                'type': 'flow',
                'data': flow
            })
        except Exception as e:
            logger.debug(f"Failed to send flow to WebSocket client: {e}")
            disconnected.append(websocket)

    # Remove disconnected clients
    for ws in disconnected:
        if ws in flow_stream_websockets:
            flow_stream_websockets.remove(ws)


class NetFlowV5Parser:
    """Parse NetFlow v5 packets"""

    HEADER_FORMAT = '!HHIIIIBBH'
    RECORD_FORMAT = '!IIIHHIIIIHHBBBBHHBBH'
    HEADER_SIZE = 24
    RECORD_SIZE = 48

    @staticmethod
    def parse(data: bytes, source_ip: str) -> List[Dict]:
        """Parse NetFlow v5 packet"""
        if len(data) < NetFlowV5Parser.HEADER_SIZE:
            logger.warning(f"Packet too small for NetFlow v5 header: {len(data)} bytes")
            return []

        # Parse header
        header = struct.unpack(NetFlowV5Parser.HEADER_FORMAT, data[:NetFlowV5Parser.HEADER_SIZE])
        version, count = header[0], header[1]

        if version != 5:
            logger.warning(f"Expected NetFlow v5, got version {version}")
            return []

        sys_uptime, unix_secs, unix_nsecs = header[2], header[3], header[4]
        flow_sequence = header[5]
        engine_type, engine_id = header[6], header[7]

        flows = []
        offset = NetFlowV5Parser.HEADER_SIZE

        for i in range(count):
            if offset + NetFlowV5Parser.RECORD_SIZE > len(data):
                logger.warning(f"Truncated NetFlow v5 packet at record {i}")
                break

            record_data = data[offset:offset + NetFlowV5Parser.RECORD_SIZE]
            record = struct.unpack(NetFlowV5Parser.RECORD_FORMAT, record_data)

            flow = {
                'version': 5,
                'exporter': source_ip,
                'timestamp': datetime.utcnow().isoformat(),
                'src_addr': socket.inet_ntoa(struct.pack('!I', record[0])),
                'dst_addr': socket.inet_ntoa(struct.pack('!I', record[1])),
                'next_hop': socket.inet_ntoa(struct.pack('!I', record[2])),
                'input_snmp': record[3],
                'output_snmp': record[4],
                'packets': record[5],
                'bytes': record[6],
                'first': record[7],
                'last': record[8],
                'src_port': record[9],
                'dst_port': record[10],
                'tcp_flags': record[12],
                'protocol': record[13],
                'tos': record[14],
                'src_as': record[15],
                'dst_as': record[16],
                'src_mask': record[17],
                'dst_mask': record[18],
            }

            flows.append(flow)
            offset += NetFlowV5Parser.RECORD_SIZE

        logger.debug(f"Parsed {len(flows)} NetFlow v5 records from {source_ip}")
        return flows


class NetFlowV9Parser:
    """Parse NetFlow v9 / IPFIX packets"""

    @staticmethod
    def parse(data: bytes, source_ip: str) -> List[Dict]:
        """Parse NetFlow v9 packet - simplified version"""
        # NetFlow v9 is complex with templates - this is a basic implementation
        # For production, use a library like 'netflow' or 'ipfix'

        if len(data) < 20:
            return []

        # Parse header
        version, count = struct.unpack('!HH', data[:4])

        if version not in (9, 10):  # v9 or IPFIX
            return []

        logger.info(f"Received NetFlow v{version} packet from {source_ip} with {count} FlowSets")

        # For now, just log that we received it
        # Full implementation would require template management
        return []


def calculate_flow_metrics(flow: Dict) -> Dict:
    """
    Calculate bandwidth metrics for a flow

    Args:
        flow: Flow dictionary with 'first', 'last', 'bytes', and 'packets' fields

    Returns:
        Dictionary with calculated metrics (kbps, bps, pps, duration_ms)
    """
    first = flow.get('first', 0)
    last = flow.get('last', 0)
    bytes_count = flow.get('bytes', 0)
    packets = flow.get('packets', 0)

    # Duration in milliseconds
    duration_ms = last - first

    # Avoid division by zero
    if duration_ms <= 0:
        return {
            'duration_ms': 0,
            'bps': 0,
            'kbps': 0.0,
            'mbps': 0.0,
            'pps': 0.0
        }

    # Convert to seconds
    duration_sec = duration_ms / 1000.0

    # Calculate bits and rates
    bits = bytes_count * 8
    bps = bits / duration_sec
    kbps = bps / 1000.0
    mbps = kbps / 1000.0
    pps = packets / duration_sec

    return {
        'duration_ms': duration_ms,
        'bps': round(bps, 2),
        'kbps': round(kbps, 2),
        'mbps': round(mbps, 4),
        'pps': round(pps, 2)
    }


def enrich_flow(flow: Dict) -> Dict:
    """Add calculated metrics to a flow"""
    enriched = flow.copy()
    metrics = calculate_flow_metrics(flow)
    enriched.update(metrics)
    return enriched


def add_to_traffic_window(flow: Dict):
    """Add a flow to the traffic sliding window for aggregated rate calculation"""
    current_time = time.time()
    src = flow.get('src_addr', '')
    dst = flow.get('dst_addr', '')
    bytes_count = flow.get('bytes', 0)
    packets = flow.get('packets', 0)

    if src or dst:
        traffic_window['entries'].append((current_time, src, dst, bytes_count, packets))

    # Periodic cleanup of old entries (every 10 seconds)
    if current_time - traffic_window['last_cleanup'] > 10:
        cleanup_traffic_window()
        traffic_window['last_cleanup'] = current_time


def cleanup_traffic_window():
    """Remove entries older than TRAFFIC_WINDOW_SECONDS"""
    current_time = time.time()
    cutoff = current_time - TRAFFIC_WINDOW_SECONDS

    # Remove old entries from the front of the deque
    while traffic_window['entries'] and traffic_window['entries'][0][0] < cutoff:
        traffic_window['entries'].popleft()


def get_aggregated_traffic_stats() -> Dict[str, Dict]:
    """
    Calculate aggregated traffic stats per IP address over the sliding window.
    This mirrors what the Top Talkers pane shows in the UI.

    Returns:
        Dict mapping IP addresses to their aggregated stats including calculated rates
    """
    current_time = time.time()
    cutoff = current_time - TRAFFIC_WINDOW_SECONDS

    # Aggregate by IP address
    stats = defaultdict(lambda: {'bytes': 0, 'packets': 0, 'flows': 0})

    for entry in traffic_window['entries']:
        ts, src, dst, bytes_count, packets = entry
        if ts >= cutoff:
            if src:
                stats[src]['bytes'] += bytes_count
                stats[src]['packets'] += packets
                stats[src]['flows'] += 1
            if dst:
                stats[dst]['bytes'] += bytes_count
                stats[dst]['packets'] += packets
                stats[dst]['flows'] += 1

    # Calculate rates for each IP
    result = {}
    window_duration = min(TRAFFIC_WINDOW_SECONDS, current_time - (traffic_window['entries'][0][0] if traffic_window['entries'] else current_time))
    if window_duration <= 0:
        window_duration = 1  # Avoid division by zero

    for ip, data in stats.items():
        bits = data['bytes'] * 8
        bps = bits / window_duration
        result[ip] = {
            'bytes': data['bytes'],
            'packets': data['packets'],
            'flows': data['flows'],
            'bps': round(bps, 2),
            'kbps': round(bps / 1000.0, 2),
            'mbps': round(bps / 1000000.0, 4),
            'pps': round(data['packets'] / window_duration, 2)
        }

    return result


def evaluate_trigger(trigger: Dict, flow: Dict) -> bool:
    """
    Evaluate if a flow matches a trigger's conditions

    Args:
        trigger: Trigger configuration dict
        flow: Flow data dict with metrics

    Returns:
        True if trigger conditions are met
    """
    # Check if trigger is enabled
    if not trigger.get('enabled', True):
        return False

    conditions = trigger.get('conditions', {})

    # Source IP filter
    if 'src_addr' in conditions:
        if flow.get('src_addr') != conditions['src_addr']:
            return False

    # Destination IP filter
    if 'dst_addr' in conditions:
        if flow.get('dst_addr') != conditions['dst_addr']:
            return False

    # Source OR destination IP filter
    if 'src_or_dst_addr' in conditions:
        target_ip = conditions['src_or_dst_addr']
        if flow.get('src_addr') != target_ip and flow.get('dst_addr') != target_ip:
            return False

    # Protocol filter
    if 'protocol' in conditions:
        if flow.get('protocol') != conditions['protocol']:
            return False

    # Rate-based thresholds (require enriched flow)
    if 'min_kbps' in conditions:
        if flow.get('kbps', 0) < conditions['min_kbps']:
            return False

    if 'min_mbps' in conditions:
        if flow.get('mbps', 0) < conditions['min_mbps']:
            return False

    if 'min_pps' in conditions:
        if flow.get('pps', 0) < conditions['min_pps']:
            return False

    # Byte count threshold
    if 'min_bytes' in conditions:
        if flow.get('bytes', 0) < conditions['min_bytes']:
            return False

    # All conditions passed
    return True


def execute_trigger_action(trigger: Dict, flow: Dict):
    """
    Execute the action specified in a trigger

    Args:
        trigger: Trigger configuration
        flow: Flow that triggered the action
    """
    # Create a flow key to identify this specific flow
    # Note: Excluding src_port since it's ephemeral for client connections
    flow_key = (
        flow.get('src_addr', ''),
        flow.get('dst_addr', ''),
        flow.get('dst_port', 0),
        flow.get('protocol', 0)
    )
    notification_key = (trigger.get('id'), flow_key)

    # Check if we've recently triggered this trigger+flow combination
    current_time = time.time()
    last_trigger_time = recent_notifications.get(notification_key, 0)
    time_since_last = current_time - last_trigger_time

    # Get the trigger's cooldown period (default to 60 seconds)
    cooldown_seconds = trigger.get('cooldown_seconds', 60)

    # Skip if within cooldown period
    if time_since_last < cooldown_seconds:
        logger.debug(
            f"Skipping duplicate trigger '{trigger.get('name')}' for flow {flow_key} "
            f"(last triggered {time_since_last:.1f}s ago, cooldown: {cooldown_seconds}s)"
        )
        return

    # Update the last trigger time
    recent_notifications[notification_key] = current_time

    # Clean up old entries (older than 2x max cooldown period)
    cleanup_threshold = current_time - (120)  # 2 minutes
    keys_to_remove = [k for k, v in recent_notifications.items() if v < cleanup_threshold]
    for k in keys_to_remove:
        del recent_notifications[k]

    action = trigger.get('action', {})
    action_type = action.get('type', 'log')

    event = {
        'timestamp': datetime.utcnow().isoformat(),
        'trigger_id': trigger.get('id'),
        'trigger_name': trigger.get('name', 'Unnamed'),
        'flow': {
            'src_addr': flow.get('src_addr'),
            'dst_addr': flow.get('dst_addr'),
            'src_port': flow.get('src_port'),
            'dst_port': flow.get('dst_port'),
            'protocol': flow.get('protocol'),
            'bytes': flow.get('bytes'),
            'packets': flow.get('packets'),
            'kbps': flow.get('kbps'),
            'mbps': flow.get('mbps'),
        },
        'action_type': action_type,
        'action_result': None
    }

    try:
        if action_type == 'log':
            logger.warning(
                f"Trigger '{trigger.get('name')}' fired: "
                f"{flow.get('src_addr')}:{flow.get('src_port')} → "
                f"{flow.get('dst_addr')}:{flow.get('dst_port')} "
                f"({flow.get('kbps', 0):.2f} kbps)"
            )
            event['action_result'] = 'logged'

        elif action_type == 'flowspec':
            # Create BGP flowspec rule via unified BGP API
            rate_limit_kbps = action.get('rate_limit_kbps', 1000)  # Default to 1 Mbps
            rate_limit_mbps = rate_limit_kbps / 1000.0

            # Build FlowSpec match conditions
            # Note: Not including src_port since it's ephemeral for client connections
            match_conditions = {}
            if flow.get('dst_addr'):
                match_conditions['destination'] = f"{flow.get('dst_addr')}/32"
            if flow.get('src_addr'):
                match_conditions['source'] = f"{flow.get('src_addr')}/32"
            if flow.get('protocol'):
                match_conditions['protocol'] = flow.get('protocol')
            if flow.get('dst_port'):
                match_conditions['destination_port'] = flow.get('dst_port')

            # Build FlowSpec rule
            flowspec_payload = {
                'family': 'ipv4',
                'match': match_conditions,
                'actions': {
                    'action': 'rate-limit',
                    'rate': rate_limit_mbps
                }
            }

            # POST to GoBGP API
            # Use gobgp1:5000 when running in Docker container network
            import os
            bgp_api_url = os.getenv('BGP_API_URL', 'http://gobgp1:5000/flowspec')
            try:
                response = requests.post(
                    bgp_api_url,
                    json=flowspec_payload,
                    timeout=5
                )

                if response.status_code == 200:
                    logger.info(f"Created FlowSpec rule: {match_conditions} -> rate-limit {rate_limit_mbps} Mbps")
                    event['action_result'] = f'flowspec_created: {match_conditions} rate-limited to {rate_limit_mbps} Mbps'
                else:
                    logger.error(f"Failed to create FlowSpec rule: {response.status_code} {response.text}")
                    event['action_result'] = f'flowspec_error: {response.status_code} {response.text}'
            except requests.exceptions.RequestException as e:
                logger.error(f"Error calling BGP API for FlowSpec: {e}")
                event['action_result'] = f'flowspec_error: {str(e)}'

        elif action_type == 'alert':
            alert_msg = action.get('message', f"High bandwidth detected: {flow.get('kbps', 0):.2f} kbps")
            logger.error(f"ALERT: {alert_msg}")
            event['action_result'] = f'alert_sent: {alert_msg}'

        else:
            logger.warning(f"Unknown action type: {action_type}")
            event['action_result'] = f'unknown_action: {action_type}'

    except Exception as e:
        logger.error(f"Error executing trigger action: {e}")
        event['action_result'] = f'error: {str(e)}'

    # Store the event
    triggered_events.append(event)

    # Send real-time notification via WebSocket
    if active_websockets:
        # Create a notification message
        notification = {
            'type': 'trigger_event',
            'timestamp': event['timestamp'],
            'trigger_name': event['trigger_name'],
            'action_type': action_type,
            'flow': {
                'src': f"{flow.get('src_addr')}:{flow.get('src_port')}",
                'dst': f"{flow.get('dst_addr')}:{flow.get('dst_port')}",
                'kbps': flow.get('kbps', 0),
                'mbps': flow.get('mbps', 0),
            },
            'message': f"Trigger '{event['trigger_name']}' fired" + (
                f" - FlowSpec rule created" if action_type == 'flowspec' and 'flowspec_created' in event.get('action_result', '')
                else f" - Alert: {action.get('message', '')}" if action_type == 'alert'
                else ""
            ),
            'severity': 'warning' if action_type == 'flowspec' else 'info'
        }

        # Schedule the broadcast (non-blocking)
        try:
            loop = asyncio.get_event_loop()
            loop.create_task(broadcast_notification(notification))
            logger.info(f"Sent notification for trigger '{trigger.get('name')}' flow {flow_key}")
        except RuntimeError:
            # No event loop running, skip notification
            pass


def check_triggers_for_flow(flow: Dict):
    """
    Check all triggers against a flow and execute actions

    Args:
        flow: Enriched flow data
    """
    for trigger in triggers_storage:
        if evaluate_trigger(trigger, flow):
            execute_trigger_action(trigger, flow)


def check_triggers_for_aggregated_traffic():
    """
    Check triggers against aggregated traffic stats (same data as Top Talkers pane).
    This evaluates rate-based conditions like min_kbps and min_mbps using the
    actual aggregate bandwidth per IP address over the sliding time window.
    """
    # Get aggregated stats (same calculation as Top Talkers pane)
    aggregated = get_aggregated_traffic_stats()

    if not aggregated:
        return

    for trigger in triggers_storage:
        if not trigger.get('enabled', True):
            continue

        conditions = trigger.get('conditions', {})

        # Only process triggers with rate-based conditions for aggregated evaluation
        has_rate_condition = any(k in conditions for k in ['min_kbps', 'min_mbps', 'min_pps'])
        if not has_rate_condition:
            continue

        # Check each IP's aggregated traffic against the trigger
        for ip, stats in aggregated.items():
            # Check IP address filters
            if 'src_addr' in conditions:
                if ip != conditions['src_addr']:
                    continue
            if 'dst_addr' in conditions:
                if ip != conditions['dst_addr']:
                    continue
            if 'src_or_dst_addr' in conditions:
                if ip != conditions['src_or_dst_addr']:
                    continue

            # Check rate thresholds against aggregated rates
            if 'min_kbps' in conditions:
                if stats['kbps'] < conditions['min_kbps']:
                    continue

            if 'min_mbps' in conditions:
                if stats['mbps'] < conditions['min_mbps']:
                    continue

            if 'min_pps' in conditions:
                if stats['pps'] < conditions['min_pps']:
                    continue

            if 'min_bytes' in conditions:
                if stats['bytes'] < conditions['min_bytes']:
                    continue

            # Trigger matched - create a synthetic flow dict for the action
            synthetic_flow = {
                'src_addr': ip,
                'dst_addr': ip,  # Both src and dst since this is aggregated
                'bytes': stats['bytes'],
                'packets': stats['packets'],
                'kbps': stats['kbps'],
                'mbps': stats['mbps'],
                'bps': stats['bps'],
                'pps': stats['pps'],
                '_aggregated': True  # Mark as aggregated trigger
            }

            logger.info(
                f"Aggregated trigger '{trigger.get('name')}' matched for IP {ip}: "
                f"{stats['kbps']:.2f} kbps, {stats['mbps']:.4f} Mbps over {TRAFFIC_WINDOW_SECONDS}s window"
            )

            execute_trigger_action(trigger, synthetic_flow)


class NetFlowProtocol(asyncio.DatagramProtocol):
    """Asyncio protocol for receiving NetFlow packets"""

    def __init__(self, collector):
        self.collector = collector

    def datagram_received(self, data, addr):
        """Called when a UDP datagram is received"""
        source_ip = addr[0]
        logger.info(f"Received {len(data)} bytes from {source_ip}:{addr[1]}")

        try:
            # Try to parse as different NetFlow versions
            flows = []

            # Check version
            if len(data) >= 2:
                version = struct.unpack('!H', data[:2])[0]

                if version == 5:
                    flows = NetFlowV5Parser.parse(data, source_ip)
                elif version in (9, 10):
                    flows = NetFlowV9Parser.parse(data, source_ip)
                else:
                    logger.warning(f"Unknown NetFlow version {version} from {source_ip}")

            # Store flows
            for flow in flows:
                self.collector.store_flow(flow)

        except Exception as e:
            logger.error(f"Error processing NetFlow packet from {source_ip}: {e}")


class NetFlowCollector:
    """UDP server that collects NetFlow packets"""

    def __init__(self, host: str = '0.0.0.0', port: int = 2055):
        self.host = host
        self.port = port
        self.socket = None
        self.transport = None
        self.running = False

    async def start(self):
        """Start the NetFlow collector using asyncio protocol"""
        loop = asyncio.get_event_loop()

        logger.info(f"NetFlow collector listening on {self.host}:{self.port}")
        self.running = True

        # Create a UDP endpoint
        transport, protocol = await loop.create_datagram_endpoint(
            lambda: NetFlowProtocol(self),
            local_addr=(self.host, self.port)
        )

        self.transport = transport

        # Keep running
        try:
            while self.running:
                await asyncio.sleep(1)
        finally:
            transport.close()

    def store_flow(self, flow: Dict):
        """Store flow and update statistics"""
        # Enrich flow with bandwidth metrics
        enriched_flow = enrich_flow(flow)

        flows_storage.append(enriched_flow)

        # Add to traffic window for aggregated trigger evaluation
        add_to_traffic_window(enriched_flow)

        # Broadcast to WebSocket clients
        if flow_stream_websockets:
            try:
                loop = asyncio.get_event_loop()
                loop.create_task(broadcast_flow(enriched_flow))
            except RuntimeError:
                pass  # No event loop running

        # Check triggers for individual flows (only if we have valid metrics)
        if enriched_flow.get('kbps', 0) > 0:
            check_triggers_for_flow(enriched_flow)

        # Update stats
        flow_stats['total_flows'] += 1
        flow_stats['total_packets'] += enriched_flow.get('packets', 0)
        flow_stats['total_bytes'] += enriched_flow.get('bytes', 0)

        exporter = enriched_flow.get('exporter', 'unknown')
        if exporter not in flow_stats['exporters']:
            flow_stats['exporters'][exporter] = {'flows': 0, 'packets': 0, 'bytes': 0}

        flow_stats['exporters'][exporter]['flows'] += 1
        flow_stats['exporters'][exporter]['packets'] += enriched_flow.get('packets', 0)
        flow_stats['exporters'][exporter]['bytes'] += enriched_flow.get('bytes', 0)

        # Track protocol stats
        protocol = enriched_flow.get('protocol', 0)
        flow_stats['protocols'][protocol] += 1

        # Track top talkers
        src = flow.get('src_addr', 'unknown')
        dst = flow.get('dst_addr', 'unknown')

        flow_stats['top_talkers'][src]['bytes'] += flow.get('bytes', 0)
        flow_stats['top_talkers'][src]['packets'] += flow.get('packets', 0)
        flow_stats['top_talkers'][src]['flows'] += 1

        flow_stats['top_talkers'][dst]['bytes'] += flow.get('bytes', 0)
        flow_stats['top_talkers'][dst]['packets'] += flow.get('packets', 0)
        flow_stats['top_talkers'][dst]['flows'] += 1

    def stop(self):
        """Stop the collector"""
        self.running = False
        if self.socket:
            self.socket.close()


# Global collector instance
collector = NetFlowCollector()


# REST API Endpoints

@app.get("/")
def root():
    """API root"""
    return {
        "service": "NetFlow Collector",
        "version": "1.0",
        "endpoints": [
            "/flows",
            "/stats",
            "/top-talkers",
            "/conversations",
            "/protocols"
        ]
    }


@app.get("/stats")
def get_stats():
    """Get overall NetFlow statistics"""
    return {
        "total_flows": flow_stats['total_flows'],
        "total_packets": flow_stats['total_packets'],
        "total_bytes": flow_stats['total_bytes'],
        "flows_in_memory": len(flows_storage),
        "exporters": dict(flow_stats['exporters']),
        "protocols": dict(flow_stats['protocols'])
    }


@app.get("/flows")
def get_flows(limit: int = 100, src: Optional[str] = None, dst: Optional[str] = None, enrich: bool = True):
    """Get recent flows with optional filtering and bandwidth metrics"""
    flows = list(flows_storage)

    # Filter by source
    if src:
        flows = [f for f in flows if f.get('src_addr') == src]

    # Filter by destination
    if dst:
        flows = [f for f in flows if f.get('dst_addr') == dst]

    # Return most recent flows
    flows = flows[-limit:]

    # Enrich with calculated metrics (kbps, bps, pps, etc.)
    if enrich:
        flows = [enrich_flow(f) for f in flows]

    return {
        "count": len(flows),
        "flows": flows
    }


@app.get("/top-talkers")
def get_top_talkers(limit: int = 10, metric: str = 'bytes'):
    """Get top talkers by bytes, packets, or flows"""
    if metric not in ('bytes', 'packets', 'flows'):
        raise HTTPException(status_code=400, detail="metric must be 'bytes', 'packets', or 'flows'")

    # Sort talkers by specified metric
    talkers = sorted(
        flow_stats['top_talkers'].items(),
        key=lambda x: x[1][metric],
        reverse=True
    )[:limit]

    return {
        "metric": metric,
        "talkers": [
            {
                "address": addr,
                "bytes": stats['bytes'],
                "packets": stats['packets'],
                "flows": stats['flows']
            }
            for addr, stats in talkers
        ]
    }


@app.get("/conversations")
def get_conversations(limit: int = 10):
    """Get top conversations (src-dst pairs)"""
    conversations = defaultdict(lambda: {'bytes': 0, 'packets': 0, 'flows': 0})

    for flow in flows_storage:
        src = flow.get('src_addr', 'unknown')
        dst = flow.get('dst_addr', 'unknown')
        key = f"{src} -> {dst}"

        conversations[key]['bytes'] += flow.get('bytes', 0)
        conversations[key]['packets'] += flow.get('packets', 0)
        conversations[key]['flows'] += 1

    # Sort by bytes
    top_conversations = sorted(
        conversations.items(),
        key=lambda x: x[1]['bytes'],
        reverse=True
    )[:limit]

    return {
        "conversations": [
            {
                "pair": pair,
                "bytes": stats['bytes'],
                "packets": stats['packets'],
                "flows": stats['flows']
            }
            for pair, stats in top_conversations
        ]
    }


@app.get("/protocols")
def get_protocol_stats():
    """Get protocol distribution"""
    protocol_names = {
        1: 'ICMP',
        6: 'TCP',
        17: 'UDP',
        47: 'GRE',
        50: 'ESP',
        51: 'AH',
        89: 'OSPF',
        132: 'SCTP'
    }

    protocols = []
    for proto_num, count in flow_stats['protocols'].items():
        protocols.append({
            'protocol': proto_num,
            'name': protocol_names.get(proto_num, f'Protocol-{proto_num}'),
            'flows': count
        })

    # Sort by flow count
    protocols.sort(key=lambda x: x['flows'], reverse=True)

    return {"protocols": protocols}


@app.get("/triggers")
def get_triggers():
    """Get all configured triggers"""
    return {
        "count": len(triggers_storage),
        "triggers": triggers_storage
    }


@app.post("/triggers/sync")
def sync_triggers():
    """Manually sync triggers from the topology database"""
    sync_triggers_from_topology()
    return {
        "message": "Triggers synced from topology database",
        "count": len(triggers_storage),
        "triggers": triggers_storage
    }


@app.post("/triggers")
def create_trigger(trigger: Dict):
    """
    Create a new trigger

    Example trigger with rate-based condition:
    {
        "name": "High bandwidth alert",
        "enabled": true,
        "conditions": {
            "min_kbps": 1000,
            "protocol": 6
        },
        "action": {
            "type": "alert",
            "message": "High TCP bandwidth detected"
        }
    }

    Example trigger with IP-based condition:
    {
        "name": "Monitor specific host",
        "enabled": true,
        "conditions": {
            "src_or_dst_addr": "10.0.1.2",
            "min_kbps": 100
        },
        "action": {
            "type": "flowspec",
            "rate_limit_kbps": 500
        }
    }
    """
    # Generate a unique ID
    import uuid
    trigger['id'] = str(uuid.uuid4())

    # Set defaults
    if 'enabled' not in trigger:
        trigger['enabled'] = True

    if 'conditions' not in trigger:
        raise HTTPException(status_code=400, detail="Trigger must have 'conditions'")

    if 'action' not in trigger:
        trigger['action'] = {'type': 'log'}

    triggers_storage.append(trigger)

    logger.info(f"Created trigger: {trigger.get('name', trigger['id'])}")

    return {
        "message": "Trigger created successfully",
        "trigger": trigger
    }


@app.delete("/triggers/{trigger_id}")
def delete_trigger(trigger_id: str):
    """Delete a trigger by ID"""
    global triggers_storage

    for i, trigger in enumerate(triggers_storage):
        if trigger.get('id') == trigger_id:
            deleted = triggers_storage.pop(i)
            logger.info(f"Deleted trigger: {deleted.get('name', trigger_id)}")
            return {
                "message": "Trigger deleted successfully",
                "trigger": deleted
            }

    raise HTTPException(status_code=404, detail=f"Trigger with ID '{trigger_id}' not found")


@app.patch("/triggers/{trigger_id}")
def update_trigger(trigger_id: str, updates: Dict):
    """Update a trigger (enable/disable, modify conditions, etc.)"""
    for trigger in triggers_storage:
        if trigger.get('id') == trigger_id:
            trigger.update(updates)
            logger.info(f"Updated trigger: {trigger.get('name', trigger_id)}")
            return {
                "message": "Trigger updated successfully",
                "trigger": trigger
            }

    raise HTTPException(status_code=404, detail=f"Trigger with ID '{trigger_id}' not found")


@app.get("/triggered-events")
def get_triggered_events(limit: int = 100):
    """Get recent triggered events"""
    events = list(triggered_events)
    events.reverse()  # Most recent first

    return {
        "count": len(events),
        "events": events[-limit:]
    }


@app.get("/traffic-window")
def get_traffic_window(limit: int = 20, metric: str = 'kbps'):
    """
    Get current aggregated traffic stats from the sliding window.
    This shows the same data used for trigger evaluation and mirrors the Top Talkers pane.
    """
    if metric not in ('bytes', 'packets', 'flows', 'kbps', 'mbps', 'pps', 'bps'):
        raise HTTPException(status_code=400, detail="metric must be one of: bytes, packets, flows, kbps, mbps, pps, bps")

    aggregated = get_aggregated_traffic_stats()

    # Sort by specified metric
    sorted_entries = sorted(
        aggregated.items(),
        key=lambda x: x[1].get(metric, 0),
        reverse=True
    )[:limit]

    return {
        "window_seconds": TRAFFIC_WINDOW_SECONDS,
        "metric": metric,
        "entries_in_window": len(traffic_window['entries']),
        "talkers": [
            {
                "address": ip,
                **stats
            }
            for ip, stats in sorted_entries
        ]
    }


@app.websocket("/ws/notifications")
async def websocket_notifications(websocket: WebSocket):
    """WebSocket endpoint for real-time trigger notifications"""
    await websocket.accept()
    active_websockets.append(websocket)
    logger.info(f"WebSocket client connected. Total clients: {len(active_websockets)}")

    try:
        # Send a welcome message
        await websocket.send_json({
            'type': 'connected',
            'message': 'Connected to NetFlow notifications',
            'timestamp': datetime.utcnow().isoformat()
        })

        # Keep the connection alive and handle incoming messages
        while True:
            try:
                # Wait for client messages (ping/pong)
                data = await websocket.receive_text()
                # Echo back for keepalive
                await websocket.send_json({'type': 'pong', 'timestamp': datetime.utcnow().isoformat()})
            except WebSocketDisconnect:
                break
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        # Remove client on disconnect
        if websocket in active_websockets:
            active_websockets.remove(websocket)
        logger.info(f"WebSocket client disconnected. Total clients: {len(active_websockets)}")


@app.websocket("/ws/flows")
async def websocket_flows(websocket: WebSocket):
    """WebSocket endpoint for real-time raw flow data streaming"""
    await websocket.accept()
    flow_stream_websockets.append(websocket)
    logger.info(f"Flow stream client connected. Total clients: {len(flow_stream_websockets)}")

    try:
        # Send a welcome message
        await websocket.send_json({
            'type': 'connected',
            'message': 'Connected to NetFlow stream',
            'timestamp': datetime.utcnow().isoformat()
        })

        # Keep the connection alive and handle incoming messages
        while True:
            try:
                # Wait for client messages (ping/pong)
                data = await websocket.receive_text()
                # Echo back for keepalive
                await websocket.send_json({'type': 'pong', 'timestamp': datetime.utcnow().isoformat()})
            except WebSocketDisconnect:
                break
    except Exception as e:
        logger.error(f"Flow stream WebSocket error: {e}")
    finally:
        # Remove client on disconnect
        if websocket in flow_stream_websockets:
            flow_stream_websockets.remove(websocket)
        logger.info(f"Flow stream client disconnected. Total clients: {len(flow_stream_websockets)}")


async def periodic_trigger_sync():
    """Periodically sync triggers from topology database"""
    while True:
        try:
            sync_triggers_from_topology()
        except Exception as e:
            logger.error(f"Error in periodic trigger sync: {e}")
        await asyncio.sleep(30)  # Sync every 30 seconds


async def periodic_aggregated_trigger_check():
    """
    Periodically evaluate triggers against aggregated traffic (like Top Talkers pane).
    This runs every 5 seconds to check if any IP's total traffic over the sliding
    window exceeds trigger thresholds.
    """
    while True:
        try:
            if triggers_storage and traffic_window['entries']:
                check_triggers_for_aggregated_traffic()
        except Exception as e:
            logger.error(f"Error in periodic aggregated trigger check: {e}")
        await asyncio.sleep(5)  # Check every 5 seconds


@app.on_event("startup")
async def startup_event():
    """Start NetFlow collector on app startup"""
    asyncio.create_task(collector.start())
    logger.info("NetFlow collector started")

    # Initial trigger sync
    sync_triggers_from_topology()

    # Start periodic trigger sync
    asyncio.create_task(periodic_trigger_sync())
    logger.info("Trigger sync started")

    # Start periodic aggregated trigger check
    asyncio.create_task(periodic_aggregated_trigger_check())
    logger.info("Aggregated trigger evaluation started (checking every 5s)")


@app.on_event("shutdown")
def shutdown_event():
    """Stop NetFlow collector on app shutdown"""
    collector.stop()
    logger.info("NetFlow collector stopped")


if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=5003,
        log_level="info"
    )
