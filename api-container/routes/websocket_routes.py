"""
WebSocket Routes
Handles WebSocket connections for BMP, NetFlow, and Network Testing Tools
"""
from fastapi import WebSocket, WebSocketDisconnect
import logging
import asyncio
import os
import websockets


logger = logging.getLogger("container-api")


def setup_websocket_routes(app, bmp_manager, netflow_manager, netflow_flows_manager, discover_monitoring_services_func, client, container_manager):
    """Setup WebSocket routes with managers and dependencies"""

    @app.websocket("/ws/bmp")
    async def websocket_bmp(websocket: WebSocket):
        """
        WebSocket endpoint that proxies BMP data from the monitoring service.
        Clients connect here instead of directly to the BMP service.
        """
        await bmp_manager.connect(websocket)

        # Start relay task if not already running
        if bmp_manager.relay_task is None or bmp_manager.relay_task.done():
            # Discover BMP WebSocket URL
            base_host = os.getenv("PUBLIC_HOST", "localhost")
            monitoring_info = discover_monitoring_services_func(client, base_host)

            if monitoring_info and monitoring_info.get("url"):
                # Use internal Docker network URL for container-to-container communication
                bmp_ws_url = "ws://netstream-monitoring:5002/bmp/ws"
                logger.info(f"Starting BMP relay from {bmp_ws_url}")
                bmp_manager.relay_task = asyncio.create_task(bmp_manager.relay_from_source(bmp_ws_url))
            else:
                logger.error("Could not discover BMP monitoring service")

        try:
            # Keep connection alive and handle disconnection
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            bmp_manager.disconnect(websocket)
            logger.info("BMP WebSocket client disconnected")

    @app.websocket("/ws/netflow")
    async def websocket_netflow(websocket: WebSocket):
        """
        WebSocket endpoint that proxies NetFlow NOTIFICATIONS from the monitoring service.
        Clients connect here to receive trigger_event notifications for the toast UI.
        """
        await netflow_manager.connect(websocket)

        # Start relay task if not already running
        if netflow_manager.relay_task is None or netflow_manager.relay_task.done():
            # Discover NetFlow WebSocket URL
            base_host = os.getenv("PUBLIC_HOST", "localhost")
            monitoring_info = discover_monitoring_services_func(client, base_host)

            if monitoring_info and monitoring_info.get("url"):
                # Use internal Docker network URL for container-to-container communication
                # Connect to /netflow/ws/notifications for trigger event notifications (NOT /ws/flows)
                netflow_ws_url = "ws://netstream-monitoring:5002/netflow/ws/notifications"
                logger.info(f"Starting NetFlow notification relay from {netflow_ws_url}")
                netflow_manager.relay_task = asyncio.create_task(netflow_manager.relay_from_source(netflow_ws_url))
            else:
                logger.error("Could not discover NetFlow monitoring service")

        try:
            # Keep connection alive and handle disconnection
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            netflow_manager.disconnect(websocket)
            logger.info("NetFlow WebSocket client disconnected")

    @app.websocket("/ws/netflow/flows")
    async def websocket_netflow_flows(websocket: WebSocket):
        """
        WebSocket endpoint that proxies raw NetFlow data from the monitoring service.
        Clients connect here to receive real-time flow data for Top Talkers, etc.
        """
        await netflow_flows_manager.connect(websocket)

        # Start relay task if not already running
        if netflow_flows_manager.relay_task is None or netflow_flows_manager.relay_task.done():
            # Discover NetFlow WebSocket URL
            base_host = os.getenv("PUBLIC_HOST", "localhost")
            monitoring_info = discover_monitoring_services_func(client, base_host)

            if monitoring_info and monitoring_info.get("url"):
                # Use internal Docker network URL for container-to-container communication
                # Connect to /netflow/ws/flows for raw flow data
                netflow_flows_ws_url = "ws://netstream-monitoring:5002/netflow/ws/flows"
                logger.info(f"Starting NetFlow flows relay from {netflow_flows_ws_url}")
                netflow_flows_manager.relay_task = asyncio.create_task(netflow_flows_manager.relay_from_source(netflow_flows_ws_url))
            else:
                logger.error("Could not discover NetFlow monitoring service for flows")

        try:
            # Keep connection alive and handle disconnection
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            netflow_flows_manager.disconnect(websocket)
            logger.info("NetFlow flows WebSocket client disconnected")

    @app.websocket("/tools/ws/start")
    async def proxy_tools_start(websocket: WebSocket, host_name: str):
        """
        Proxy WebSocket endpoint for starting network tests on a specific host.
        Client connects here with host_name query param, and we proxy to that host's /tools/ws/start
        """
        await websocket.accept()

        try:
            # Get host information
            hosts = container_manager.list_hosts()
            target_host = next((h for h in hosts if h['name'] == host_name), None)

            if not target_host or target_host['status'] != 'running':
                await websocket.send_json({"error": f"Host '{host_name}' not found or not running"})
                await websocket.close()
                return

            # Connect to the target host's WebSocket using container name
            # Docker DNS will resolve the container name to its IP
            target_url = f"ws://{host_name}:8000/tools/ws/start"
            logger.info(f"Proxying tools/ws/start to {target_url}")

            async with websockets.connect(target_url) as target_ws:
                # Bidirectional proxy
                async def forward_to_target():
                    try:
                        while True:
                            data = await websocket.receive_text()
                            await target_ws.send(data)
                    except Exception as e:
                        logger.debug(f"Forward to target ended: {e}")

                async def forward_to_client():
                    try:
                        async for message in target_ws:
                            await websocket.send_text(message)
                    except Exception as e:
                        logger.debug(f"Forward to client ended: {e}")

                # Run both directions concurrently
                await asyncio.gather(
                    forward_to_target(),
                    forward_to_client(),
                    return_exceptions=True
                )

        except Exception as e:
            logger.error(f"Error in tools/ws/start proxy: {e}")
            try:
                await websocket.send_json({"error": str(e)})
            except:
                pass
        finally:
            try:
                await websocket.close()
            except:
                pass

    @app.websocket("/tools/ws/active")
    async def proxy_tools_active(websocket: WebSocket, host_name: str):
        """
        Proxy WebSocket endpoint for monitoring active tests on a specific host.
        """
        await websocket.accept()

        try:
            # Get host information
            hosts = container_manager.list_hosts()
            target_host = next((h for h in hosts if h['name'] == host_name), None)

            if not target_host or target_host['status'] != 'running':
                await websocket.send_json({"error": f"Host '{host_name}' not found or not running"})
                await websocket.close()
                return

            # Connect using container name - Docker DNS will resolve it
            target_url = f"ws://{host_name}:8000/tools/ws/active"
            logger.info(f"Proxying tools/ws/active to {target_url}")

            async with websockets.connect(target_url) as target_ws:
                # Bidirectional proxy
                async def forward_to_target():
                    try:
                        while True:
                            data = await websocket.receive_text()
                            await target_ws.send(data)
                    except:
                        pass

                async def forward_to_client():
                    try:
                        async for message in target_ws:
                            await websocket.send_text(message)
                    except:
                        pass

                await asyncio.gather(
                    forward_to_target(),
                    forward_to_client(),
                    return_exceptions=True
                )

        except Exception as e:
            logger.error(f"Error in tools/ws/active proxy: {e}")
        finally:
            try:
                await websocket.close()
            except:
                pass

    @app.websocket("/tools/ws/view/{test_id}")
    async def proxy_tools_view(websocket: WebSocket, test_id: str, host_name: str):
        """
        Proxy WebSocket endpoint for viewing output of a specific test.
        """
        await websocket.accept()

        try:
            # Get host information
            hosts = container_manager.list_hosts()
            target_host = next((h for h in hosts if h['name'] == host_name), None)

            if not target_host or target_host['status'] != 'running':
                await websocket.send_json({"error": f"Host '{host_name}' not found or not running"})
                await websocket.close()
                return

            # Connect using container name - Docker DNS will resolve it
            target_url = f"ws://{host_name}:8000/tools/ws/view/{test_id}"
            logger.info(f"Proxying tools/ws/view to {target_url}")

            async with websockets.connect(target_url) as target_ws:
                # Forward messages bidirectionally
                async def forward_to_target():
                    try:
                        while True:
                            data = await websocket.receive_text()
                            await target_ws.send(data)
                    except:
                        pass

                async def forward_to_client():
                    try:
                        async for message in target_ws:
                            await websocket.send_text(message)
                    except:
                        pass

                await asyncio.gather(
                    forward_to_target(),
                    forward_to_client(),
                    return_exceptions=True
                )

        except Exception as e:
            logger.error(f"Error in tools/ws/view proxy: {e}")
        finally:
            try:
                await websocket.close()
            except:
                pass

    @app.websocket("/tools/ws/stop/{test_id}")
    async def proxy_tools_stop(websocket: WebSocket, test_id: str, host_name: str):
        """
        Proxy WebSocket endpoint for stopping a specific test.
        """
        await websocket.accept()

        try:
            # Get host information
            hosts = container_manager.list_hosts()
            target_host = next((h for h in hosts if h['name'] == host_name), None)

            if not target_host or target_host['status'] != 'running':
                await websocket.send_json({"error": f"Host '{host_name}' not found or not running"})
                await websocket.close()
                return

            # Connect using container name - Docker DNS will resolve it
            target_url = f"ws://{host_name}:8000/tools/ws/stop/{test_id}"
            logger.info(f"Proxying tools/ws/stop to {target_url}")

            async with websockets.connect(target_url) as target_ws:
                # Forward messages bidirectionally
                async def forward_to_target():
                    try:
                        while True:
                            data = await websocket.receive_text()
                            await target_ws.send(data)
                    except:
                        pass

                async def forward_to_client():
                    try:
                        async for message in target_ws:
                            await websocket.send_text(message)
                    except:
                        pass

                await asyncio.gather(
                    forward_to_target(),
                    forward_to_client(),
                    return_exceptions=True
                )

        except Exception as e:
            logger.error(f"Error in tools/ws/stop proxy: {e}")
        finally:
            try:
                await websocket.close()
            except:
                pass
