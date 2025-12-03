"""
Main entry point for the Container Management API
"""
import uvicorn
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

if __name__ == "__main__":
    logger.info("Starting Container Management API...")
    uvicorn.run(
        "api-container.core.container_api:app",
        host="0.0.0.0",
        port=5000,
        reload=True,
        log_level="info"
    )
