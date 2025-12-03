"""
Unified Monitoring API
Combines BMP Server and NetFlow Collector into a single FastAPI application
"""
import asyncio
import logging
import os
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger("monitoring-api")

# Create unified FastAPI app
app = FastAPI(
    title="NetStream Monitoring API",
    description="Unified BMP and NetFlow monitoring service",
    version="2.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Import BMP server components
try:
    from bmp_server import (
        app as bmp_app,
        start_bmp_server,
        bmp_peers,
        bmp_routes,
        bmp_stats
    )
    BMP_AVAILABLE = True
    logger.info("✓ BMP server module loaded")
except ImportError as e:
    logger.error(f"Failed to import BMP server: {e}")
    BMP_AVAILABLE = False


# Import NetFlow collector components
try:
    from netflow_collector import (
        app as netflow_app,
        collector,
        flows_storage,
        triggers_storage,
        triggered_events,
        active_websockets,
        sync_triggers_from_topology,
        periodic_trigger_sync,
        periodic_aggregated_trigger_check
    )
    NETFLOW_AVAILABLE = True
    logger.info("✓ NetFlow collector module loaded")
except ImportError as e:
    logger.error(f"Failed to import NetFlow collector: {e}")
    NETFLOW_AVAILABLE = False


# ============================================================================
# Mount sub-applications
# ============================================================================

if BMP_AVAILABLE:
    # Mount BMP app under /bmp prefix
    app.mount("/bmp", bmp_app)
    logger.info("✓ BMP endpoints mounted at /bmp/*")

if NETFLOW_AVAILABLE:
    # Mount NetFlow app under /netflow prefix
    app.mount("/netflow", netflow_app)
    logger.info("✓ NetFlow endpoints mounted at /netflow/*")


# ============================================================================
# Unified health check endpoint
# ============================================================================

@app.get("/")
async def root():
    """API information and service status"""
    return {
        "service": "NetStream Monitoring API",
        "version": "2.0",
        "services": {
            "bmp": {
                "available": BMP_AVAILABLE,
                "port": int(os.getenv("BMP_LISTEN_PORT", "11019")),
                "peers_count": len(bmp_peers) if BMP_AVAILABLE else 0
            },
            "netflow": {
                "available": NETFLOW_AVAILABLE,
                "port": int(os.getenv("NETFLOW_PORT", "2055")),
                "flows_count": len(flows_storage) if NETFLOW_AVAILABLE else 0
            }
        },
        "endpoints": {
            "bmp": "/bmp/*" if BMP_AVAILABLE else "unavailable",
            "netflow": "/netflow/*" if NETFLOW_AVAILABLE else "unavailable"
        }
    }


@app.get("/health")
async def health_check():
    """Combined health check for all services"""
    health = {
        "status": "healthy",
        "services": {}
    }

    if BMP_AVAILABLE:
        health["services"]["bmp"] = {
            "status": "running",
            "peers": len(bmp_peers),
            "port": int(os.getenv("BMP_LISTEN_PORT", "11019"))
        }

    if NETFLOW_AVAILABLE:
        health["services"]["netflow"] = {
            "status": "running",
            "flows": len(flows_storage),
            "port": int(os.getenv("NETFLOW_PORT", "2055"))
        }

    return health


# ============================================================================
# Startup/Shutdown Events
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """Start both BMP and NetFlow collectors on app startup"""
    logger.info("=" * 60)
    logger.info("Starting Unified Monitoring API")
    logger.info("=" * 60)

    # Start BMP server
    if BMP_AVAILABLE:
        bmp_host = os.getenv("BMP_LISTEN_HOST", "0.0.0.0")
        bmp_port = int(os.getenv("BMP_LISTEN_PORT", "11019"))
        asyncio.create_task(start_bmp_server(bmp_host, bmp_port))
        logger.info(f"✓ BMP server started on {bmp_host}:{bmp_port}")

    # Start NetFlow collector
    if NETFLOW_AVAILABLE:
        asyncio.create_task(collector.start())
        netflow_port = int(os.getenv("NETFLOW_PORT", "2055"))
        logger.info(f"✓ NetFlow collector started on port {netflow_port}")

        # Start trigger sync and aggregated evaluation tasks
        sync_triggers_from_topology()  # Initial sync
        asyncio.create_task(periodic_trigger_sync())
        logger.info("✓ Trigger sync started (syncing every 30s)")
        asyncio.create_task(periodic_aggregated_trigger_check())
        logger.info("✓ Aggregated trigger evaluation started (checking every 5s)")

    logger.info("=" * 60)
    logger.info("All monitoring services running")
    logger.info("=" * 60)


@app.on_event("shutdown")
async def shutdown_event():
    """Stop collectors on app shutdown"""
    logger.info("Shutting down monitoring services...")

    if NETFLOW_AVAILABLE:
        collector.stop()
        logger.info("✓ NetFlow collector stopped")

    logger.info("Shutdown complete")


if __name__ == "__main__":
    # Get API port from environment
    api_port = int(os.getenv("MONITORING_API_PORT", "5002"))

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=api_port,
        log_level="info"
    )
