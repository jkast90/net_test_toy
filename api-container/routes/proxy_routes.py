"""
Container Proxy Routes
Proxies requests to daemon/host containers
"""
from fastapi import Request, HTTPException
from fastapi.responses import Response
import httpx
import logging


logger = logging.getLogger(__name__)


def setup_proxy_routes(app, http_client, get_config_func):
    """Setup proxy routes with HTTP client and config function dependencies"""

    @app.api_route("/proxy/monitoring/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
    async def proxy_to_monitoring(
        path: str,
        request: Request
    ):
        """
        Proxy endpoint that forwards requests to the monitoring service.
        Route format: /proxy/monitoring/{original_path}

        Example:
          UI calls: http://localhost:5010/proxy/monitoring/triggered_events
          Container Manager finds monitoring URL from config
          Container Manager proxies to: http://localhost:5002/triggered_events
        """
        try:
            # Get container info from our config
            config_data = get_config_func(request)

            # Get monitoring URL from config
            monitoring_url = config_data.get("monitoring", {}).get("url")

            if not monitoring_url:
                raise HTTPException(
                    status_code=404,
                    detail="Monitoring service not configured. Please ensure the monitoring container is running."
                )

            # Remove trailing slash from monitoring_url if present
            monitoring_url = monitoring_url.rstrip('/')

            # Build the target URL
            target_url = f"{monitoring_url}/{path}"
            if request.url.query:
                target_url += f"?{request.url.query}"

            logger.info(f"[MonitoringProxy] Proxying {request.method} /monitoring/{path} -> {target_url}")

            # Get request body if present
            body = await request.body() if request.method in ["POST", "PUT", "PATCH"] else None

            # Forward the request
            response = await http_client.request(
                method=request.method,
                url=target_url,
                content=body,
                headers={k: v for k, v in request.headers.items() if k.lower() not in ["host", "content-length"]},
            )

            # Return the response
            return Response(
                content=response.content,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.headers.get("content-type")
            )

        except httpx.HTTPError as e:
            logger.error(f"[MonitoringProxy] HTTP error proxying to monitoring: {e}")
            raise HTTPException(status_code=502, detail=f"Failed to proxy request to monitoring service: {str(e)}")
        except Exception as e:
            logger.error(f"[MonitoringProxy] Error proxying to monitoring: {e}")
            raise HTTPException(status_code=500, detail=f"Proxy error: {str(e)}")

    @app.api_route("/proxy/{container_name}/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
    async def proxy_to_container(
        container_name: str,
        path: str,
        request: Request
    ):
        """
        Proxy endpoint that forwards requests to daemon/host containers managed by this Container Manager.
        Route format: /proxy/{container_name}/{original_path}

        Example:
          UI calls: http://localhost:5010/proxy/gobgp1/bgp/peers
          Container Manager finds gobgp1's URL from its config
          Container Manager proxies to: http://localhost:50001/bgp/peers

        This allows the UI to connect only to the Container Manager,
        and the Container Manager handles all daemon/host communication.
        """
        try:
            # Get container info from our config
            config_data = get_config_func(request)

            container_found = False

            # Check daemons first
            for daemon in config_data.get("daemons", []):
                if daemon["name"] == container_name:
                    container_found = True
                    break

            # If not found in daemons, check hosts
            if not container_found:
                for host in config_data.get("hosts", []):
                    if host["name"] == container_name:
                        container_found = True
                        break

            if not container_found:
                raise HTTPException(
                    status_code=404,
                    detail=f"Container '{container_name}' not found in this topology. Available containers: {[d['name'] for d in config_data.get('daemons', [])] + [h['name'] for h in config_data.get('hosts', [])]}"
                )

            # Use Docker internal networking directly - container name resolves via Docker DNS
            # This is more reliable than trying to route through host.docker.internal
            # All daemon/host containers run the unified API on port 5000
            container_url = f"http://{container_name}:5000"

            # Build the target URL
            target_url = f"{container_url}/{path}"
            if request.url.query:
                target_url += f"?{request.url.query}"

            logger.info(f"[ContainerProxy] Proxying {request.method} {container_name}/{path} -> {target_url}")

            # Get request body if present
            body = await request.body() if request.method in ["POST", "PUT", "PATCH"] else None

            # Forward the request
            response = await http_client.request(
                method=request.method,
                url=target_url,
                content=body,
                headers={k: v for k, v in request.headers.items() if k.lower() not in ["host", "content-length"]},
            )

            # Return the response
            return Response(
                content=response.content,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.headers.get("content-type")
            )

        except httpx.HTTPError as e:
            logger.error(f"[ContainerProxy] HTTP error proxying to {container_name}: {e}")
            raise HTTPException(status_code=502, detail=f"Failed to proxy request to container: {str(e)}")
        except Exception as e:
            logger.error(f"[ContainerProxy] Error proxying to {container_name}: {e}")
            raise HTTPException(status_code=500, detail=f"Proxy error: {str(e)}")
