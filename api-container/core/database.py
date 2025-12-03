"""
Database module for NetStream container management
Refactored to use Repository pattern for better organization
"""
import logging
from typing import Optional, List, Dict, Any

from ..repositories.base_repository import BaseRepository
from ..repositories.schema_manager import SchemaManager
from ..repositories.topology_repository import TopologyRepository
from ..repositories.network_repository import NetworkRepository
from ..repositories.daemon_repository import DaemonRepository
from ..repositories.host_repository import HostRepository
from ..repositories.bgp_repository import BGPRepository
from ..repositories.gre_repository import GRERepository
from ..repositories.tap_repository import TapRepository
from ..repositories.node_repository import NodeRepository


logger = logging.getLogger(__name__)


class Database(BaseRepository):
    """
    Main database class that composes repository classes
    Provides unified interface for all database operations
    """

    def __init__(self, db_path: Optional[str] = None):
        """Initialize database with all repositories"""
        super().__init__(db_path)

        # Initialize schema
        schema_manager = SchemaManager(self.conn)
        schema_manager.create_tables()

        # Initialize repositories
        self.topology = TopologyRepository(self.conn)
        self._network_repo = NetworkRepository(self.conn, self.get_active_topology)
        self._daemon_repo = DaemonRepository(self.conn, self.get_active_topology)
        self._host_repo = HostRepository(self.conn, self.get_active_topology)
        self._bgp_repo = BGPRepository(self.conn, self.get_active_topology)
        self._gre_repo = GRERepository(self.conn, self.get_active_topology)
        self._tap_repo = TapRepository(self.conn)
        self._node_repo = NodeRepository(self.conn, self.get_active_topology)

    # ========================================================================
    # Topology Methods (delegated to TopologyRepository)
    # ========================================================================

    def create_topology(self, name: str, description: Optional[str] = None, active: bool = False,
                       management_network: Optional[str] = None) -> None:
        return self.topology.create(name, description, active, management_network)

    def list_topologies(self) -> List[Dict[str, Any]]:
        return self.topology.list_all()

    def get_topology(self, name: str) -> Optional[Dict[str, Any]]:
        return self.topology.get(name)

    def set_active_topology(self, name: str) -> None:
        return self.topology.set_active(name)

    def get_active_topology(self) -> Optional[Dict[str, Any]]:
        return self.topology.get_active()

    def delete_topology(self, name: str) -> None:
        return self.topology.delete(name)

    def get_and_increment_ip_counter(self, topology_name: str) -> int:
        return self.topology.get_and_increment_ip_counter(topology_name)

    # ========================================================================
    # Network Methods (delegated to NetworkRepository)
    # ========================================================================

    def create_network(self, name: str, subnet: str, gateway: str, driver: str = "bridge",
                       docker_id: Optional[str] = None, topology_name: Optional[str] = None,
                       external: bool = False, parent_interface: Optional[str] = None) -> None:
        return self._network_repo.create(name, subnet, gateway, driver, docker_id, topology_name, external, parent_interface)

    def get_network(self, name: str) -> Optional[Dict[str, Any]]:
        return self._network_repo.get(name)

    def list_networks(self, topology_name: Optional[str] = None) -> List[Dict[str, Any]]:
        return self._network_repo.list_all(topology_name)

    def update_network_position(self, name: str, x: float, y: float) -> None:
        return self._network_repo.update_position(name, x, y)

    def delete_network(self, name: str) -> None:
        return self._network_repo.delete(name)

    # ========================================================================
    # Daemon Methods (delegated to DaemonRepository)
    # ========================================================================

    def create_daemon(self, name: str, daemon_type: str, asn: int, router_id: str,
                     ip_address: str, api_port: int, location: str = "Local",
                     docker_id: Optional[str] = None, docker_image: Optional[str] = None,
                     topology_name: Optional[str] = None, color: Optional[str] = None) -> None:
        return self._daemon_repo.create(name, daemon_type, asn, router_id, ip_address,
                                        api_port, location, docker_id, docker_image,
                                        topology_name, color)

    def get_daemon(self, name: str) -> Optional[Dict[str, Any]]:
        return self._daemon_repo.get(name)

    def list_daemons(self, topology_name: Optional[str] = None) -> List[Dict[str, Any]]:
        return self._daemon_repo.list_all(topology_name)

    def update_daemon_status(self, name: str, status: str) -> None:
        return self._daemon_repo.update_status(name, status)

    def update_daemon_position(self, name: str, x: float, y: float) -> None:
        return self._daemon_repo.update_position(name, x, y)

    def update_daemon_properties(self, name: str, color: Optional[str] = None) -> None:
        return self._daemon_repo.update_properties(name, color)

    def delete_daemon(self, name: str) -> None:
        return self._daemon_repo.delete(name)

    def add_daemon_network(self, daemon_name: str, network_name: str,
                          ipv4_address: Optional[str] = None, interface_name: Optional[str] = None) -> None:
        return self._daemon_repo.add_network(daemon_name, network_name, ipv4_address, interface_name)

    def get_daemon_networks(self, daemon_name: str) -> List[Dict[str, Any]]:
        return self._daemon_repo.get_networks(daemon_name)

    def remove_daemon_network(self, daemon_name: str, network_name: str) -> None:
        return self._daemon_repo.remove_network(daemon_name, network_name)

    def list_daemon_networks(self, topology_name: Optional[str] = None) -> List[Dict[str, Any]]:
        return self._daemon_repo.list_networks(topology_name)

    # ========================================================================
    # Host Methods (delegated to HostRepository)
    # ========================================================================

    def create_host(self, name: str, gateway_daemon: str, gateway_ip: str,
                   container_ip: str, loopback_ip: str, loopback_network: str = "24",
                   docker_id: Optional[str] = None, topology_name: Optional[str] = None) -> None:
        return self._host_repo.create(name, gateway_daemon, gateway_ip, container_ip,
                                      loopback_ip, loopback_network, docker_id, topology_name)

    def get_host(self, name: str) -> Optional[Dict[str, Any]]:
        return self._host_repo.get(name)

    def list_hosts(self, topology_name: Optional[str] = None) -> List[Dict[str, Any]]:
        return self._host_repo.list_all(topology_name)

    def update_host_status(self, name: str, status: str) -> None:
        return self._host_repo.update_status(name, status)

    def update_host_position(self, name: str, x: float, y: float) -> None:
        return self._host_repo.update_position(name, x, y)

    def update_host(self, name: str, gateway_daemon: Optional[str] = None,
                   gateway_ip: Optional[str] = None, loopback_ip: Optional[str] = None,
                   loopback_network: Optional[str] = None, container_ip: Optional[str] = None) -> None:
        return self._host_repo.update(name, gateway_daemon, gateway_ip, loopback_ip,
                                      loopback_network, container_ip)

    def delete_host(self, name: str) -> None:
        return self._host_repo.delete(name)

    def add_host_network(self, host_name: str, network_name: str,
                        ipv4_address: Optional[str] = None, interface_name: Optional[str] = None) -> None:
        return self._host_repo.add_network(host_name, network_name, ipv4_address, interface_name)

    def get_host_networks(self, host_name: str) -> List[Dict[str, Any]]:
        return self._host_repo.get_networks(host_name)

    def get_host_interfaces(self, host_name: str) -> List[Dict[str, Any]]:
        return self._host_repo.get_interfaces(host_name)

    def remove_host_network(self, host_name: str, network_name: str) -> None:
        return self._host_repo.remove_network(host_name, network_name)

    # ========================================================================
    # BGP Methods (delegated to BGPRepository)
    # ========================================================================

    def create_bgp_peer(self, local_daemon: str, peer_ip: str, peer_asn: int,
                       local_asn: Optional[int] = None, local_ip: Optional[str] = None,
                       peer_router_id: Optional[str] = None,
                       address_families: Optional[str] = None,
                       auth_key: Optional[str] = None, description: Optional[str] = None) -> None:
        return self._bgp_repo.create_peer(local_daemon, peer_ip, peer_asn, local_asn, local_ip,
                                          peer_router_id, address_families, auth_key, description)

    def get_daemon_peers(self, daemon_name: str) -> List[Dict[str, Any]]:
        return self._bgp_repo.get_daemon_peers(daemon_name)

    def delete_bgp_peer(self, local_daemon: str, peer_ip: str) -> None:
        return self._bgp_repo.delete_peer(local_daemon, peer_ip)

    def create_bgp_route(self, local_daemon: str, prefix: str, next_hop: Optional[str] = None,
                        origin: str = "incomplete", local_pref: Optional[int] = None,
                        med: Optional[int] = None, communities: Optional[str] = None) -> None:
        return self._bgp_repo.create_route(local_daemon, prefix, next_hop, origin, local_pref, med, communities)

    def get_daemon_routes(self, daemon_name: str) -> List[Dict[str, Any]]:
        return self._bgp_repo.get_daemon_routes(daemon_name)

    # BGP Sessions
    def create_bgp_session(self, daemon1: str, daemon1_ip: str, daemon2: str, daemon2_ip: str,
                          daemon1_asn: Optional[int] = None, daemon2_asn: Optional[int] = None,
                          network: Optional[str] = None, address_families: str = "ipv4-unicast",
                          auth_key: Optional[str] = None, description: Optional[str] = None,
                          topology_name: Optional[str] = None) -> int:
        return self._bgp_repo.create_session(daemon1, daemon1_ip, daemon2, daemon2_ip,
                                             daemon1_asn, daemon2_asn, network, address_families,
                                             auth_key, description, topology_name)

    def get_bgp_session(self, session_id: int) -> Optional[Dict[str, Any]]:
        return self._bgp_repo.get_session(session_id)

    def list_bgp_sessions(self, topology_name: Optional[str] = None,
                         daemon_name: Optional[str] = None) -> List[Dict[str, Any]]:
        return self._bgp_repo.list_sessions(topology_name, daemon_name)

    def delete_bgp_session(self, session_id: int) -> None:
        return self._bgp_repo.delete_session(session_id)

    def delete_bgp_session_by_ips(self, daemon1_ip: str, daemon2_ip: str,
                                   topology_name: Optional[str] = None) -> None:
        return self._bgp_repo.delete_session_by_ips(daemon1_ip, daemon2_ip, topology_name)

    def delete_bgp_session_by_daemons(self, daemon1: str, daemon2: str,
                                      topology_name: Optional[str] = None) -> None:
        return self._bgp_repo.delete_session_by_daemons(daemon1, daemon2, topology_name)

    def update_bgp_session_arc(self, session_id: int, arc: float) -> bool:
        return self._bgp_repo.update_session_arc(session_id, arc)

    # ========================================================================
    # GRE Methods (delegated to GRERepository)
    # ========================================================================

    # GRE Links (new model)
    def create_gre_link(self, container1: str, container2: str, network: str,
                       tunnel_ip1: str, tunnel_ip2: str, tunnel_network: str = "30",
                       gre_key: Optional[int] = None, ttl: int = 64,
                       topology_name: Optional[str] = None) -> int:
        return self._gre_repo.create_link(container1, container2, network, tunnel_ip1, tunnel_ip2,
                                          tunnel_network, gre_key, ttl, topology_name)

    def get_gre_link(self, link_id: int) -> Optional[Dict[str, Any]]:
        return self._gre_repo.get_link(link_id)

    def list_gre_links(self, topology_name: Optional[str] = None,
                      container_name: Optional[str] = None) -> List[Dict[str, Any]]:
        return self._gre_repo.list_links(topology_name, container_name)

    def delete_gre_link(self, link_id: int) -> None:
        return self._gre_repo.delete_link(link_id)

    def delete_gre_link_by_containers(self, container1: str, container2: str,
                                      topology_name: Optional[str] = None) -> None:
        return self._gre_repo.delete_link_by_containers(container1, container2, topology_name)

    def update_gre_link_arc(self, link_id: int, arc: float) -> None:
        return self._gre_repo.update_link_arc(link_id, arc)

    # GRE Tunnels (legacy)
    def create_gre_tunnel(self, container_name: str, tunnel_name: str, local_ip: str,
                         remote_ip: str, tunnel_ip: str, tunnel_network: str = "30",
                         gre_key: Optional[int] = None, ttl: int = 64,
                         topology_name: Optional[str] = None) -> None:
        return self._gre_repo.create_tunnel(container_name, tunnel_name, local_ip, remote_ip,
                                            tunnel_ip, tunnel_network, gre_key, ttl, topology_name)

    def get_gre_tunnel(self, container_name: str, tunnel_name: str) -> Optional[Dict[str, Any]]:
        return self._gre_repo.get_tunnel(container_name, tunnel_name)

    def list_gre_tunnels(self, container_name: Optional[str] = None,
                        topology_name: Optional[str] = None) -> List[Dict[str, Any]]:
        return self._gre_repo.list_tunnels(container_name, topology_name)

    def delete_gre_tunnel(self, container_name: str, tunnel_name: str) -> None:
        return self._gre_repo.delete_tunnel(container_name, tunnel_name)

    # ========================================================================
    # Topology Tap Methods (delegated to TapRepository)
    # ========================================================================

    def create_topology_tap(self, tap_name: str, topology_name: str, container_name: str,
                           interface_name: str, collector_ip: str, collector_port: int = 2055,
                           netflow_version: int = 5) -> None:
        return self._tap_repo.create(tap_name, topology_name, container_name, interface_name,
                                     collector_ip, collector_port, netflow_version)

    def get_topology_tap(self, topology_name: str, container_name: str, interface_name: str) -> Optional[Dict[str, Any]]:
        return self._tap_repo.get(topology_name, container_name, interface_name)

    def list_topology_taps(self, topology_name: Optional[str] = None,
                          container_name: Optional[str] = None) -> List[Dict[str, Any]]:
        return self._tap_repo.list_all(topology_name, container_name)

    def delete_topology_tap(self, topology_name: str, container_name: str, interface_name: str) -> None:
        return self._tap_repo.delete(topology_name, container_name, interface_name)

    def update_topology_tap_status(self, topology_name: str, container_name: str,
                                   interface_name: str, status: str) -> None:
        return self._tap_repo.update_status(topology_name, container_name, interface_name, status)

    # ========================================================================
    # External Node Methods (delegated to NodeRepository)
    # ========================================================================

    def create_external_node(self, name: str, topology_name: str,
                           x: Optional[float] = None, y: Optional[float] = None) -> None:
        return self._node_repo.create_external(name, topology_name, x, y)

    def list_external_nodes(self, topology_name: Optional[str] = None) -> List[Dict[str, Any]]:
        return self._node_repo.list_external(topology_name)

    def update_external_node_position(self, name: str, topology_name: str, x: float, y: float) -> None:
        return self._node_repo.update_external_position(name, topology_name, x, y)

    def delete_external_node(self, name: str, topology_name: str) -> None:
        return self._node_repo.delete_external(name, topology_name)

    # ========================================================================
    # Unified Node Methods (delegated to NodeRepository)
    # ========================================================================

    def create_node(self, name: str, node_type: str, topology_name: Optional[str] = None,
                   docker_id: Optional[str] = None, status: str = "created",
                   map_x: Optional[float] = None, map_y: Optional[float] = None,
                   color: Optional[str] = None,
                   daemon_type: Optional[str] = None, asn: Optional[int] = None,
                   router_id: Optional[str] = None, ip_address: Optional[str] = None,
                   api_port: Optional[int] = None, location: str = "Local",
                   docker_image: Optional[str] = None,
                   gateway_node: Optional[str] = None, gateway_ip: Optional[str] = None,
                   container_ip: Optional[str] = None, loopback_ip: Optional[str] = None,
                   loopback_network: str = "24") -> None:
        return self._node_repo.create(name, node_type, topology_name, docker_id, status,
                                      map_x, map_y, color, daemon_type, asn, router_id,
                                      ip_address, api_port, location, docker_image,
                                      gateway_node, gateway_ip, container_ip, loopback_ip,
                                      loopback_network)

    def get_node(self, name: str, topology_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
        return self._node_repo.get(name, topology_name)

    def list_nodes(self, topology_name: Optional[str] = None,
                  node_type: Optional[str] = None) -> List[Dict[str, Any]]:
        return self._node_repo.list_all(topology_name, node_type)

    def update_node_status(self, name: str, status: str, topology_name: Optional[str] = None) -> None:
        return self._node_repo.update_status(name, status, topology_name)

    def update_node_position(self, name: str, x: float, y: float, topology_name: Optional[str] = None) -> None:
        return self._node_repo.update_position(name, x, y, topology_name)

    def update_node_properties(self, name: str, topology_name: Optional[str] = None,
                               color: Optional[str] = None) -> None:
        return self._node_repo.update_properties(name, topology_name, color)

    def delete_node(self, name: str, topology_name: Optional[str] = None) -> None:
        return self._node_repo.delete(name, topology_name)

    # Node Networks
    def add_node_network(self, node_name: str, network_name: str,
                        topology_name: Optional[str] = None,
                        ipv4_address: Optional[str] = None,
                        interface_name: Optional[str] = None) -> None:
        return self._node_repo.add_network(node_name, network_name, topology_name, ipv4_address, interface_name)

    def get_node_networks(self, node_name: str, topology_name: Optional[str] = None) -> List[Dict[str, Any]]:
        return self._node_repo.get_networks(node_name, topology_name)

    def remove_node_network(self, node_name: str, network_name: str,
                           topology_name: Optional[str] = None) -> None:
        return self._node_repo.remove_network(node_name, network_name, topology_name)
