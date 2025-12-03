"""
Host Manager - Manages virtual host containers behind BGP daemons
"""
import docker
import logging
from typing import List, Dict, Optional
from fastapi import HTTPException

logger = logging.getLogger("host-manager")


class HostManager:
    """Manages virtual hosts that simulate networks behind BGP routers"""

    def __init__(self):
        try:
            self.client = docker.from_env()
            logger.info("[HostManager] Docker client initialized")
        except Exception as e:
            logger.error(f"[HostManager] Failed to initialize Docker client: {e}")
            raise

    def list_hosts(self) -> List[Dict]:
        """List all BGP lab hosts"""
        try:
            containers = self.client.containers.list(
                all=True,
                filters={"label": "netstream.type=host"}
            )

            hosts = []
            for container in containers:
                labels = container.labels
                hosts.append({
                    "id": container.id[:12],
                    "name": container.name,
                    "status": container.status,
                    "gateway": labels.get("netstream.gateway", ""),
                    "gateway_daemon": labels.get("netstream.gateway_daemon", ""),
                    "loopback_ip": labels.get("netstream.loopback_ip", ""),
                    "loopback_network": labels.get("netstream.loopback_network", ""),
                    "container_ip": labels.get("netstream.container_ip", ""),
                    "created": container.attrs.get("Created", "")
                })

            return hosts
        except Exception as e:
            logger.error(f"[HostManager] Failed to list hosts: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to list hosts: {str(e)}")

    def create_host(
        self,
        name: str,
        gateway_ip: str,
        gateway_daemon: str,
        container_ip: str,
        loopback_ip: str,
        loopback_network: str = "24",
        network: str = "netstream_lab_builder_network"
    ) -> Dict:
        """
        Create a new virtual host container

        Args:
            name: Host container name
            gateway_ip: IP of the BGP daemon (default gateway)
            gateway_daemon: Name of the gateway daemon
            container_ip: IP address for the host container
            loopback_ip: IP to assign to loopback (simulates network behind host)
            loopback_network: CIDR prefix length for loopback (default: 24)
            network: Docker network to attach to
        """
        try:
            # Check if container already exists
            try:
                existing = self.client.containers.get(name)
                raise HTTPException(
                    status_code=409,
                    detail=f"Host '{name}' already exists"
                )
            except docker.errors.NotFound:
                pass

            # Create the container
            command = f"""
            sh -c '
            ip addr add {loopback_ip}/{loopback_network} dev lo &&
            ip route del default || true &&
            ip route add default via {gateway_ip} &&
            ping -c 1 {gateway_ip} &&
            tail -f /dev/null
            '
            """

            container = self.client.containers.create(
                image="bullseye-base",
                name=name,
                command=command,
                detach=True,
                cap_add=["NET_ADMIN"],
                labels={
                    "netstream.type": "host",
                    "netstream.gateway": gateway_ip,
                    "netstream.gateway_daemon": gateway_daemon,
                    "netstream.loopback_ip": loopback_ip,
                    "netstream.loopback_network": loopback_network,
                    "netstream.container_ip": container_ip
                },
                network=network
            )

            # Connect to network with specific IP
            network_obj = self.client.networks.get(network)
            network_obj.connect(container, ipv4_address=container_ip)

            # Start the container
            container.start()

            logger.info(f"[HostManager] Created host '{name}' with loopback {loopback_ip}/{loopback_network}, gateway {gateway_ip}")

            return {
                "id": container.id[:12],
                "name": name,
                "status": "created",
                "gateway": gateway_ip,
                "gateway_daemon": gateway_daemon,
                "loopback_ip": loopback_ip,
                "loopback_network": loopback_network,
                "container_ip": container_ip
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[HostManager] Failed to create host: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to create host: {str(e)}")

    def delete_host(self, name: str) -> Dict:
        """Delete a virtual host"""
        try:
            container = self.client.containers.get(name)

            # Verify it's a netstream host
            if container.labels.get("netstream.type") != "host":
                raise HTTPException(
                    status_code=400,
                    detail=f"Container '{name}' is not a netstream host"
                )

            # Stop and remove
            if container.status == "running":
                container.stop(timeout=5)
            container.remove()

            logger.info(f"[HostManager] Deleted host '{name}'")

            return {
                "message": f"Host '{name}' deleted successfully"
            }

        except docker.errors.NotFound:
            raise HTTPException(status_code=404, detail=f"Host '{name}' not found")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[HostManager] Failed to delete host: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to delete host: {str(e)}")

    def get_host(self, name: str) -> Dict:
        """Get detailed information about a host"""
        try:
            container = self.client.containers.get(name)

            if container.labels.get("netstream.type") != "host":
                raise HTTPException(
                    status_code=400,
                    detail=f"Container '{name}' is not a netstream host"
                )

            labels = container.labels

            return {
                "id": container.id[:12],
                "name": container.name,
                "status": container.status,
                "gateway": labels.get("netstream.gateway", ""),
                "gateway_daemon": labels.get("netstream.gateway_daemon", ""),
                "loopback_ip": labels.get("netstream.loopback_ip", ""),
                "loopback_network": labels.get("netstream.loopback_network", ""),
                "container_ip": labels.get("netstream.container_ip", ""),
                "created": container.attrs.get("Created", ""),
                "image": container.image.tags[0] if container.image.tags else ""
            }

        except docker.errors.NotFound:
            raise HTTPException(status_code=404, detail=f"Host '{name}' not found")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[HostManager] Failed to get host: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to get host: {str(e)}")
