"""
Sync Manager - Syncs Docker container state to Database
"""
from fastapi import HTTPException
from typing import Dict
import docker
import logging
from .base import BaseManager

logger = logging.getLogger("container-manager")


class SyncManager(BaseManager):
    """Manages synchronization between Docker containers and database"""

    # ============================================================================
    # Sync Methods - Read from Docker and Write to Database
    # ============================================================================

    def sync_daemon_to_db(self, daemon_name: str, topology_name: str = "default") -> Dict:
        """
        Read a daemon's configuration from Docker and save/update it in the database.
        Also syncs its network associations.
        """
        try:
            logger.info(f"[SyncManager] Syncing daemon '{daemon_name}' to database...")

            # Get the container
            try:
                container = self.client.containers.get(daemon_name)
            except docker.errors.NotFound:
                raise HTTPException(status_code=404, detail=f"Daemon container '{daemon_name}' not found")

            # Check if it's a daemon container
            labels = container.labels
            if labels.get("netstream.type") != "daemon":
                raise HTTPException(status_code=400, detail=f"Container '{daemon_name}' is not a daemon")

            # Extract daemon info from labels
            daemon_type = labels.get("netstream.daemon_type", "")
            asn = int(labels.get("netstream.asn", "0"))
            router_id = labels.get("netstream.router_id", "")

            # Get API port from labels
            api_port = int(labels.get("netstream.api_port", "0"))

            # Get management IP (from netstream_lab_builder_network)
            ip_address = self.get_public_host()  # Dynamic host for browser access
            networks = container.attrs.get('NetworkSettings', {}).get('Networks', {})
            if 'netstream_lab_builder_network' in networks:
                # For internal Docker network, use the actual container IP
                internal_ip = networks['netstream_lab_builder_network'].get('IPAddress')
                if internal_ip:
                    ip_address = internal_ip

            # Get Docker ID and image
            docker_id = container.id[:12]
            docker_image = container.image.tags[0] if container.image.tags else "unknown"

            # Save daemon to database
            self.db.create_daemon(
                name=daemon_name,
                daemon_type=daemon_type,
                asn=asn,
                router_id=router_id,
                ip_address=ip_address,
                api_port=api_port,
                location="Local",
                docker_id=docker_id,
                docker_image=docker_image,
                topology_name=topology_name
            )

            # Update status
            self.db.update_daemon_status(daemon_name, container.status)

            # Sync network associations
            network_count = 0
            for network_name, network_info in networks.items():
                # Skip management networks
                if network_name in ["bridge", "netstream_lab_builder_network"]:
                    continue

                # Get primary IP
                ipv4_address = network_info.get('IPAddress', '')
                if not ipv4_address:
                    continue

                # Save network-daemon association
                self.db.add_daemon_network(
                    daemon_name=daemon_name,
                    network_name=network_name,
                    ipv4_address=ipv4_address
                )
                network_count += 1

            logger.info(f"[SyncManager] Synced daemon '{daemon_name}' with {network_count} networks to database")

            return {
                "status": "success",
                "daemon": daemon_name,
                "topology": topology_name,
                "networks_synced": network_count,
                "daemon_info": {
                    "type": daemon_type,
                    "asn": asn,
                    "router_id": router_id,
                    "ip_address": ip_address,
                    "api_port": api_port
                }
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[SyncManager] Failed to sync daemon '{daemon_name}': {e}")
            raise HTTPException(status_code=500, detail=f"Failed to sync daemon: {str(e)}")

    def sync_host_to_db(self, host_name: str, topology_name: str = "default") -> Dict:
        """
        Read a host's configuration from Docker and save/update it in the database.
        """
        try:
            logger.info(f"[SyncManager] Syncing host '{host_name}' to database...")

            # Get the container
            try:
                container = self.client.containers.get(host_name)
            except docker.errors.NotFound:
                raise HTTPException(status_code=404, detail=f"Host container '{host_name}' not found")

            # Check if it's a host container
            labels = container.labels
            if labels.get("netstream.type") != "host":
                raise HTTPException(status_code=400, detail=f"Container '{host_name}' is not a host")

            # Extract host info from labels
            gateway_daemon = labels.get("netstream.gateway_daemon", "")
            loopback_ip = labels.get("netstream.loopback_ip", "")
            loopback_network = labels.get("netstream.loopback_network", "24")

            # Get container IP and gateway IP from networks
            networks = container.attrs.get('NetworkSettings', {}).get('Networks', {})

            # Get management IP
            container_ip = ""
            if 'netstream_lab_builder_network' in networks:
                container_ip = networks['netstream_lab_builder_network'].get('IPAddress', '')

            # Determine gateway IP by finding the host's data network
            # The gateway IP is the daemon's IP on the same network as the host
            gateway_ip = container_ip  # Default to mgmt IP

            # Look for data networks (not bridge, not mgmt)
            for network_name, network_info in networks.items():
                if network_name in ["bridge", "netstream_lab_builder_network"]:
                    continue

                # This is a data network - get the gateway from it
                host_ip = network_info.get('IPAddress', '')
                if host_ip:
                    # Extract network portion (e.g., "10.0.1.2" -> "10.0.1")
                    ip_parts = host_ip.split('.')
                    if len(ip_parts) == 4:
                        # Common gateway patterns: .1 for network gateway, .3 for daemon
                        # We'll query the daemon to find its IP on this network
                        try:
                            daemon_container = self.client.containers.get(gateway_daemon)
                            daemon_networks = daemon_container.attrs.get('NetworkSettings', {}).get('Networks', {})
                            if network_name in daemon_networks:
                                gateway_ip = daemon_networks[network_name].get('IPAddress', gateway_ip)
                                break
                        except:
                            pass

            # Get Docker ID
            docker_id = container.id[:12]

            # Save host to database
            self.db.create_host(
                name=host_name,
                gateway_daemon=gateway_daemon,
                gateway_ip=gateway_ip,
                container_ip=container_ip,
                loopback_ip=loopback_ip,
                loopback_network=loopback_network,
                docker_id=docker_id,
                topology_name=topology_name
            )

            # Update status
            self.db.update_host_status(host_name, container.status)

            # Sync network associations
            network_count = 0
            for network_name, network_info in networks.items():
                # Get primary IP
                ipv4_address = network_info.get('IPAddress', '')
                if not ipv4_address:
                    continue

                # Save network-host association
                self.db.add_host_network(
                    host_name=host_name,
                    network_name=network_name,
                    ipv4_address=ipv4_address
                )
                network_count += 1

            logger.info(f"[SyncManager] Synced host '{host_name}' to database with {network_count} networks")

            return {
                "status": "success",
                "host": host_name,
                "topology": topology_name,
                "networks_synced": network_count,
                "host_info": {
                    "gateway_daemon": gateway_daemon,
                    "gateway_ip": gateway_ip,
                    "container_ip": container_ip,
                    "loopback_ip": loopback_ip
                }
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[SyncManager] Failed to sync host '{host_name}': {e}")
            raise HTTPException(status_code=500, detail=f"Failed to sync host: {str(e)}")

    def sync_all_daemons(self, topology_name: str = "default") -> Dict:
        """
        Sync all running daemon containers to the database.
        """
        try:
            logger.info(f"[SyncManager] Syncing all daemons to database (topology: {topology_name})...")

            # Get all daemon containers
            containers = self.client.containers.list(
                all=True,
                filters={"label": "netstream.type=daemon"}
            )

            synced = []
            errors = []

            for container in containers:
                try:
                    result = self.sync_daemon_to_db(container.name, topology_name)
                    synced.append(result)
                except Exception as e:
                    error_msg = f"Failed to sync daemon '{container.name}': {str(e)}"
                    logger.error(error_msg)
                    errors.append(error_msg)

            logger.info(f"[SyncManager] Synced {len(synced)} daemons to database")

            return {
                "status": "success" if not errors else "partial",
                "topology": topology_name,
                "daemons_synced": len(synced),
                "daemons": synced,
                "errors": errors
            }

        except Exception as e:
            logger.error(f"[SyncManager] Failed to sync all daemons: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to sync daemons: {str(e)}")

    def sync_all_hosts(self, topology_name: str = "default") -> Dict:
        """
        Sync all running host containers to the database.
        """
        try:
            logger.info(f"[SyncManager] Syncing all hosts to database (topology: {topology_name})...")

            # Get all host containers
            containers = self.client.containers.list(
                all=True,
                filters={"label": "netstream.type=host"}
            )

            synced = []
            errors = []

            for container in containers:
                try:
                    result = self.sync_host_to_db(container.name, topology_name)
                    synced.append(result)
                except Exception as e:
                    error_msg = f"Failed to sync host '{container.name}': {str(e)}"
                    logger.error(error_msg)
                    errors.append(error_msg)

            logger.info(f"[SyncManager] Synced {len(synced)} hosts to database")

            return {
                "status": "success" if not errors else "partial",
                "topology": topology_name,
                "hosts_synced": len(synced),
                "hosts": synced,
                "errors": errors
            }

        except Exception as e:
            logger.error(f"[SyncManager] Failed to sync all hosts: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to sync hosts: {str(e)}")
