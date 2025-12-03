"""
NetFlow Tap Routes
Handles API endpoints for creating and managing NetFlow tap containers
Taps are tied to container + network (the interface is resolved automatically)
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class TapCreateRequest(BaseModel):
    """Request model for creating a NetFlow tap"""
    container_name: str
    network_name: str  # The Docker network to tap on this container
    collector_ip: Optional[str] = None  # Auto-discover if not provided
    collector_port: Optional[int] = 2055
    netflow_version: Optional[int] = 5
    topology_name: Optional[str] = None  # Save to topology database if provided


def setup_tap_routes(app, tap_manager, discover_monitoring_services_func, client, database=None):
    """Setup NetFlow tap routes"""
    router = APIRouter(prefix="/taps", tags=["netflow-taps"])

    @router.post("/create")
    def create_tap(request: TapCreateRequest):
        """
        Create a NetFlow tap on a container's network connection

        Creates a tap container that monitors traffic on the specified
        container's connection to the given network.
        """
        try:
            # Auto-discover collector if not provided
            collector_ip = request.collector_ip
            collector_port = request.collector_port or 2055

            if not collector_ip:
                monitoring_info = discover_monitoring_services_func(client, "localhost")
                if not monitoring_info or not monitoring_info.get("netflow_udp_port"):
                    raise HTTPException(
                        status_code=503,
                        detail="Could not discover NetFlow collector and no collector_ip provided"
                    )

                # Get monitoring container's IP on mgmt_network
                monitoring_container = client.containers.get("netstream-monitoring")
                networks = monitoring_container.attrs.get('NetworkSettings', {}).get('Networks', {})

                if 'mgmt_network' in networks:
                    collector_ip = networks['mgmt_network'].get('IPAddress')
                elif 'netstream_lab_builder_network' in networks:
                    collector_ip = networks['netstream_lab_builder_network'].get('IPAddress')
                else:
                    raise HTTPException(
                        status_code=503,
                        detail="Could not determine monitoring service IP"
                    )

                collector_port = monitoring_info["netflow_udp_port"]

            # Create the tap (interface is resolved from container + network)
            result = tap_manager.create_tap(
                container_name=request.container_name,
                network_name=request.network_name,
                collector_ip=collector_ip,
                collector_port=collector_port,
                netflow_version=request.netflow_version or 5
            )

            if result.get("status") == "error":
                raise HTTPException(status_code=400, detail=result.get("message"))

            # Save to topology database if topology_name provided
            if request.topology_name and database:
                try:
                    database.tap.create(
                        tap_name=result.get("tap_name", f"tap-{request.container_name}-{request.network_name}"),
                        topology_name=request.topology_name,
                        container_name=request.container_name,
                        network_name=request.network_name,
                        collector_ip=collector_ip,
                        collector_port=collector_port,
                        netflow_version=request.netflow_version or 5
                    )
                    logger.info(f"Tap saved to topology '{request.topology_name}'")
                except Exception as e:
                    logger.error(f"Failed to save tap to topology: {e}")
                    # Don't fail the whole request if topology save fails

            return result

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to create tap: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=str(e))

    @router.delete("/{container_name}/{network_name}")
    def delete_tap(container_name: str, network_name: str):
        """
        Delete a NetFlow tap

        Removes the tap container and cleans up tc rules.
        """
        try:
            result = tap_manager.delete_tap(container_name, network_name)

            if result.get("status") == "error":
                raise HTTPException(status_code=400, detail=result.get("message"))

            # Also remove from database if exists
            if database:
                try:
                    active_topology = database.get_active_topology()
                    if active_topology:
                        database.tap.delete(active_topology['name'], container_name, network_name)
                except Exception as e:
                    logger.warning(f"Failed to delete tap from database: {e}")

            return result

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to delete tap: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=str(e))

    @router.get("/list")
    def list_taps(container_name: Optional[str] = Query(None, description="Filter by container name")):
        """
        List all NetFlow taps, optionally filtered by container

        Returns information about all active taps including target container,
        network, and collector details.
        """
        try:
            taps = tap_manager.list_taps(container_name)
            return {
                "taps": taps,
                "count": len(taps)
            }

        except Exception as e:
            logger.error(f"Failed to list taps: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=str(e))

    @router.get("/stats/{container_name}/{network_name}")
    def get_tap_stats(container_name: str, network_name: str):
        """
        Get statistics for a specific NetFlow tap

        Returns softflowd statistics and interface counters.
        """
        try:
            stats = tap_manager.get_tap_stats(container_name, network_name)

            if stats is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"Tap not found for {container_name} on {network_name}"
                )

            return stats

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to get tap stats: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=str(e))

    @router.post("/start/{container_name}/{network_name}")
    def start_tap(container_name: str, network_name: str):
        """
        Start a stopped NetFlow tap

        Starts the tap container if it's not already running.
        """
        try:
            result = tap_manager.start_tap(container_name, network_name)

            if result.get("status") == "error":
                raise HTTPException(status_code=400, detail=result.get("message"))

            return result

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to start tap: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=str(e))

    @router.post("/stop/{container_name}/{network_name}")
    def stop_tap(container_name: str, network_name: str):
        """
        Stop a running NetFlow tap

        Stops the tap container without removing it.
        """
        try:
            result = tap_manager.stop_tap(container_name, network_name)

            if result.get("status") == "error":
                raise HTTPException(status_code=400, detail=result.get("message"))

            return result

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to stop tap: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=str(e))

    # Register router with app
    app.include_router(router)
    return router
