"""
Main entry point for Unified Monitoring API
Single FastAPI application running BMP and NetFlow collectors
"""
import logging
import os
import sys

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("NetStream Unified Monitoring API")
    logger.info("=" * 60)

    # Import and run unified API
    try:
        from unified_monitoring_api import app
        import uvicorn

        api_port = int(os.getenv("MONITORING_API_PORT", "5002"))

        logger.info(f"Starting unified API on port {api_port}")
        logger.info(f"  BMP Server:        TCP port {os.getenv('BMP_LISTEN_PORT', '11019')}")
        logger.info(f"  NetFlow Collector: UDP port {os.getenv('NETFLOW_PORT', '2055')}")
        logger.info("=" * 60)

        uvicorn.run(
            app,
            host="0.0.0.0",
            port=api_port,
            log_level="info"
        )

    except Exception as e:
        logger.error(f"Failed to start unified monitoring API: {e}")
        sys.exit(1)
