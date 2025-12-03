import asyncio
from contextlib import asynccontextmanager
import logging
import os
import subprocess

from fastapi import FastAPI, Body
from fastapi.middleware.cors import CORSMiddleware
from starlette.websockets import WebSocket, WebSocketDisconnect

from connection_manager import manager
from frr_manager import FRRManager
from ..common.models import RouteAttributes, NeighborAttributes, PolicyDefinition, PrefixListDefinition, FlowSpecRule, BmpServerConfig, EventWebhook

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("uvicorn.error")

# Import gRPC manager if available
try:
    from frr_grpc_manager import FRRgRPCManager
    GRPC_AVAILABLE = True
except ImportError:
    GRPC_AVAILABLE = False
    logger.warning("[FRR] gRPC bindings not available - using vtysh only")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up...")
    await start_periodic_broadcast()
    yield
    logger.info("Shutting down...")


app = FastAPI(lifespan=lifespan)

origins = [
    # "http://localhost:3000",
    # "http://localhost:8006",
    # "http://localhost:8007",
    # "https://yourfrontenddomain.com",
    "*",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
BGP_ASN = int(os.getenv("LOCAL_ASN", "65002"))
BGP_ROUTER_ID = os.getenv("LOCAL_ROUTER_ID", "192.168.70.12")
PREFIX_LIST = "OUT"
INTERFACE = "eth0"

# Environment variable to enable gRPC mode
USE_GRPC = os.getenv("FRR_USE_GRPC", "false").lower() == "true"

# Initialize managers
frr_vtysh = FRRManager(asn=BGP_ASN, router_id=BGP_ROUTER_ID)

if USE_GRPC and GRPC_AVAILABLE:
    try:
        frr_grpc = FRRgRPCManager(grpc_host="localhost", bgpd_port=50052, zebra_port=50051)
        frr = frr_grpc  # Use gRPC by default
        logger.info("[FRR] gRPC mode ENABLED - using native gRPC API")
    except Exception as e:
        logger.error(f"[FRR] gRPC initialization failed, falling back to vtysh: {e}")
        frr = frr_vtysh
        USE_GRPC = False
else:
    frr = frr_vtysh
    if USE_GRPC and not GRPC_AVAILABLE:
        logger.warning("[FRR] gRPC requested but bindings not available - using vtysh")
    else:
        logger.info("[FRR] vtysh mode ENABLED - using subprocess calls")


@app.post("/route/{prefix}/{cidr}")
def advertise_route(prefix: str, cidr: str, attrs: RouteAttributes = Body(...)):
    if USE_GRPC:
        # gRPC API uses full prefix notation
        result = frr.advertise_route(
            prefix=f"{prefix}/{cidr}",
            next_hop=attrs.next_hop,
            community=attrs.community,
            as_path=attrs.as_path,
            med=attrs.med
        )
        return {
            "message": f"Advertised route {prefix}/{cidr} via gRPC",
            "applied_attributes": attrs.dict(exclude_none=True),
            "method": "grpc",
            **result
        }
    else:
        # vtysh API uses separate prefix and cidr
        frr.advertise_route(
            prefix=prefix,
            cidr=cidr,
            next_hop=attrs.next_hop,
            community=attrs.community,
            ext_community=attrs.extended_community,
        )
        return {
            "message": f"Advertised route {prefix}/{cidr} via vtysh",
            "applied_attributes": attrs.dict(exclude_none=True),
            "method": "vtysh"
        }

@app.delete("/route/{prefix}/{cidr}")
def withdraw_route(prefix: str, cidr: str):
    if USE_GRPC:
        result = frr.withdraw_route(f"{prefix}/{cidr}")
        return {
            "message": f"Withdrawn route {prefix}/{cidr} via gRPC",
            "method": "grpc",
            **result
        }
    else:
        frr.withdraw_route(prefix, cidr)
        return {
            "message": f"Withdrawn route {prefix}/{cidr} via vtysh",
            "method": "vtysh"
        }

@app.get("/route/{prefix}/{cidr}")
def get_route_status(prefix: str, cidr: str):
    output = frr.get_route_status(prefix, cidr)
    return {"result": output}


@app.get("/neighbor")
def get_neighbor_routes():
    return {"neighbors": frr.get_all_neighbors_full_state()}

@app.get("/neighbor/{ip}")
def get_neighbor_routes(ip: str):
    return frr.get_neighbor_routes(ip)

@app.post("/neighbor/{ip}")
def configure_neighbor(ip: str, attrs: NeighborAttributes):
    frr.configure_neighbor(
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
    frr.bring_up_neighbor(ip, remote_asn)
    return {"message": f"Neighbor {ip} brought up"}

@app.delete("/neighbor/status/{ip}")
def bring_down(ip: str):
    frr.shut_down_neighbor(ip)
    return {"message": f"Neighbor {ip} shut down"}


@app.get("/policy")
def list_policies():
    return {"policies": frr.list_route_maps()}

@app.post("/policy/{name}")
def update_policy(name: str, policy: PolicyDefinition):
    frr.create_or_update_policy(name, policy)
    return {"message": f"Policy {name} updated", "terms": policy.terms}

@app.delete("/policy/{name}")
def delete_policy(name: str):
    frr.delete_policy(name)
    return {"message": f"Policy {name} deleted"}


@app.get("/prefix_list")
def list_prefix_lists():
    return {"prefix_lists": frr.list_prefix_lists()}

@app.post("/prefix_list/{name}")
def update_prefix_list(name: str, pl: PrefixListDefinition):
    frr.create_or_update_prefix_list(name, pl)
    return {"message": f"Prefix-list {name} updated", "prefixes": pl.prefixes}

@app.delete("/prefix_list/{name}")
def delete_prefix_list(name: str):
    frr.delete_prefix_list(name)
    return {"message": f"Prefix-list {name} deleted"}


@app.post("/save")
def save_frr_config():
    output = frr.save_config()
    return {"message": "FRR configuration saved", "output": output}


@app.get("/status")
def get_status():
    """Get FRR daemon status"""
    try:
        # Try to get BGP summary using vtysh
        output = subprocess.check_output(
            ["vtysh", "-c", "show bgp summary"],
            text=True,
            stderr=subprocess.STDOUT
        )
        return {"status": "running", "info": output}
    except subprocess.CalledProcessError as e:
        return {"status": "error", "detail": e.output}


@app.get("/api/status")
def get_api_status():
    """Get API status including gRPC vs vtysh mode"""
    status = {
        "mode": "grpc" if USE_GRPC else "vtysh",
        "grpc_available": GRPC_AVAILABLE,
        "grpc_enabled": USE_GRPC,
        "asn": BGP_ASN,
        "router_id": BGP_ROUTER_ID
    }

    if USE_GRPC and GRPC_AVAILABLE:
        try:
            capabilities = frr.get_capabilities()
            status["grpc_capabilities"] = capabilities
        except Exception as e:
            status["grpc_error"] = str(e)

    return status


@app.websocket("/ws/routes")
async def route_ws_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            neighbors = frr.get_all_neighbors_full_state()
            await manager.broadcast({"neighbors": neighbors})
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        manager.disconnect(websocket)


async def start_periodic_broadcast():
    async def broadcast_loop():
        logger.info("Starting periodic BGP neighbor broadcast loop")

        while True:
            try:
                neighbor_states = frr.get_all_neighbors_full_state()
                await manager.broadcast({"neighbors": neighbor_states})
                await asyncio.sleep(2)
            except Exception as e:
                logger.exception("Periodic broadcast failed")

    asyncio.create_task(broadcast_loop())  # ✅ launches the loop