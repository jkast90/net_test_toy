"""
BGP Repository
Handles BGP peers, sessions, and routes database operations
"""
import logging
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)


class BGPRepository:
    """Repository for BGP-related database operations"""

    def __init__(self, conn, get_active_topology_func):
        self.conn = conn
        self._get_active_topology = get_active_topology_func

    def _row_to_dict(self, row) -> Optional[Dict[str, Any]]:
        if row is None:
            return None
        return dict(row)

    def _rows_to_list(self, rows) -> List[Dict[str, Any]]:
        return [dict(row) for row in rows]

    # ==================== BGP Peers ====================

    def create_peer(self, local_daemon: str, peer_ip: str, peer_asn: int,
                    local_asn: Optional[int] = None, local_ip: Optional[str] = None,
                    peer_router_id: Optional[str] = None,
                    address_families: Optional[str] = None,
                    auth_key: Optional[str] = None, description: Optional[str] = None) -> None:
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO bgp_peers (local_daemon, peer_ip, peer_asn, local_asn, local_ip,
                                 peer_router_id, address_families, auth_key, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(local_daemon, peer_ip) DO UPDATE SET
                peer_asn = excluded.peer_asn,
                local_asn = excluded.local_asn,
                local_ip = excluded.local_ip,
                peer_router_id = excluded.peer_router_id,
                address_families = excluded.address_families,
                auth_key = excluded.auth_key,
                description = excluded.description
        """, (local_daemon, peer_ip, peer_asn, local_asn, local_ip, peer_router_id,
              address_families, auth_key, description))
        self.conn.commit()
        logger.info(f"BGP peer {peer_ip} added for daemon {local_daemon}")

    def get_daemon_peers(self, daemon_name: str) -> List[Dict[str, Any]]:
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM bgp_peers WHERE local_daemon = ?", (daemon_name,))
        return self._rows_to_list(cursor.fetchall())

    def delete_peer(self, local_daemon: str, peer_ip: str) -> None:
        cursor = self.conn.cursor()
        cursor.execute("DELETE FROM bgp_peers WHERE local_daemon = ? AND peer_ip = ?", (local_daemon, peer_ip))
        self.conn.commit()

    # ==================== BGP Routes ====================

    def create_route(self, local_daemon: str, prefix: str, next_hop: Optional[str] = None,
                     origin: str = "incomplete", local_pref: Optional[int] = None,
                     med: Optional[int] = None, communities: Optional[str] = None) -> None:
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO bgp_routes (local_daemon, prefix, next_hop, origin, local_pref, med, communities)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(local_daemon, prefix) DO UPDATE SET
                next_hop = excluded.next_hop,
                origin = excluded.origin,
                local_pref = excluded.local_pref,
                med = excluded.med,
                communities = excluded.communities
        """, (local_daemon, prefix, next_hop, origin, local_pref, med, communities))
        self.conn.commit()

    def get_daemon_routes(self, daemon_name: str) -> List[Dict[str, Any]]:
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM bgp_routes WHERE local_daemon = ?", (daemon_name,))
        return self._rows_to_list(cursor.fetchall())

    # ==================== BGP Sessions ====================

    def create_session(self, daemon1: str, daemon1_ip: str, daemon2: str, daemon2_ip: str,
                       daemon1_asn: Optional[int] = None, daemon2_asn: Optional[int] = None,
                       network: Optional[str] = None, address_families: str = "ipv4-unicast",
                       auth_key: Optional[str] = None, description: Optional[str] = None,
                       topology_name: Optional[str] = None) -> int:
        """Create a BGP session between two daemons. Returns session ID."""
        if topology_name is None:
            active_topo = self._get_active_topology()
            topology_name = active_topo["name"] if active_topo else "default"

        # Normalize order by IP
        if daemon1_ip > daemon2_ip:
            daemon1, daemon2 = daemon2, daemon1
            daemon1_ip, daemon2_ip = daemon2_ip, daemon1_ip
            daemon1_asn, daemon2_asn = daemon2_asn, daemon1_asn

        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO bgp_sessions (topology_name, daemon1, daemon1_asn, daemon1_ip, daemon2, daemon2_asn, daemon2_ip, network, address_families, auth_key, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(topology_name, daemon1_ip, daemon2_ip) DO UPDATE SET
                daemon1 = excluded.daemon1,
                daemon1_asn = excluded.daemon1_asn,
                daemon2 = excluded.daemon2,
                daemon2_asn = excluded.daemon2_asn,
                network = excluded.network,
                address_families = excluded.address_families,
                auth_key = excluded.auth_key,
                description = excluded.description
        """, (topology_name, daemon1, daemon1_asn, daemon1_ip, daemon2, daemon2_asn, daemon2_ip, network, address_families, auth_key, description))
        self.conn.commit()
        logger.info(f"BGP session created between {daemon1} ({daemon1_ip}) and {daemon2} ({daemon2_ip})")
        return cursor.lastrowid

    def get_session(self, session_id: int) -> Optional[Dict[str, Any]]:
        """Get a BGP session by ID."""
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM bgp_sessions WHERE id = ?", (session_id,))
        return self._row_to_dict(cursor.fetchone())

    def list_sessions(self, topology_name: Optional[str] = None,
                      daemon_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """List BGP sessions, optionally filtered by topology or daemon."""
        cursor = self.conn.cursor()
        if daemon_name:
            cursor.execute("""
                SELECT * FROM bgp_sessions
                WHERE (daemon1 = ? OR daemon2 = ?)
                AND (topology_name = ? OR ? IS NULL)
            """, (daemon_name, daemon_name, topology_name, topology_name))
        elif topology_name:
            cursor.execute("SELECT * FROM bgp_sessions WHERE topology_name = ?", (topology_name,))
        else:
            cursor.execute("SELECT * FROM bgp_sessions")
        return self._rows_to_list(cursor.fetchall())

    def delete_session(self, session_id: int) -> None:
        """Delete a BGP session by ID."""
        cursor = self.conn.cursor()
        cursor.execute("DELETE FROM bgp_sessions WHERE id = ?", (session_id,))
        self.conn.commit()
        logger.info(f"BGP session {session_id} deleted")

    def delete_session_by_ips(self, daemon1_ip: str, daemon2_ip: str,
                              topology_name: Optional[str] = None) -> None:
        """Delete a BGP session by IP addresses."""
        if topology_name is None:
            active_topo = self._get_active_topology()
            topology_name = active_topo["name"] if active_topo else "default"

        # Normalize order by IP
        if daemon1_ip > daemon2_ip:
            daemon1_ip, daemon2_ip = daemon2_ip, daemon1_ip

        cursor = self.conn.cursor()
        cursor.execute("""
            DELETE FROM bgp_sessions
            WHERE topology_name = ? AND daemon1_ip = ? AND daemon2_ip = ?
        """, (topology_name, daemon1_ip, daemon2_ip))
        self.conn.commit()
        logger.info(f"BGP session between {daemon1_ip} and {daemon2_ip} deleted")

    def delete_session_by_daemons(self, daemon1: str, daemon2: str,
                                  topology_name: Optional[str] = None) -> None:
        """Delete all BGP sessions between two daemons."""
        if topology_name is None:
            active_topo = self._get_active_topology()
            topology_name = active_topo["name"] if active_topo else "default"

        # Normalize order
        if daemon1 > daemon2:
            daemon1, daemon2 = daemon2, daemon1

        cursor = self.conn.cursor()
        cursor.execute("""
            DELETE FROM bgp_sessions
            WHERE topology_name = ? AND daemon1 = ? AND daemon2 = ?
        """, (topology_name, daemon1, daemon2))
        self.conn.commit()
        logger.info(f"BGP sessions between {daemon1} and {daemon2} deleted")

    def update_session_arc(self, session_id: int, arc: float) -> bool:
        """Update the arc (line curvature) of a BGP session."""
        cursor = self.conn.cursor()
        cursor.execute("UPDATE bgp_sessions SET arc = ? WHERE id = ?", (arc, session_id))
        self.conn.commit()
        if cursor.rowcount > 0:
            logger.info(f"BGP session {session_id} arc updated to {arc}")
            return True
        return False
