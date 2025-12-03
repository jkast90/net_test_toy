"""
Unified BGP API

A single REST API that can manage both FRR and GoBGP BGP implementations.
Supports runtime backend selection and failover between implementations.
"""

import asyncio
from contextlib import asynccontextmanager
import logging
import os
import subprocess
import sys
from typing import Optional, Literal

from fastapi import FastAPI, Body, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from starlette.websockets import WebSocket, WebSocketDisconnect

from .common import (
    RouteAttributes,
    NeighborAttributes,
    PolicyDefinition,
    PrefixListDefinition,
    FlowSpecRule,
    BmpServerConfig,
    NetFlowConfig,
    EventWebhook,
)
from .common.websocket_manager import ws_manager
from .gobgp import GoBGPManager
from .gobgp.streaming_monitor import get_streaming_monitor
from .frr import FRRManager
from .exabgp import ExaBGPManager
import httpx

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("unified-bgp-api")


# ============================================================================
# Backend Manager - Handles FRR and GoBGP
# ============================================================================

class BGPBackendManager:
    """
    Manages multiple BGP backend implementations (FRR, GoBGP).
    Provides unified interface with backend selection and failover.
    """

    def __init__(self):
        self.backends = {}
        self.default_backend = os.getenv("DEFAULT_BGP_BACKEND", "gobgp")
        self.container_api_url = os.getenv("CONTAINER_API_URL", "http://host.docker.internal:5010")
        self._initialize_backends()

    def _initialize_backends(self):
        """Initialize available BGP backends"""
        # Try to load GoBGP (if not explicitly disabled)
        if os.getenv("ENABLE_GOBGP", "true").lower() not in ["false", "0", "no"]:
            try:
                gobgp_asn = int(os.getenv("GOBGP_ASN", "65003"))
                gobgp_router_id = os.getenv("GOBGP_ROUTER_ID", "192.168.70.14")
                gobgp_host = os.getenv("GOBGP_HOST", "localhost")
                gobgp_port = int(os.getenv("GOBGP_PORT", "50051"))

                self.backends["gobgp"] = {
                    "manager": GoBGPManager(
                        asn=gobgp_asn,
                        router_id=gobgp_router_id,
                        host=gobgp_host,
                        port=gobgp_port
                    ),
                    "name": "GoBGP",
                    "available": True
                }
                logger.info(f"[Backend] GoBGP initialized (AS{gobgp_asn}, {gobgp_router_id})")
            except Exception as e:
                logger.warning(f"[Backend] GoBGP not available: {e}")
                self.backends["gobgp"] = {"available": False, "error": str(e)}
        else:
            logger.info("[Backend] GoBGP disabled via ENABLE_GOBGP=false")

        # Try to load FRR (if not explicitly disabled)
        if os.getenv("ENABLE_FRR", "true").lower() not in ["false", "0", "no"]:
            try:
                frr_asn = int(os.getenv("FRR_ASN", "65001"))
                frr_router_id = os.getenv("FRR_ROUTER_ID", "192.168.70.10")

                self.backends["frr"] = {
                    "manager": FRRManager(
                        asn=frr_asn,
                        router_id=frr_router_id
                    ),
                    "name": "FRR",
                    "available": True
                }
                logger.info(f"[Backend] FRR initialized (AS{frr_asn}, {frr_router_id})")
            except Exception as e:
                logger.warning(f"[Backend] FRR not available: {e}")
                self.backends["frr"] = {"available": False, "error": str(e)}
        else:
            logger.info("[Backend] FRR disabled via ENABLE_FRR=false")

        # Try to load ExaBGP (if not explicitly disabled)
        if os.getenv("ENABLE_EXABGP", "true").lower() not in ["false", "0", "no"]:
            try:
                exabgp_asn = int(os.getenv("EXABGP_ASN", "65002"))
                exabgp_router_id = os.getenv("EXABGP_ROUTER_ID", "192.168.70.12")
                exabgp_config = os.getenv("EXABGP_CONF", "/etc/exabgp/exabgp.conf")
                exabgp_pid_file = os.getenv("EXABGP_PID_FILE", "/var/run/exabgp.pid")

                self.backends["exabgp"] = {
                    "manager": ExaBGPManager(
                        asn=exabgp_asn,
                        router_id=exabgp_router_id,
                        config_path=exabgp_config,
                        pid_file=exabgp_pid_file
                    ),
                    "name": "ExaBGP",
                    "available": True
                }
                logger.info(f"[Backend] ExaBGP initialized (AS{exabgp_asn}, {exabgp_router_id})")
            except Exception as e:
                logger.warning(f"[Backend] ExaBGP not available: {e}")
                self.backends["exabgp"] = {"available": False, "error": str(e)}
        else:
            logger.info("[Backend] ExaBGP disabled via ENABLE_EXABGP=false")

    def get_backend(self, backend_name: Optional[str] = None):
        """Get backend manager instance"""
        name = backend_name or self.default_backend

        if name not in self.backends:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown backend: {name}. Available: {list(self.backends.keys())}"
            )

        backend = self.backends[name]
        if not backend.get("available"):
            raise HTTPException(
                status_code=503,
                detail=f"Backend {name} not available: {backend.get('error', 'Unknown error')}"
            )

        return backend["manager"]

    def get_status(self):
        """Get status of all backends"""
        status = {
            "default_backend": self.default_backend,
            "backends": {}
        }

        for name, backend in self.backends.items():
            backend_status = {
                "available": backend.get("available", False),
                "name": backend.get("name", name),
                "error": backend.get("error") if not backend.get("available") else None
            }

            # Add router_id and ASN for available backends
            if backend.get("available") and "manager" in backend:
                manager = backend["manager"]
                if hasattr(manager, 'router_id'):
                    backend_status["router_id"] = manager.router_id
                if hasattr(manager, 'asn'):
                    backend_status["asn"] = manager.asn

            status["backends"][name] = backend_status

        return status

    def save_bgp_peer(self, daemon_name: str, peer_ip: str, peer_asn: int):
        """Save BGP peer to container manager database via HTTP"""
        try:
            with httpx.Client(timeout=5.0) as client:
                response = client.post(
                    f"{self.container_api_url}/bgp/peers",
                    json={
                        "local_daemon": daemon_name,
                        "peer_ip": peer_ip,
                        "peer_asn": peer_asn
                    }
                )
                if response.status_code not in [200, 201]:
                    logger.warning(f"Failed to save BGP peer to database: {response.text}")
        except Exception as e:
            logger.error(f"Error saving BGP peer: {e}")

    def get_daemon_peers(self, daemon_name: str):
        """Get BGP peers for daemon from container manager database"""
        try:
            with httpx.Client(timeout=5.0) as client:
                response = client.get(f"{self.container_api_url}/bgp/peers/{daemon_name}")
                if response.status_code == 200:
                    return response.json().get("peers", [])
        except Exception as e:
            logger.error(f"Error getting BGP peers: {e}")
        return []

    def save_bgp_route(self, daemon_name: str, prefix: str, next_hop: str = None,
                       origin: str = "incomplete", local_pref: int = None,
                       med: int = None, communities: str = None):
        """Save BGP route to container manager database via HTTP"""
        try:
            with httpx.Client(timeout=5.0) as client:
                response = client.post(
                    f"{self.container_api_url}/bgp/routes",
                    json={
                        "local_daemon": daemon_name,
                        "prefix": prefix,
                        "next_hop": next_hop,
                        "origin": origin,
                        "local_pref": local_pref,
                        "med": med,
                        "communities": communities
                    }
                )
                if response.status_code not in [200, 201]:
                    logger.warning(f"Failed to save BGP route to database: {response.text}")
        except Exception as e:
            logger.error(f"Error saving BGP route: {e}")

    def get_daemon_routes(self, daemon_name: str):
        """Get BGP routes for daemon from container manager database"""
        try:
            with httpx.Client(timeout=5.0) as client:
                response = client.get(f"{self.container_api_url}/bgp/routes/{daemon_name}")
                if response.status_code == 200:
                    return response.json().get("routes", [])
        except Exception as e:
            logger.error(f"Error getting BGP routes: {e}")
        return []


# ============================================================================
# FastAPI Application
# ============================================================================

backend_manager = BGPBackendManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Unified BGP API...")

    # Start GoBGP streaming monitor if enabled
    enable_streaming = os.getenv("ENABLE_GOBGP_STREAMING", "true").lower() == "true"
    if enable_streaming:
        try:
            monitor = get_streaming_monitor()
            await monitor.start()
            logger.info("GoBGP streaming monitor started")
        except Exception as e:
            logger.error(f"Failed to start GoBGP streaming monitor: {e}")

    yield

    # Stop streaming monitor
    if enable_streaming:
        try:
            monitor = get_streaming_monitor()
            await monitor.stop()
            logger.info("GoBGP streaming monitor stopped")
        except Exception as e:
            logger.error(f"Error stopping streaming monitor: {e}")

    logger.info("Shutting down Unified BGP API...")


app = FastAPI(
    title="Unified BGP API",
    description="Single API to manage both FRR and GoBGP BGP implementations",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# API Endpoints
# ============================================================================

@app.get("/")
def root():
    """API information and available backends"""
    return {
        "name": "Unified BGP API",
        "version": "1.0.0",
        "description": "Manage FRR and GoBGP from a single API",
        "backends": backend_manager.get_status()["backends"],
        "default_backend": backend_manager.default_backend,
        "endpoints": {
            "status": "GET /status",
            "backends": "GET /backends",
            "routes": "GET/POST/DELETE /route/{prefix}/{cidr}",
            "neighbors": "GET/POST /neighbor",
            "policies": "GET/POST/DELETE /policy/{name}",
            "flowspec": "GET/POST/DELETE /flowspec",
            "bmp": "GET/POST/DELETE /bmp",
            "netflow": "GET/POST/DELETE /netflow",
        }
    }


@app.get("/backends")
def get_backends():
    """Get status of all BGP backends"""
    return backend_manager.get_status()


@app.get("/discover/peers")
def discover_peers():
    """
    Discover available BGP daemons in the network

    Returns a list of known BGP daemons that can be used as neighbors,
    including their IP addresses, ASNs, and other connection details.

    This is a static list of common lab daemons in the 192.168.70.0/24 network.
    """
    # Static list of known BGP daemons in the network
    # This could be made dynamic by reading from docker-compose files or DNS
    known_peers = [
        # Original lab daemons
        {"container_name": "gobgp_1", "ip_address": "192.168.70.14", "daemon_type": "gobgp", "suggested_asn": 65003},
        {"container_name": "frr_1", "ip_address": "192.168.70.12", "daemon_type": "frr", "suggested_asn": 65002},
        {"container_name": "frr_2", "ip_address": "192.168.70.10", "daemon_type": "frr", "suggested_asn": 65001},
        {"container_name": "exabgp_1", "ip_address": "192.168.70.15", "daemon_type": "exabgp", "suggested_asn": 65000},

        # Lab 1 daemons (port 5001)
        {"container_name": "gobgp_lab1", "ip_address": "192.168.70.10", "daemon_type": "gobgp", "suggested_asn": 65001},
        {"container_name": "frr_lab1", "ip_address": "192.168.70.11", "daemon_type": "frr", "suggested_asn": 65001},

        # Lab 2 daemons (port 5002)
        {"container_name": "gobgp_lab2", "ip_address": "192.168.70.20", "daemon_type": "gobgp", "suggested_asn": 65002},
        {"container_name": "exabgp_lab2", "ip_address": "192.168.70.22", "daemon_type": "exabgp", "suggested_asn": 65002},

        # Lab 3 daemons (port 5003)
        {"container_name": "gobgp_lab3", "ip_address": "192.168.70.30", "daemon_type": "gobgp", "suggested_asn": 65003},
        {"container_name": "frr_lab3", "ip_address": "192.168.70.31", "daemon_type": "frr", "suggested_asn": 65003},
        {"container_name": "exabgp_lab3", "ip_address": "192.168.70.32", "daemon_type": "exabgp", "suggested_asn": 65003},

        # Lab 4 daemons (port 5004)
        {"container_name": "gobgp_lab4", "ip_address": "192.168.70.40", "daemon_type": "gobgp", "suggested_asn": 6504},

        # Lab 5 daemons (port 5005)
        {"container_name": "gobgp_lab5", "ip_address": "192.168.70.50", "daemon_type": "gobgp", "suggested_asn": 6505},
        {"container_name": "frr_lab5", "ip_address": "192.168.70.51", "daemon_type": "frr", "suggested_asn": 6505},

        # Lab 6 daemons (port 5006)
        {"container_name": "gobgp_lab6", "ip_address": "192.168.70.61", "daemon_type": "gobgp", "suggested_asn": 6506},
        {"container_name": "frr_lab6", "ip_address": "192.168.70.62", "daemon_type": "frr", "suggested_asn": 6506},
        {"container_name": "exabgp_lab6", "ip_address": "192.168.70.63", "daemon_type": "exabgp", "suggested_asn": 6506},
    ]

    # Add description field
    peers = [
        {
            **peer,
            "description": f"{peer['daemon_type'].upper()} daemon on {peer['container_name']}"
        }
        for peer in known_peers
    ]

    return {
        "peers": peers,
        "count": len(peers)
    }


@app.get("/status")
def get_status(backend: Optional[str] = Query(None, description="Backend to query (gobgp/frr/exabgp)")):
    """
    Get BGP daemon status

    Query Parameters:
    - backend: Which backend to query (default: uses DEFAULT_BGP_BACKEND env var)
    """
    try:
        mgr = backend_manager.get_backend(backend)
        backend_name = backend or backend_manager.default_backend

        # Try to get status via CLI
        if backend_name == "frr":
            output = subprocess.check_output(
                ["vtysh", "-c", "show bgp summary"],
                text=True,
                stderr=subprocess.STDOUT
            )
        elif backend_name == "gobgp":
            output = subprocess.check_output(
                ["gobgp", "global"],
                text=True,
                stderr=subprocess.STDOUT
            )
        elif backend_name == "exabgp":
            output = "ExaBGP status available via process monitoring"
        else:
            output = "Unknown backend"

        return {
            "backend": backend_name,
            "status": "running",
            "info": output
        }
    except subprocess.CalledProcessError as e:
        return {
            "backend": backend or backend_manager.default_backend,
            "status": "error",
            "detail": e.output
        }


# ============================================================================
# Route Management
# ============================================================================

@app.get("/route")
def list_routes(backend: Optional[str] = Query(None, description="Backend to query (gobgp/frr)")):
    """List all BGP routes in the RIB"""
    mgr = backend_manager.get_backend(backend)

    # Check if backend supports listing routes
    if hasattr(mgr, 'get_all_routes'):
        routes = mgr.get_all_routes()
        return {
            "backend": backend or backend_manager.default_backend,
            "routes": routes,
            "count": len(routes)
        }
    else:
        raise HTTPException(
            status_code=501,
            detail=f"Backend {backend or backend_manager.default_backend} does not support listing routes"
        )


@app.post("/route/{prefix}/{cidr}")
def advertise_route(
    prefix: str,
    cidr: str,
    attrs: RouteAttributes = Body(...),
    backend: Optional[str] = Query(None, description="Backend to use (gobgp/frr)")
):
    """
    Advertise a BGP route

    Supports all RouteAttributes:
    - next_hop
    - community
    - extended_community
    - as_path (GoBGP only)
    - med (GoBGP only)
    """
    mgr = backend_manager.get_backend(backend)
    backend_name = backend or backend_manager.default_backend

    # Build kwargs based on what the backend supports
    # GoBGP supports all attributes, FRR only supports a subset
    kwargs = {
        "prefix": prefix,
        "cidr": cidr,
        "next_hop": attrs.next_hop,
        "community": attrs.community,
        "ext_community": attrs.extended_community,
    }

    # Only pass as_path and med if the backend supports them (GoBGP does, FRR doesn't)
    if backend_name == "gobgp":
        kwargs["as_path"] = attrs.as_path
        kwargs["med"] = attrs.med

    mgr.advertise_route(**kwargs)

    # Save to database
    daemon_name = os.getenv("DAEMON_NAME")
    if daemon_name:
        route_prefix = f"{prefix}/{cidr}"
        communities_str = ",".join(attrs.community) if attrs.community else None
        backend_manager.save_bgp_route(
            daemon_name=daemon_name,
            prefix=route_prefix,
            next_hop=attrs.next_hop,
            origin=attrs.origin if hasattr(attrs, 'origin') else "incomplete",
            local_pref=attrs.local_pref if hasattr(attrs, 'local_pref') else None,
            med=attrs.med,
            communities=communities_str
        )

    return {
        "backend": backend or backend_manager.default_backend,
        "message": f"Advertised route {prefix}/{cidr}",
        "applied_attributes": attrs.model_dump(exclude_none=True),
    }


@app.delete("/route/{prefix}/{cidr}")
def withdraw_route(
    prefix: str,
    cidr: str,
    backend: Optional[str] = Query(None, description="Backend to use (gobgp/frr)")
):
    """Withdraw a BGP route"""
    mgr = backend_manager.get_backend(backend)
    mgr.withdraw_route(prefix, cidr)

    return {
        "backend": backend or backend_manager.default_backend,
        "message": f"Withdrawn route {prefix}/{cidr}"
    }


@app.get("/route/{prefix}/{cidr}")
def get_route_status(
    prefix: str,
    cidr: str,
    backend: Optional[str] = Query(None, description="Backend to query (gobgp/frr)")
):
    """Get status of a specific route"""
    mgr = backend_manager.get_backend(backend)
    output = mgr.get_route_status(prefix, cidr)

    return {
        "backend": backend or backend_manager.default_backend,
        "result": output
    }


# ============================================================================
# Neighbor Management
# ============================================================================

@app.get("/neighbor")
def get_all_neighbors(backend: Optional[str] = Query(None, description="Backend to query (gobgp/frr)")):
    """List all BGP neighbors"""
    mgr = backend_manager.get_backend(backend)

    return {
        "backend": backend or backend_manager.default_backend,
        "neighbors": mgr.get_all_neighbors_full_state()
    }


@app.get("/neighbor/{ip}")
def get_neighbor_routes(
    ip: str,
    backend: Optional[str] = Query(None, description="Backend to query (gobgp/frr)")
):
    """Get routes for a specific neighbor"""
    mgr = backend_manager.get_backend(backend)

    return {
        "backend": backend or backend_manager.default_backend,
        **mgr.get_neighbor_routes(ip)
    }


@app.post("/neighbor/{ip}")
def configure_neighbor(
    ip: str,
    attrs: NeighborAttributes,
    backend: Optional[str] = Query(None, description="Backend to use (gobgp/frr)")
):
    """Configure a BGP neighbor"""
    mgr = backend_manager.get_backend(backend)

    mgr.configure_neighbor(
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
        next_hop_self=attrs.next_hop_self,
    )

    # Save to database
    daemon_name = os.getenv("DAEMON_NAME")
    if daemon_name:
        backend_manager.save_bgp_peer(
            daemon_name=daemon_name,
            peer_ip=ip,
            peer_asn=attrs.remote_asn
        )

    return {
        "backend": backend or backend_manager.default_backend,
        "message": f"Neighbor {ip} configured."
    }


@app.delete("/neighbor/{ip}")
def delete_neighbor(
    ip: str,
    backend: Optional[str] = Query(None, description="Backend to use (gobgp/frr)")
):
    """Delete a BGP neighbor"""
    mgr = backend_manager.get_backend(backend)
    mgr.delete_neighbor(ip)

    return {
        "backend": backend or backend_manager.default_backend,
        "message": f"Neighbor {ip} deleted."
    }


@app.post("/neighbor/status/{ip}")
def bring_up_neighbor(
    ip: str,
    remote_asn: int = Body(..., embed=True),
    backend: Optional[str] = Query(None, description="Backend to use (gobgp/frr)")
):
    """Bring up a BGP neighbor"""
    mgr = backend_manager.get_backend(backend)
    mgr.bring_up_neighbor(ip, remote_asn)

    return {
        "backend": backend or backend_manager.default_backend,
        "message": f"Neighbor {ip} brought up"
    }


@app.delete("/neighbor/status/{ip}")
def bring_down_neighbor(
    ip: str,
    backend: Optional[str] = Query(None, description="Backend to use (gobgp/frr)")
):
    """Shut down a BGP neighbor"""
    mgr = backend_manager.get_backend(backend)
    mgr.shut_down_neighbor(ip)

    return {
        "backend": backend or backend_manager.default_backend,
        "message": f"Neighbor {ip} shut down"
    }


# ============================================================================
# Policy Management
# ============================================================================

@app.get("/policy")
def list_policies(backend: Optional[str] = Query(None, description="Backend to query (gobgp/frr)")):
    """List all route policies"""
    mgr = backend_manager.get_backend(backend)

    return {
        "backend": backend or backend_manager.default_backend,
        "policies": mgr.list_route_maps()
    }


@app.post("/policy/{name}")
def update_policy(
    name: str,
    policy: PolicyDefinition,
    backend: Optional[str] = Query(None, description="Backend to use (gobgp/frr)")
):
    """Create or update a route policy"""
    mgr = backend_manager.get_backend(backend)
    mgr.create_or_update_policy(name, policy)

    return {
        "backend": backend or backend_manager.default_backend,
        "message": f"Policy {name} updated",
        "terms": policy.terms
    }


@app.delete("/policy/{name}")
def delete_policy(
    name: str,
    backend: Optional[str] = Query(None, description="Backend to use (gobgp/frr)")
):
    """Delete a route policy"""
    mgr = backend_manager.get_backend(backend)
    mgr.delete_policy(name)

    return {
        "backend": backend or backend_manager.default_backend,
        "message": f"Policy {name} deleted"
    }


# ============================================================================
# Prefix List Management
# ============================================================================

@app.get("/prefix_list")
def list_prefix_lists(backend: Optional[str] = Query(None, description="Backend to query (gobgp/frr)")):
    """List all prefix lists"""
    mgr = backend_manager.get_backend(backend)

    return {
        "backend": backend or backend_manager.default_backend,
        "prefix_lists": mgr.list_prefix_lists()
    }


@app.post("/prefix_list/{name}")
def update_prefix_list(
    name: str,
    pl: PrefixListDefinition,
    backend: Optional[str] = Query(None, description="Backend to use (gobgp/frr)")
):
    """Create or update a prefix list"""
    mgr = backend_manager.get_backend(backend)
    mgr.create_or_update_prefix_list(name, pl)

    return {
        "backend": backend or backend_manager.default_backend,
        "message": f"Prefix-list {name} updated",
        "prefixes": pl.prefixes
    }


@app.delete("/prefix_list/{name}")
def delete_prefix_list(
    name: str,
    backend: Optional[str] = Query(None, description="Backend to use (gobgp/frr)")
):
    """Delete a prefix list"""
    mgr = backend_manager.get_backend(backend)
    mgr.delete_prefix_list(name)

    return {
        "backend": backend or backend_manager.default_backend,
        "message": f"Prefix-list {name} deleted"
    }


# ============================================================================
# Configuration Management
# ============================================================================

@app.post("/save")
def save_config(backend: Optional[str] = Query(None, description="Backend to save (gobgp/frr)")):
    """Save BGP configuration"""
    mgr = backend_manager.get_backend(backend)
    output = mgr.save_config()

    return {
        "backend": backend or backend_manager.default_backend,
        "message": "Configuration saved",
        "output": output
    }


@app.post("/restore")
def restore_config(backend: Optional[str] = Query(None, description="Backend to restore (gobgp/frr)")):
    """Restore BGP configuration from database"""
    daemon_name = os.getenv("DAEMON_NAME")
    if not daemon_name:
        return {
            "error": "DAEMON_NAME not set",
            "message": "Cannot restore without daemon name"
        }

    mgr = backend_manager.get_backend(backend)
    restored_peers = 0
    restored_routes = 0

    # Restore BGP peers
    peers = backend_manager.get_daemon_peers(daemon_name)
    for peer in peers:
        try:
            mgr.configure_neighbor(
                ip=peer['peer_ip'],
                remote_as=peer['peer_asn'],
                local_as=int(os.getenv("GOBGP_ASN") or os.getenv("FRR_ASN") or 65000),
                description=f"Restored from DB"
            )
            restored_peers += 1
        except Exception as e:
            logger.error(f"Failed to restore peer {peer['peer_ip']}: {e}")

    # Restore BGP routes
    routes = backend_manager.get_daemon_routes(daemon_name)
    for route in routes:
        try:
            prefix, cidr = route['prefix'].split('/')
            mgr.advertise_route(
                prefix=prefix,
                cidr=cidr,
                next_hop=route['next_hop']
            )
            restored_routes += 1
        except Exception as e:
            logger.error(f"Failed to restore route {route['prefix']}: {e}")

    return {
        "backend": backend or backend_manager.default_backend,
        "message": "Configuration restored from database",
        "restored_peers": restored_peers,
        "restored_routes": restored_routes
    }


# ============================================================================
# FlowSpec Traffic Filtering
# ============================================================================

@app.get("/flowspec")
def list_flowspec_rules(
    family: str = Query("ipv4", description="Address family (ipv4/ipv6)"),
    backend: Optional[str] = Query(None, description="Backend to use (gobgp/frr)")
):
    """
    List all FlowSpec rules

    FlowSpec provides advanced traffic filtering capabilities for:
    - DDoS mitigation (blackhole routing)
    - Traffic policing (rate limiting)
    - Traffic redirection (via route targets)
    """
    mgr = backend_manager.get_backend(backend)

    # Only GoBGP supports flowspec via the API
    if not hasattr(mgr, 'get_flowspec_rules'):
        raise HTTPException(
            status_code=501,
            detail=f"FlowSpec not supported by {backend or backend_manager.default_backend} backend"
        )

    rules = mgr.get_flowspec_rules(family=family)
    return {
        "backend": backend or backend_manager.default_backend,
        "family": family,
        "rules": rules,
        "count": len(rules)
    }


@app.post("/flowspec")
def add_flowspec_rule(
    rule: FlowSpecRule,
    backend: Optional[str] = Query(None, description="Backend to use (gobgp/frr)")
):
    """
    Add a FlowSpec traffic filtering rule

    Examples:
    - Blackhole an IP: {"match": {"destination": "203.0.113.99/32"}, "actions": {"action": "discard"}}
    - Rate limit: {"match": {"destination": "192.0.2.0/24"}, "actions": {"action": "rate-limit", "rate": 10.0}}
    - Redirect to VRF: {"match": {"source": "198.51.100.0/24"}, "actions": {"action": "redirect", "redirect_rt": "65000:100"}}
    """
    mgr = backend_manager.get_backend(backend)

    # Only GoBGP supports flowspec via the API
    if not hasattr(mgr, 'add_flowspec_rule'):
        raise HTTPException(
            status_code=501,
            detail=f"FlowSpec not supported by {backend or backend_manager.default_backend} backend"
        )

    # Convert Pydantic model to dict for manager
    match_dict = rule.match.model_dump(exclude_none=True)
    actions_dict = rule.actions.model_dump(exclude_none=True)

    mgr.add_flowspec_rule(
        family=rule.family,
        match=match_dict,
        actions=actions_dict
    )

    return {
        "backend": backend or backend_manager.default_backend,
        "message": "FlowSpec rule added",
        "rule": rule.model_dump()
    }


@app.delete("/flowspec")
def delete_flowspec_rule(
    rule: FlowSpecRule,
    backend: Optional[str] = Query(None, description="Backend to use (gobgp/frr)")
):
    """Delete a FlowSpec traffic filtering rule"""
    mgr = backend_manager.get_backend(backend)

    # Only GoBGP supports flowspec via the API
    if not hasattr(mgr, 'delete_flowspec_rule'):
        raise HTTPException(
            status_code=501,
            detail=f"FlowSpec not supported by {backend or backend_manager.default_backend} backend"
        )

    # Convert Pydantic model to dict for manager
    match_dict = rule.match.model_dump(exclude_none=True)

    mgr.delete_flowspec_rule(
        family=rule.family,
        match=match_dict
    )

    return {
        "backend": backend or backend_manager.default_backend,
        "message": "FlowSpec rule deleted",
        "match": match_dict
    }


# ============================================================================
# FlowSpec Enforcement via iptables
# ============================================================================

@app.post("/flowspec/enforce")
def enforce_flowspec_rule(
    rule: FlowSpecRule,
    backend: Optional[str] = Query(None, description="Backend to use (gobgp/frr)")
):
    """
    Enforce a FlowSpec rule by installing it as an iptables rule locally on this router.
    This translates BGP FlowSpec into actual packet filtering in the data plane.
    """
    # Build iptables command based on flowspec rule
    cmd = ["iptables", "-I", "FORWARD", "1"]

    match = rule.match
    actions = rule.actions

    # Add match criteria
    if match.source:
        cmd.extend(["-s", match.source])
    if match.destination:
        cmd.extend(["-d", match.destination])
    if match.protocol:
        proto_map = {1: "icmp", 6: "tcp", 17: "udp"}
        proto_name = proto_map.get(match.protocol, str(match.protocol))
        cmd.extend(["-p", proto_name])
    if match.destination_port:
        cmd.extend(["--dport", str(match.destination_port)])
    if match.source_port:
        cmd.extend(["--sport", str(match.source_port)])

    # Add action
    if actions.action == "discard":
        cmd.extend(["-j", "DROP"])
    elif actions.action == "accept":
        cmd.extend(["-j", "ACCEPT"])
    elif actions.action == "rate-limit" and actions.rate:
        # Rate limiting requires hashlimit module
        cmd.extend([
            "-m", "hashlimit",
            "--hashlimit-above", f"{actions.rate}mb/s",
            "--hashlimit-mode", "srcip,dstip",
            "--hashlimit-name", "flowspec_rate",
            "-j", "DROP"
        ])
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported action: {actions.action}"
        )

    # Execute iptables command locally
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=5)

        if result.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to install iptables rule: {result.stderr}"
            )

        logger.info(f"[FlowSpec] Installed iptables rule: {' '.join(cmd)}")

        return {
            "message": "FlowSpec rule enforced via iptables",
            "command": " ".join(cmd),
            "rule": {
                "match": rule.match.model_dump(exclude_none=True),
                "actions": rule.actions.model_dump(exclude_none=True)
            },
            "output": result.stdout
        }

    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=500,
            detail="iptables command timed out"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error enforcing FlowSpec rule: {str(e)}"
        )


@app.delete("/flowspec/enforce")
def unenforce_flowspec_rule(rule: FlowSpecRule):
    """
    Remove a FlowSpec enforcement (iptables rule) from this router.
    """
    # Build iptables delete command
    cmd = ["iptables", "-D", "FORWARD"]

    match = rule.match
    actions = rule.actions

    # Add match criteria (must match exactly what was installed)
    if match.source:
        cmd.extend(["-s", match.source])
    if match.destination:
        cmd.extend(["-d", match.destination])
    if match.protocol:
        proto_map = {1: "icmp", 6: "tcp", 17: "udp"}
        proto_name = proto_map.get(match.protocol, str(match.protocol))
        cmd.extend(["-p", proto_name])
    if match.destination_port:
        cmd.extend(["--dport", str(match.destination_port)])
    if match.source_port:
        cmd.extend(["--sport", str(match.source_port)])

    # Add action
    if actions.action == "discard":
        cmd.extend(["-j", "DROP"])
    elif actions.action == "accept":
        cmd.extend(["-j", "ACCEPT"])
    elif actions.action == "rate-limit" and actions.rate:
        cmd.extend([
            "-m", "hashlimit",
            "--hashlimit-above", f"{actions.rate}mb/s",
            "--hashlimit-mode", "srcip,dstip",
            "--hashlimit-name", "flowspec_rate",
            "-j", "DROP"
        ])

    # Execute iptables command locally
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=5)

        if result.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to remove iptables rule: {result.stderr}"
            )

        logger.info(f"[FlowSpec] Removed iptables rule: {' '.join(cmd)}")

        return {
            "message": "FlowSpec enforcement removed",
            "command": " ".join(cmd),
            "output": result.stdout
        }

    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=500,
            detail="iptables command timed out"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error removing FlowSpec enforcement: {str(e)}"
        )


@app.get("/flowspec/enforce")
def list_enforced_rules():
    """
    List currently enforced FlowSpec rules (iptables FORWARD chain rules) on this router.
    """
    try:
        # List iptables rules
        result = subprocess.run(
            ["iptables", "-L", "FORWARD", "-n", "-v", "--line-numbers"],
            capture_output=True,
            text=True,
            timeout=5
        )

        if result.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to list iptables rules: {result.stderr}"
            )

        return {
            "rules": result.stdout,
            "message": "FlowSpec enforcement rules listed"
        }

    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=500,
            detail="iptables command timed out"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error listing FlowSpec enforcement: {str(e)}"
        )


# ============================================================================
# BMP (BGP Monitoring Protocol) Server Configuration
# ============================================================================

@app.get("/bmp")
def list_bmp_servers(
    backend: Optional[str] = Query(None, description="Backend to use (gobgp only)")
):
    """
    List configured BMP servers

    BMP allows routers to send BGP monitoring data to a central collector.
    This is useful for network visibility and troubleshooting.
    """
    mgr = backend_manager.get_backend(backend)

    # Only GoBGP supports BMP via the API
    if not hasattr(mgr, 'list_bmp_servers'):
        raise HTTPException(
            status_code=501,
            detail=f"BMP not supported by {backend or backend_manager.default_backend} backend"
        )

    servers = mgr.list_bmp_servers()

    return {
        "backend": backend or backend_manager.default_backend,
        "servers": servers
    }


@app.post("/bmp")
def add_bmp_server(
    config: BmpServerConfig,
    backend: Optional[str] = Query(None, description="Backend to use (gobgp only)")
):
    """
    Configure a BMP (BGP Monitoring Protocol) server

    This tells the BGP daemon to send monitoring data to the specified BMP collector.

    Example:
        {
            "address": "192.168.70.20",
            "port": 11019,
            "route_monitoring_policy": "both",
            "statistics_timeout": 60
        }
    """
    mgr = backend_manager.get_backend(backend)

    # Check if backend supports BMP
    if not hasattr(mgr, 'add_bmp_server'):
        raise HTTPException(
            status_code=501,
            detail=f"BMP not supported by {backend or backend_manager.default_backend} backend"
        )

    mgr.add_bmp_server(
        address=config.address,
        port=config.port,
        route_monitoring_policy=config.route_monitoring_policy,
        statistics_timeout=config.statistics_timeout
    )

    return {
        "backend": backend or backend_manager.default_backend,
        "message": "BMP server added",
        "config": config.model_dump()
    }


@app.delete("/bmp")
def delete_bmp_server(
    address: str = Query(..., description="BMP server IP address"),
    port: int = Query(11019, description="BMP server port"),
    backend: Optional[str] = Query(None, description="Backend to use (gobgp only)")
):
    """
    Remove a BMP server configuration

    Stops sending BGP monitoring data to the specified BMP server.
    """
    mgr = backend_manager.get_backend(backend)

    # Only GoBGP supports BMP via the API
    if not hasattr(mgr, 'delete_bmp_server'):
        raise HTTPException(
            status_code=501,
            detail=f"BMP not supported by {backend or backend_manager.default_backend} backend"
        )

    mgr.delete_bmp_server(address=address, port=port)

    return {
        "backend": backend or backend_manager.default_backend,
        "message": "BMP server removed",
        "address": address,
        "port": port
    }


# ============================================================================
# NetFlow/IPFIX Collector Configuration
# ============================================================================

@app.get("/netflow")
def list_netflow_collectors(
    backend: Optional[str] = Query(None, description="Backend to use (frr only)")
):
    """
    List configured NetFlow/IPFIX collectors

    NetFlow/IPFIX exports flow data from the router to a central collector.
    This is useful for traffic analysis and network visibility.
    """
    mgr = backend_manager.get_backend(backend)

    # Only FRR supports NetFlow via the API currently
    if not hasattr(mgr, 'list_netflow_collectors'):
        raise HTTPException(
            status_code=501,
            detail=f"NetFlow not supported by {backend or backend_manager.default_backend} backend"
        )

    collectors = mgr.list_netflow_collectors()

    return {
        "backend": backend or backend_manager.default_backend,
        "collectors": collectors
    }


@app.post("/netflow")
def add_netflow_collector(
    config: NetFlowConfig,
    backend: Optional[str] = Query(None, description="Backend to use (frr only)")
):
    """
    Configure a NetFlow/IPFIX collector

    This tells the BGP daemon to export flow data to the specified collector.

    Example:
        {
            "address": "192.168.70.20",
            "port": 2055,
            "version": 10,
            "source_id": 1
        }
    """
    mgr = backend_manager.get_backend(backend)

    # Only FRR supports NetFlow via the API currently
    if not hasattr(mgr, 'add_netflow_collector'):
        raise HTTPException(
            status_code=501,
            detail=f"NetFlow not supported by {backend or backend_manager.default_backend} backend"
        )

    mgr.add_netflow_collector(
        address=config.address,
        port=config.port,
        version=config.version,
        source_id=config.source_id
    )

    return {
        "backend": backend or backend_manager.default_backend,
        "message": "NetFlow collector added",
        "config": config.model_dump()
    }


@app.delete("/netflow")
def delete_netflow_collector(
    address: str = Query(..., description="NetFlow collector IP address"),
    port: int = Query(2055, description="NetFlow collector port"),
    backend: Optional[str] = Query(None, description="Backend to use (frr only)")
):
    """
    Remove a NetFlow collector configuration

    Stops exporting flow data to the specified NetFlow collector.
    """
    mgr = backend_manager.get_backend(backend)

    # Only FRR supports NetFlow via the API currently
    if not hasattr(mgr, 'delete_netflow_collector'):
        raise HTTPException(
            status_code=501,
            detail=f"NetFlow not supported by {backend or backend_manager.default_backend} backend"
        )

    mgr.delete_netflow_collector(address=address, port=port)

    return {
        "backend": backend or backend_manager.default_backend,
        "message": "NetFlow collector removed",
        "address": address,
        "port": port
    }


# ============================================================================
# WebSocket Endpoints for Real-Time Streaming
# ============================================================================

@app.websocket("/bgp/ws/stream")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time BGP updates
    Streams all BGP neighbor and route changes to connected clients
    """
    await ws_manager.connect(websocket, "all")
    try:
        # Send initial connection message
        await websocket.send_json({
            "type": "connection_established",
            "message": "Connected to Unified BGP API streaming"
        })

        # Keep connection alive and handle client messages
        while True:
            try:
                # Wait for client messages (ping/pong, subscription changes, etc.)
                data = await websocket.receive_text()
                logger.debug(f"Received WebSocket message: {data}")

                # Echo back for testing
                await websocket.send_json({
                    "type": "echo",
                    "data": data
                })
            except WebSocketDisconnect:
                break

    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        ws_manager.disconnect(websocket, "all")


@app.websocket("/bgp/ws/neighbors")
async def websocket_neighbors(websocket: WebSocket):
    """WebSocket endpoint for neighbor state changes only"""
    await ws_manager.connect(websocket, "neighbors")
    try:
        await websocket.send_json({
            "type": "connection_established",
            "channel": "neighbors"
        })

        while True:
            try:
                await websocket.receive_text()
            except WebSocketDisconnect:
                break
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        ws_manager.disconnect(websocket, "neighbors")


@app.websocket("/bgp/ws/routes")
async def websocket_routes(websocket: WebSocket):
    """WebSocket endpoint for route advertisements/withdrawals only"""
    await ws_manager.connect(websocket, "routes")
    try:
        await websocket.send_json({
            "type": "connection_established",
            "channel": "routes"
        })

        while True:
            try:
                await websocket.receive_text()
            except WebSocketDisconnect:
                break
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        ws_manager.disconnect(websocket, "routes")


@app.websocket("/bmp/ws/stream")
async def websocket_bmp(websocket: WebSocket):
    """WebSocket endpoint for BMP events only"""
    await ws_manager.connect(websocket, "bmp")
    try:
        await websocket.send_json({
            "type": "connection_established",
            "channel": "bmp"
        })

        while True:
            try:
                await websocket.receive_text()
            except WebSocketDisconnect:
                break
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        ws_manager.disconnect(websocket, "bmp")


@app.get("/ws/stats")
def websocket_stats():
    """Get WebSocket connection statistics"""
    return ws_manager.get_stats()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "5000")))
