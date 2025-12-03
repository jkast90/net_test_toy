import asyncio
from contextlib import asynccontextmanager
import logging
import os
import subprocess
import sys

# Fix PyGoBGP import path issue
pygobgp_api_path = '/usr/local/lib/python3.13/site-packages/pygobgp/api'
if os.path.exists(pygobgp_api_path) and pygobgp_api_path not in sys.path:
    sys.path.insert(0, pygobgp_api_path)

from fastapi import FastAPI, Body
from fastapi.middleware.cors import CORSMiddleware
from starlette.websockets import WebSocket, WebSocketDisconnect

from connection_manager import manager
from gobgp_manager import GoBGPManager
from models import RouteAttributes, NeighborAttributes, PolicyDefinition, PrefixListDefinition, FlowSpecRule, BmpServerConfig, EventWebhook
from route_monitor import (
    RouteMonitor, RoutePolicy, RouteCriteria, RouteAction,
    MatchType, ActionType
)
from event_handler import event_webhook_manager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("uvicorn.error")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up GoBGP API...")
    await launch_gobgp()
    await start_periodic_broadcast()
    # Start route monitor
    monitor_interval = int(os.getenv("ROUTE_MONITOR_INTERVAL", "5"))
    asyncio.create_task(route_monitor.monitor_routes(interval=monitor_interval))
    yield
    logger.info("Shutting down GoBGP API...")
    route_monitor.stop()


app = FastAPI(lifespan=lifespan)

origins = [
    "*",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BGP_ASN = int(os.getenv("LOCAL_ASN", "65003"))
BGP_ROUTER_ID = os.getenv("LOCAL_ROUTER_ID", "192.168.70.13")
GOBGP_HOST = os.getenv("GOBGP_HOST", "localhost")
GOBGP_PORT = int(os.getenv("GOBGP_PORT", "50051"))

gobgp = GoBGPManager(asn=BGP_ASN, router_id=BGP_ROUTER_ID, host=GOBGP_HOST, port=GOBGP_PORT)
route_monitor = RouteMonitor(gobgp)


async def launch_gobgp() -> None:
    """Launch gobgpd daemon in the background"""
    cfg = os.environ.get("GOBGP_CONFIG", "/etc/gobgp/gobgpd.conf")
    log_level = os.environ.get("GOBGP_LOG_LEVEL", "info")

    # Check if gobgpd is already running
    try:
        subprocess.check_output(["pidof", "gobgpd"])
        logger.info("gobgpd is already running")
        return
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass  # Not running or pidof not available, start it

    # Start gobgpd in background
    logger.info(f"Starting gobgpd with config: {cfg}")
    asyncio.create_task(asyncio.to_thread(
        subprocess.run,
        ["gobgpd", "-f", cfg, "-l", log_level]
    ))

    # Give it a moment to start
    await asyncio.sleep(2)


@app.get("/status")
def status():
    """Get GoBGP daemon status via gRPC"""
    try:
        return gobgp.get_global_status()
    except Exception as e:
        logger.error(f"Failed to get GoBGP status: {e}")
        return {"status": "error", "detail": str(e)}


# Route Management Endpoints

@app.post("/route/{prefix}/{cidr}")
def advertise_route(prefix: str, cidr: str, attrs: RouteAttributes = Body(...)):
    gobgp.advertise_route(
        prefix=prefix,
        cidr=cidr,
        next_hop=attrs.next_hop,
        community=attrs.community,
        ext_community=attrs.extended_community,
        as_path=attrs.as_path,
        med=attrs.med,
    )
    return {
        "message": f"Advertised route {prefix}/{cidr}",
        "applied_attributes": attrs.dict(exclude_none=True),
    }


@app.delete("/route/{prefix}/{cidr}")
def withdraw_route(prefix: str, cidr: str):
    gobgp.withdraw_route(prefix, cidr)
    return {"message": f"Withdrawn route {prefix}/{cidr}"}


@app.get("/route/{prefix}/{cidr}")
def get_route_status(prefix: str, cidr: str):
    output = gobgp.get_route_status(prefix, cidr)
    return {"result": output}


# Neighbor Management Endpoints

@app.get("/neighbor")
def get_all_neighbors():
    return {"neighbors": gobgp.get_all_neighbors_full_state()}


@app.get("/neighbor/{ip}")
def get_neighbor_routes(ip: str):
    return gobgp.get_neighbor_routes(ip)


@app.post("/neighbor/{ip}")
def configure_neighbor(ip: str, attrs: NeighborAttributes):
    gobgp.configure_neighbor(
        ip=ip,
        remote_as=attrs.remote_asn,
        local_as=attrs.local_asn,
        out_policy=attrs.out_policy,
        in_policy=attrs.in_policy,
        description=attrs.description or "",
        local_address=attrs.local_address,
        ebgp_multihop=attrs.ebgp_multihop,
        ebgp_multihop_ttl=attrs.ebgp_multihop_ttl,
        auth_password=attrs.auth_password,
    )
    return {"message": f"Neighbor {ip} configured."}


@app.post("/neighbor/status/{ip}")
def bring_up(ip: str, remote_asn: int = Body(..., embed=True)):
    gobgp.bring_up_neighbor(ip, remote_asn)
    return {"message": f"Neighbor {ip} brought up"}


@app.delete("/neighbor/status/{ip}")
def bring_down(ip: str):
    gobgp.shut_down_neighbor(ip)
    return {"message": f"Neighbor {ip} shut down"}


# Policy Management Endpoints

@app.get("/policy")
def list_policies():
    return {"policies": gobgp.list_route_maps()}


@app.post("/policy/{name}")
def update_policy(name: str, policy: PolicyDefinition):
    gobgp.create_or_update_policy(name, policy)
    return {"message": f"Policy {name} updated", "terms": policy.terms}


@app.delete("/policy/{name}")
def delete_policy(name: str):
    gobgp.delete_policy(name)
    return {"message": f"Policy {name} deleted"}


# Prefix-List Management Endpoints

@app.get("/prefix_list")
def list_prefix_lists():
    return {"prefix_lists": gobgp.list_prefix_lists()}


@app.post("/prefix_list/{name}")
def update_prefix_list(name: str, pl: PrefixListDefinition):
    gobgp.create_or_update_prefix_list(name, pl)
    return {"message": f"Prefix-list {name} updated", "prefixes": pl.prefixes}


@app.delete("/prefix_list/{name}")
def delete_prefix_list(name: str):
    gobgp.delete_prefix_list(name)
    return {"message": f"Prefix-list {name} deleted"}


# Configuration Management

@app.post("/save")
def save_gobgp_config():
    output = gobgp.save_config()
    return {"message": "GoBGP configuration status", "output": output}


# WebSocket for real-time updates

@app.websocket("/ws/routes")
async def route_ws_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            neighbors = gobgp.get_all_neighbors_full_state()
            await manager.broadcast({"neighbors": neighbors})
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        manager.disconnect(websocket)


async def start_periodic_broadcast():
    async def broadcast_loop():
        logger.info("Starting periodic BGP neighbor broadcast loop")

        while True:
            try:
                neighbor_states = gobgp.get_all_neighbors_full_state()
                await manager.broadcast({"neighbors": neighbor_states})
                await asyncio.sleep(2)
            except Exception as e:
                logger.exception("Periodic broadcast failed")

    asyncio.create_task(broadcast_loop())


# Route Monitoring & Policy Endpoints

@app.get("/monitor/routes")
def get_monitored_routes():
    """Get all routes currently being monitored"""
    return {"routes": list(route_monitor.route_cache.values())}


@app.get("/monitor/policies")
def list_monitor_policies():
    """List all route monitoring policies"""
    return {"policies": route_monitor.get_policies()}


@app.post("/monitor/policy")
async def create_monitor_policy(
    name: str = Body(...),
    match_type: str = Body(...),  # prefix, as_path, community, next_hop
    pattern: str = Body(...),
    action_type: str = Body(...),  # accept, reject, set_community, prepend_as, webhook, log
    action_params: dict = Body(default={}),
    description: str = Body(default="")
):
    """
    Create a route monitoring policy

    Example - Block routes from specific AS:
    {
        "name": "block-as64512",
        "match_type": "as_path",
        "pattern": "64512",
        "action_type": "reject",
        "action_params": {},
        "description": "Block all routes containing AS 64512"
    }

    Example - Tag routes with community:
    {
        "name": "tag-customer-routes",
        "match_type": "prefix",
        "pattern": "10\\.0\\..*",
        "action_type": "set_community",
        "action_params": {"community": "65000:100"},
        "description": "Tag customer prefixes"
    }

    Example - Webhook on route match:
    {
        "name": "alert-on-hijack",
        "match_type": "prefix",
        "pattern": "8\\.8\\.8\\.0/24",
        "action_type": "webhook",
        "action_params": {"url": "http://alerts.example.com/bgp-alert"},
        "description": "Alert on suspicious prefix"
    }
    """
    try:
        # Create criteria
        criteria = RouteCriteria(
            name=f"{name}_criteria",
            match_type=MatchType(match_type),
            pattern=pattern,
            description=description
        )

        # Create action
        action = RouteAction(
            action_type=ActionType(action_type),
            parameters=action_params
        )

        # Create policy
        policy = RoutePolicy(
            name=name,
            criteria=[criteria],
            actions=[action],
            match_all=True,
            enabled=True
        )

        route_monitor.add_policy(policy)

        return {
            "message": f"Policy '{name}' created successfully",
            "policy": {
                "name": name,
                "match_type": match_type,
                "pattern": pattern,
                "action_type": action_type,
                "action_params": action_params
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid parameter: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create policy: {str(e)}")


@app.delete("/monitor/policy/{name}")
def delete_monitor_policy(name: str):
    """Delete a route monitoring policy"""
    route_monitor.remove_policy(name)
    return {"message": f"Policy '{name}' deleted"}


@app.post("/monitor/check")
async def check_route_against_policies(
    prefix: str = Body(...),
    as_path: list = Body(default=[]),
    community: list = Body(default=[]),
    next_hop: str = Body(default="")
):
    """
    Manually check a route against all policies (for testing)

    Example:
    {
        "prefix": "10.0.1.0/24",
        "as_path": [65001, 65002],
        "community": ["65000:100"],
        "next_hop": "192.168.1.1"
    }
    """
    route = {
        "prefix": prefix,
        "as_path": as_path,
        "community": community,
        "next_hop": next_hop
    }

    results = await route_monitor.check_route(route)

    return {
        "route": route,
        "matched_policies": len(results),
        "results": results
    }


# FlowSpec Endpoints for Traffic Filtering, Policing, and Redirection

@app.get("/flowspec")
def list_flowspec_rules(family: str = "ipv4"):
    """
    List all FlowSpec rules

    Args:
        family: Address family (ipv4 or ipv6, default: ipv4)

    Returns:
        List of FlowSpec rules with match conditions and actions
    """
    rules = gobgp.get_flowspec_rules(family=family)
    return {"family": family, "rules": rules}


@app.post("/flowspec")
def add_flowspec_rule(rule: FlowSpecRule):
    """
    Add a FlowSpec rule for traffic filtering, policing, or redirection

    Examples:

    1. Block (discard) TCP traffic to 192.0.2.0/24 port 80:
    {
        "family": "ipv4",
        "match": {
            "destination": "192.0.2.0/24",
            "protocol": 6,
            "destination_port": 80
        },
        "actions": {
            "action": "discard"
        }
    }

    2. Rate-limit (police) UDP traffic to 10 Mbps:
    {
        "family": "ipv4",
        "match": {
            "destination": "10.0.0.0/8",
            "protocol": 17
        },
        "actions": {
            "action": "rate-limit",
            "rate": 10.0
        }
    }

    3. Redirect traffic via Route Target:
    {
        "family": "ipv4",
        "match": {
            "destination": "203.0.113.0/24",
            "protocol": 6,
            "destination_port": 443
        },
        "actions": {
            "action": "redirect",
            "redirect_rt": "65000:100"
        }
    }

    4. Block ICMP ping to specific host:
    {
        "family": "ipv4",
        "match": {
            "destination": "192.0.2.50/32",
            "protocol": 1,
            "icmp_type": 8,
            "icmp_code": 0
        },
        "actions": {
            "action": "discard"
        }
    }
    """
    gobgp.add_flowspec_rule(
        family=rule.family,
        match=rule.match.dict(exclude_none=True),
        actions=rule.actions.dict(exclude_none=True)
    )

    return {
        "message": "FlowSpec rule added successfully",
        "rule": {
            "family": rule.family,
            "match": rule.match.dict(exclude_none=True),
            "actions": rule.actions.dict(exclude_none=True)
        }
    }


@app.delete("/flowspec")
def delete_flowspec_rule(rule: FlowSpecRule):
    """
    Delete a FlowSpec rule

    Provide the same match conditions that were used to create the rule.

    Example:
    {
        "family": "ipv4",
        "match": {
            "destination": "192.0.2.0/24",
            "protocol": 6,
            "destination_port": 80
        },
        "actions": {
            "action": "discard"
        }
    }
    """
    gobgp.delete_flowspec_rule(
        family=rule.family,
        match=rule.match.dict(exclude_none=True)
    )

    return {
        "message": "FlowSpec rule deleted successfully",
        "match": rule.match.dict(exclude_none=True)
    }


# ========================================
# BMP (BGP Monitoring Protocol) Endpoints
# ========================================

@app.get("/bmp")
def list_bmp_servers():
    """List all configured BMP servers"""
    servers = gobgp.list_bmp_servers()
    return {"servers": servers}


@app.post("/bmp")
def add_bmp_server(config: BmpServerConfig):
    """
    Add a BMP server for event-driven route monitoring.

    BMP (BGP Monitoring Protocol) provides real-time BGP visibility.

    Example:
    {
      "address": "127.0.0.1",
      "port": 11019,
      "route_monitoring_policy": "pre-policy",
      "statistics_timeout": 3600,
      "route_mirroring_enabled": false
    }
    """
    gobgp.add_bmp_server(
        address=config.address,
        port=config.port,
        route_monitoring_policy=config.route_monitoring_policy,
        statistics_timeout=config.statistics_timeout,
        route_mirroring_enabled=config.route_mirroring_enabled
    )

    return {
        "message": "BMP server added successfully",
        "server": {
            "address": config.address,
            "port": config.port,
            "route_monitoring_policy": config.route_monitoring_policy
        }
    }


@app.delete("/bmp/{address}")
def delete_bmp_server(address: str, port: int = 11019):
    """Delete a BMP server"""
    gobgp.delete_bmp_server(address=address, port=port)

    return {
        "message": "BMP server deleted successfully",
        "address": address,
        "port": port
    }


# ========================================
# Event Webhook Endpoints (Event-Driven Routing)
# ========================================

@app.get("/events/webhooks")
def list_event_webhooks():
    """List all configured event webhooks"""
    webhooks = event_webhook_manager.list_webhooks()
    return {"webhooks": webhooks}


@app.post("/events/webhooks")
def add_event_webhook(webhook: EventWebhook):
    """
    Add a webhook for BGP event notifications.

    Webhooks enable event-driven routing decisions by POSTing BGP events to your endpoint.

    Example:
    {
      "url": "http://localhost:9000/bgp-events",
      "events": ["peer", "table"],
      "peer_filter": "192.168.70.12",
      "enabled": true
    }

    Event types:
    - 'peer': Peer up/down events
    - 'table': Route additions/withdrawals
    """
    event_webhook_manager.add_webhook(
        url=webhook.url,
        events=webhook.events,
        peer_filter=webhook.peer_filter,
        enabled=webhook.enabled
    )

    return {
        "message": "Event webhook added successfully",
        "webhook": {
            "url": webhook.url,
            "events": webhook.events
        }
    }


@app.delete("/events/webhooks")
def delete_event_webhook(url: str):
    """Delete an event webhook by URL"""
    event_webhook_manager.remove_webhook(url=url)

    return {
        "message": "Event webhook deleted successfully",
        "url": url
    }


@app.post("/events/start")
def start_event_watcher(peer_address: str = None):
    """
    Start the event watcher for real-time BGP event monitoring.

    This starts a background thread that watches BGP events and triggers webhooks.

    Args:
        peer_address: Optional - filter events for specific peer
    """
    event_webhook_manager.start(gobgp_manager=gobgp, peer_address=peer_address)

    return {
        "message": "Event watcher started successfully",
        "peer_filter": peer_address,
        "webhooks": len(event_webhook_manager.webhooks)
    }


@app.post("/events/stop")
def stop_event_watcher():
    """Stop the event watcher"""
    event_webhook_manager.stop()

    return {
        "message": "Event watcher stopped successfully"
    }
