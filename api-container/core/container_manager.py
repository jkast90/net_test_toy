"""
Container Manager - Facade for all container management operations
This is a thin facade that delegates to specialized manager classes.
"""
from typing import List, Dict, Optional, Any
import docker
import logging
from .database import Database
from ..managers import (
    DaemonManager,
    HostManager,
    NetworkManager,
    TunnelManager,
    IPsecManager,
    TopologyManager,
    SyncManager,
    ContainerUtils
)

logger = logging.getLogger("container-api")


class ContainerManager:
    """
    Facade class that delegates to specialized managers.
    Maintains backward compatibility with the original monolithic class.
    """

    def __init__(self):
        try:
            # Initialize shared resources
            self.client = docker.from_env()
            self.db = Database()
            self.dynamic_compose_path = "/app/docker-compose.dynamic.yml"

            # Initialize all specialized managers with shared resources
            self.daemon_manager = DaemonManager(self.client, self.db)
            self.host_manager = HostManager(self.client, self.db)
            self.network_manager = NetworkManager(self.client, self.db)
            self.tunnel_manager = TunnelManager(self.client, self.db)
            self.ipsec_manager = IPsecManager(self.client, self.db)
            # TopologyManager needs access to daemon_manager, host_manager, and ipsec_manager
            self.topology_manager = TopologyManager(
                self.client, self.db,
                daemon_manager=self.daemon_manager,
                host_manager=self.host_manager,
                ipsec_manager=self.ipsec_manager
            )
            self.sync_manager = SyncManager(self.client, self.db)
            self.utils = ContainerUtils(self.client, self.db)

            logger.info("[ContainerManager] Initialized with modular architecture")
            logger.info("[ContainerManager] Docker client initialized")
            logger.info("[ContainerManager] Database initialized")
        except Exception as e:
            logger.error(f"[ContainerManager] Failed to initialize: {e}")
            raise

    # ============================================================================
    # Daemon Container Management - Delegated to DaemonManager
    # ============================================================================

    def list_daemons(self) -> List[Dict]:
        """List all BGP daemon containers"""
        return self.daemon_manager.list_daemons()

    def create_daemon(
        self,
        daemon_type: str,
        name: str,
        asn: int,
        router_id: str,
        ip_address: str,
        api_port: int,
        network: str = "netstream_lab_builder_network"
    ) -> Dict:
        """Create a new BGP daemon container"""
        return self.daemon_manager.create_daemon(
            daemon_type, name, asn, router_id, ip_address, api_port, network
        )

    def delete_daemon(self, name: str) -> Dict:
        """Delete a daemon container"""
        return self.daemon_manager.delete_daemon(name)

    def update_daemon(
        self,
        name: str,
        asn: int = None,
        router_id: str = None,
        ip_address: str = None
    ) -> Dict:
        """Update daemon configuration"""
        return self.daemon_manager.update_daemon(
            name, asn, router_id, ip_address
        )

    def start_daemon(self, name: str) -> Dict:
        """Start a stopped daemon container"""
        return self.daemon_manager.start_daemon(name)

    def stop_daemon(self, name: str) -> Dict:
        """Stop a running daemon container"""
        return self.daemon_manager.stop_daemon(name)

    def reset_daemon_networking(self, name: str) -> Dict:
        """Reset daemon's networking configuration from database"""
        return self.daemon_manager.reset_networking(name)

    def configure_bmp_on_daemon(self, daemon_name: str, bmp_address: str, bmp_port: int) -> Dict:
        """Configure BMP on a daemon to send monitoring data to BMP server"""
        return self.daemon_manager.configure_bmp(daemon_name, bmp_address, bmp_port)

    def get_daemon_info(self, name: str) -> Optional[Dict]:
        """Get information about a specific daemon"""
        daemons = self.list_daemons()
        for daemon in daemons:
            if daemon.get("name") == name:
                return daemon
        return None

    def exec_in_container(self, container_name: str, command: str) -> Dict:
        """Execute a command in any container (daemon or host)"""
        try:
            container = self.client.containers.get(container_name)
            # Use shell=True for proper command execution
            result = container.exec_run(f"/bin/bash -c '{command}'", demux=False)

            # Handle the output - it's bytes when demux=False
            output = result.output.decode('utf-8') if result.output else ""

            return {
                "status": "success",
                "output": output,
                "error": "",
                "exit_code": result.exit_code
            }
        except docker.errors.NotFound:
            return {
                "status": "error",
                "error": f"Container {container_name} not found"
            }
        except Exception as e:
            return {
                "status": "error",
                "error": str(e)
            }

    # ============================================================================
    # Host Container Management - Delegated to HostManager
    # ============================================================================

    def list_hosts(self) -> List[Dict]:
        """List all host containers"""
        return self.host_manager.list_hosts()

    def create_host(
        self,
        name: str,
        gateway_daemon: str,
        gateway_ip: str,
        loopback_ip: str,
        loopback_network: str = "24",
        container_ip: str = None,
        network: str = "netstream_lab_builder_network",
        api_port: int = None,
        topology_name: str = None
    ) -> Dict:
        """Create a new host container with NetKnight API"""
        return self.host_manager.create_host(
            name, gateway_daemon, gateway_ip, loopback_ip, loopback_network,
            container_ip, network, api_port, self.utils.get_next_available_port,
            topology_name
        )

    def delete_host(self, name: str) -> Dict:
        """Delete a host container"""
        return self.host_manager.delete_host(name)

    def update_host(
        self,
        name: str,
        gateway_daemon: str = None,
        gateway_ip: str = None,
        loopback_ip: str = None,
        loopback_network: str = None,
        container_ip: str = None
    ) -> Dict:
        """Update host configuration"""
        return self.host_manager.update_host(
            name, gateway_daemon, gateway_ip, loopback_ip,
            loopback_network, container_ip
        )

    def start_host(self, name: str) -> Dict:
        """Start a stopped host container"""
        return self.host_manager.start_host(name)

    def stop_host(self, name: str) -> Dict:
        """Stop a running host container"""
        return self.host_manager.stop_host(name)

    def reset_host_networking(self, name: str) -> Dict:
        """Reset host's networking configuration from database"""
        return self.host_manager.reset_networking(name)

    def exec_command(self, name: str, command: str) -> Dict:
        """Execute a command in a host container"""
        return self.host_manager.exec_command(name, command)

    # ============================================================================
    # Network Management - Delegated to NetworkManager
    # ============================================================================

    def list_networks(self) -> list:
        """List all Docker networks"""
        return self.network_manager.list_networks()

    def create_network(self, name: str, subnet: str, gateway: str, driver: str = "bridge") -> Dict:
        """Create a new Docker network"""
        return self.network_manager.create_network(name, subnet, gateway, driver)

    def delete_network(self, name: str) -> Dict:
        """Delete a Docker network"""
        return self.network_manager.delete_network(name)

    def connect_container_to_network(self, container_name: str, network_name: str, ipv4_address: str = None) -> Dict:
        """Connect a container to a network"""
        return self.network_manager.connect_container_to_network(container_name, network_name, ipv4_address)

    def disconnect_container_from_network(self, container_name: str, network_name: str) -> Dict:
        """Disconnect a container from a network"""
        return self.network_manager.disconnect_container_from_network(container_name, network_name)

    def remove_ip_from_container(self, container_name: str, interface: str, ip_address: str) -> Dict:
        """Remove a specific IP address from a container's interface"""
        return self.network_manager.remove_ip_from_container(container_name, interface, ip_address)

    def add_ip_to_container(self, container_name: str, interface: str, ip_address: str) -> Dict:
        """Add an IP address to a container's interface"""
        return self.network_manager.add_ip_to_container(container_name, interface, ip_address)

    def get_container_networks(self, container_name: str) -> list:
        """Get list of networks a container is connected to"""
        return self.network_manager.get_container_networks(container_name)

    def add_ip_to_interface(self, container_name: str, network_name: str, ipv4_address: str, netmask: str = "24") -> Dict:
        """Add an IP to an interface that is already connected to a network"""
        return self.network_manager.add_ip_to_interface(container_name, network_name, ipv4_address, netmask)

    # ============================================================================
    # Utility Methods - Delegated to ContainerUtils
    # ============================================================================

    def get_next_available_ip(self, network: str = "netstream_lab_builder_network") -> str:
        """Get next available IP address in network"""
        return self.utils.get_next_available_ip(network)

    def get_next_available_port(self, start_port: int = 6000, end_port: int = 7000) -> int:
        """Get next available port"""
        return self.utils.get_next_available_port(start_port, end_port)

    def get_next_available_asn(self) -> int:
        """Get next available ASN"""
        return self.utils.get_next_available_asn()

    def get_next_available_router_id(self, network: str = "netstream_lab_builder_network") -> str:
        """Get next available router ID"""
        return self.utils.get_next_available_router_id(network)

    def restore_lab_from_db(self) -> Dict:
        """Restore lab from database"""
        return self.utils.restore_lab_from_db()

    def get_lab_topology(self) -> Dict:
        """Get lab topology"""
        return self.utils.get_lab_topology()

    def sync_daemons_to_db(self, topology_name: str = "default") -> Dict:
        """Sync daemons to database"""
        return self.utils.sync_daemons_to_db(topology_name)

    def sync_hosts_to_db(self) -> Dict:
        """Sync hosts to database"""
        return self.utils.sync_hosts_to_db()

    def sync_networks_to_db(self, topology_name: str = "default") -> Dict:
        """Sync networks to database"""
        return self.utils.sync_networks_to_db(topology_name)

    def add_bgp_peer_to_topology(self, local_daemon: str, peer_ip: str, peer_asn: int,
                                  topology_name: str = "default", peer_name: str = None,
                                  connection_type: str = "eBGP", connection_label: str = None,
                                  peer_router_id: str = None) -> Dict:
        """Add BGP peer to topology"""
        return self.utils.add_bgp_peer_to_topology(
            local_daemon, peer_ip, peer_asn, peer_router_id
        )

    # ============================================================================
    # Topology Management - Delegated to TopologyManager
    # ============================================================================

    def teardown_topology(self, topology_name: str) -> Dict:
        """Teardown a topology"""
        return self.topology_manager.teardown_topology(topology_name)

    def stop_topology(self, topology_name: str) -> Dict:
        """Stop a topology (stop containers but keep in topology)"""
        return self.topology_manager.stop_topology(topology_name)

    def standup_topology(self, topology_name: str) -> Dict:
        """Standup a topology"""
        return self.topology_manager.standup_topology(topology_name)

    def get_topology_details(self, topology_name: str) -> Dict:
        """Get topology details"""
        return self.topology_manager.get_topology_details(topology_name)

    # ============================================================================
    # GRE Tunnel Management - Delegated to TunnelManager
    # ============================================================================

    def create_gre_tunnel(self, container_name: str, tunnel_name: str, local_ip: str,
                         remote_ip: str, tunnel_ip: str, tunnel_network: str = "30",
                         gre_key: Optional[int] = None, ttl: int = 64,
                         topology_name: Optional[str] = None) -> Dict:
        """Create a GRE tunnel"""
        return self.tunnel_manager.create_gre_tunnel(
            container_name, tunnel_name, local_ip, remote_ip, tunnel_ip, tunnel_network, gre_key, ttl, topology_name
        )

    def delete_gre_tunnel(self, container_name: str, tunnel_name: str) -> Dict:
        """Delete a GRE tunnel"""
        return self.tunnel_manager.delete_gre_tunnel(container_name, tunnel_name)

    def list_gre_tunnels(self, container_name: Optional[str] = None) -> List[Dict]:
        """List GRE tunnels"""
        return self.tunnel_manager.list_gre_tunnels(container_name)

    def get_gre_tunnel_state(self, container_name: str, tunnel_name: str) -> Dict:
        """Get GRE tunnel state"""
        return self.tunnel_manager.get_gre_tunnel_state(container_name, tunnel_name)

    def test_gre_tunnel_connectivity(self, container_name: str, tunnel_name: str, remote_ip: Optional[str] = None) -> Dict:
        """Test GRE tunnel connectivity"""
        return self.tunnel_manager.test_gre_tunnel_connectivity(container_name, tunnel_name, remote_ip)

    def bring_tunnel_up(self, container_name: str, tunnel_name: str) -> Dict:
        """Bring tunnel up"""
        return self.tunnel_manager.bring_tunnel_up(container_name, tunnel_name)

    def diagnose_tunnel(self, container_name: str, tunnel_name: str) -> Dict:
        """Diagnose tunnel"""
        return self.tunnel_manager.diagnose_tunnel(container_name, tunnel_name)

    def fix_tunnel(self, container_name: str, tunnel_name: str, auto_fix: bool = True) -> Dict:
        """Fix tunnel"""
        return self.tunnel_manager.fix_tunnel(container_name, tunnel_name, auto_fix)

    def cleanup_stale_ips(self, network_name: Optional[str] = None) -> Dict:
        """Cleanup stale IPs"""
        return self.tunnel_manager.cleanup_stale_ips(network_name)

    def sync_topology_state(self, topology_name: str = "default", dry_run: bool = False) -> Dict:
        """Sync topology state"""
        return self.tunnel_manager.sync_topology_state(topology_name, dry_run)

    # ============================================================================
    # Sync Methods - Delegated to SyncManager
    # ============================================================================

    def sync_daemon_to_db(self, daemon_name: str, topology_name: str = "default") -> Dict:
        """Sync daemon to database"""
        return self.sync_manager.sync_daemon_to_db(daemon_name, topology_name)

    def sync_host_to_db(self, host_name: str, topology_name: str = "default") -> Dict:
        """Sync host to database"""
        return self.sync_manager.sync_host_to_db(host_name, topology_name)

    def sync_all_daemons(self, topology_name: str = "default") -> Dict:
        """Sync all daemons"""
        return self.sync_manager.sync_all_daemons(topology_name)

    def sync_all_hosts(self, topology_name: str = "default") -> Dict:
        """Sync all hosts"""
        return self.sync_manager.sync_all_hosts(topology_name)
