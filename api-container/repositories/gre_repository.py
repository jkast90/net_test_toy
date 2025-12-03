"""
GRE Repository
Handles GRE tunnel and link database operations
"""
import logging
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)


class GRERepository:
    """Repository for GRE tunnel and link database operations"""

    def __init__(self, conn, get_active_topology_func):
        self.conn = conn
        self._get_active_topology = get_active_topology_func

    def _row_to_dict(self, row) -> Optional[Dict[str, Any]]:
        if row is None:
            return None
        return dict(row)

    def _rows_to_list(self, rows) -> List[Dict[str, Any]]:
        return [dict(row) for row in rows]

    # ========================================================================
    # GRE Links Methods (new model - single record per tunnel)
    # ========================================================================

    def create_link(self, container1: str, container2: str, network: str,
                    tunnel_ip1: str, tunnel_ip2: str, tunnel_network: str = "30",
                    gre_key: Optional[int] = None, ttl: int = 64,
                    topology_name: Optional[str] = None) -> int:
        """Create a GRE link between two containers. Returns link ID."""
        if topology_name is None:
            active_topo = self._get_active_topology()
            topology_name = active_topo["name"] if active_topo else "default"

        # Normalize order - always store container1 < container2 alphabetically
        # Also swap tunnel IPs if we swap containers
        if container1 > container2:
            container1, container2 = container2, container1
            tunnel_ip1, tunnel_ip2 = tunnel_ip2, tunnel_ip1

        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO gre_links (topology_name, container1, container2, network, tunnel_ip1, tunnel_ip2, tunnel_network, gre_key, ttl)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(topology_name, container1, container2) DO UPDATE SET
                network = excluded.network,
                tunnel_ip1 = excluded.tunnel_ip1,
                tunnel_ip2 = excluded.tunnel_ip2,
                tunnel_network = excluded.tunnel_network,
                gre_key = excluded.gre_key,
                ttl = excluded.ttl
        """, (topology_name, container1, container2, network, tunnel_ip1, tunnel_ip2, tunnel_network, gre_key, ttl))
        self.conn.commit()
        logger.info(f"GRE link created between {container1} and {container2}")
        return cursor.lastrowid

    def get_link(self, link_id: int) -> Optional[Dict[str, Any]]:
        """Get a GRE link by ID."""
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM gre_links WHERE id = ?", (link_id,))
        return self._row_to_dict(cursor.fetchone())

    def list_links(self, topology_name: Optional[str] = None,
                   container_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """List GRE links, optionally filtered by topology or container."""
        cursor = self.conn.cursor()
        if container_name:
            cursor.execute("""
                SELECT * FROM gre_links
                WHERE (container1 = ? OR container2 = ?)
                AND (topology_name = ? OR ? IS NULL)
            """, (container_name, container_name, topology_name, topology_name))
        elif topology_name:
            cursor.execute("SELECT * FROM gre_links WHERE topology_name = ?", (topology_name,))
        else:
            cursor.execute("SELECT * FROM gre_links")
        return self._rows_to_list(cursor.fetchall())

    def delete_link(self, link_id: int) -> None:
        """Delete a GRE link by ID."""
        cursor = self.conn.cursor()
        cursor.execute("DELETE FROM gre_links WHERE id = ?", (link_id,))
        self.conn.commit()
        logger.info(f"GRE link {link_id} deleted")

    def delete_link_by_containers(self, container1: str, container2: str,
                                   topology_name: Optional[str] = None) -> None:
        """Delete a GRE link by container names."""
        if topology_name is None:
            active_topo = self._get_active_topology()
            topology_name = active_topo["name"] if active_topo else "default"

        # Normalize order
        if container1 > container2:
            container1, container2 = container2, container1

        cursor = self.conn.cursor()
        cursor.execute("""
            DELETE FROM gre_links
            WHERE topology_name = ? AND container1 = ? AND container2 = ?
        """, (topology_name, container1, container2))
        self.conn.commit()
        logger.info(f"GRE link between {container1} and {container2} deleted")

    def update_link_arc(self, link_id: int, arc: float) -> None:
        """Update the arc (line curvature) of a GRE link."""
        cursor = self.conn.cursor()
        cursor.execute("UPDATE gre_links SET arc = ? WHERE id = ?", (arc, link_id))
        self.conn.commit()
        logger.info(f"GRE link {link_id} arc updated to {arc}")

    # ========================================================================
    # GRE Tunnel Methods (legacy - per-container tunnel records)
    # ========================================================================

    def create_tunnel(self, container_name: str, tunnel_name: str, local_ip: str,
                      remote_ip: str, tunnel_ip: str, tunnel_network: str = "30",
                      gre_key: Optional[int] = None, ttl: int = 64,
                      topology_name: Optional[str] = None) -> None:
        """Create or update a GRE tunnel record"""
        if topology_name is None:
            active_topo = self._get_active_topology()
            topology_name = active_topo["name"] if active_topo else "default"

        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO gre_tunnels (container_name, tunnel_name, topology_name, local_ip, remote_ip, tunnel_ip, tunnel_network, gre_key, ttl)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(container_name, tunnel_name) DO UPDATE SET
                topology_name = excluded.topology_name,
                local_ip = excluded.local_ip,
                remote_ip = excluded.remote_ip,
                tunnel_ip = excluded.tunnel_ip,
                tunnel_network = excluded.tunnel_network,
                gre_key = excluded.gre_key,
                ttl = excluded.ttl
        """, (container_name, tunnel_name, topology_name, local_ip, remote_ip, tunnel_ip, tunnel_network, gre_key, ttl))
        self.conn.commit()
        logger.info(f"GRE tunnel '{tunnel_name}' saved for container '{container_name}'")

    def get_tunnel(self, container_name: str, tunnel_name: str) -> Optional[Dict[str, Any]]:
        """Get a specific GRE tunnel"""
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM gre_tunnels WHERE container_name = ? AND tunnel_name = ?", (container_name, tunnel_name))
        return self._row_to_dict(cursor.fetchone())

    def list_tunnels(self, container_name: Optional[str] = None,
                     topology_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """List GRE tunnels, optionally filtered by container or topology"""
        cursor = self.conn.cursor()
        if container_name:
            cursor.execute("SELECT * FROM gre_tunnels WHERE container_name = ?", (container_name,))
        elif topology_name:
            cursor.execute("SELECT * FROM gre_tunnels WHERE topology_name = ?", (topology_name,))
        else:
            cursor.execute("SELECT * FROM gre_tunnels")
        return self._rows_to_list(cursor.fetchall())

    def delete_tunnel(self, container_name: str, tunnel_name: str) -> None:
        """Delete a GRE tunnel"""
        cursor = self.conn.cursor()
        cursor.execute("DELETE FROM gre_tunnels WHERE container_name = ? AND tunnel_name = ?", (container_name, tunnel_name))
        self.conn.commit()
        logger.info(f"GRE tunnel '{tunnel_name}' deleted from container '{container_name}'")
