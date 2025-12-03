"""
Daemon Repository
Handles daemon-related database operations
"""
import logging
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)


class DaemonRepository:
    """Repository for daemon database operations"""

    def __init__(self, conn, get_active_topology_func):
        self.conn = conn
        self._get_active_topology = get_active_topology_func

    def _row_to_dict(self, row) -> Optional[Dict[str, Any]]:
        if row is None:
            return None
        return dict(row)

    def _rows_to_list(self, rows) -> List[Dict[str, Any]]:
        return [dict(row) for row in rows]

    def create(self, name: str, daemon_type: str, asn: int, router_id: str,
               ip_address: str, api_port: int, location: str = "Local",
               docker_id: Optional[str] = None, docker_image: Optional[str] = None,
               topology_name: Optional[str] = None, color: Optional[str] = None) -> None:
        if topology_name is None:
            active_topo = self._get_active_topology()
            topology_name = active_topo["name"] if active_topo else "default"

        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO daemons (name, topology_name, daemon_type, asn, router_id, ip_address, api_port, location, docker_id, docker_image, color)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET
                topology_name = excluded.topology_name,
                daemon_type = excluded.daemon_type,
                asn = excluded.asn,
                router_id = excluded.router_id,
                ip_address = excluded.ip_address,
                api_port = excluded.api_port,
                location = excluded.location,
                docker_id = excluded.docker_id,
                docker_image = excluded.docker_image,
                color = excluded.color,
                updated_at = CURRENT_TIMESTAMP
        """, (name, topology_name, daemon_type, asn, router_id, ip_address, api_port, location, docker_id, docker_image, color))
        self.conn.commit()
        logger.info(f"Daemon '{name}' saved to database")

    def get(self, name: str) -> Optional[Dict[str, Any]]:
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM daemons WHERE name = ?", (name,))
        return self._row_to_dict(cursor.fetchone())

    def list_all(self, topology_name: Optional[str] = None) -> List[Dict[str, Any]]:
        cursor = self.conn.cursor()
        if topology_name:
            cursor.execute("SELECT * FROM daemons WHERE topology_name = ? ORDER BY created_at", (topology_name,))
        else:
            cursor.execute("SELECT * FROM daemons ORDER BY created_at")
        return self._rows_to_list(cursor.fetchall())

    def update_status(self, name: str, status: str) -> None:
        cursor = self.conn.cursor()
        cursor.execute("UPDATE daemons SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE name = ?", (status, name))
        self.conn.commit()

    def update_position(self, name: str, x: float, y: float) -> None:
        cursor = self.conn.cursor()
        cursor.execute("UPDATE daemons SET map_x = ?, map_y = ?, updated_at = CURRENT_TIMESTAMP WHERE name = ?", (x, y, name))
        self.conn.commit()

    def update_properties(self, name: str, color: Optional[str] = None) -> None:
        """Update daemon properties like color"""
        cursor = self.conn.cursor()
        updates = []
        params = []

        if color is not None:
            updates.append("color = ?")
            params.append(color)

        if updates:
            updates.append("updated_at = CURRENT_TIMESTAMP")
            params.append(name)
            sql = f"UPDATE daemons SET {', '.join(updates)} WHERE name = ?"
            cursor.execute(sql, params)
            self.conn.commit()
            logger.info(f"Daemon '{name}' properties updated")

    def delete(self, name: str) -> None:
        cursor = self.conn.cursor()
        cursor.execute("DELETE FROM daemons WHERE name = ?", (name,))
        self.conn.commit()
        logger.info(f"Daemon '{name}' deleted")

    def add_network(self, daemon_name: str, network_name: str,
                    ipv4_address: Optional[str] = None, interface_name: Optional[str] = None) -> None:
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO daemon_networks (daemon_name, network_name, ipv4_address, interface_name)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(daemon_name, network_name) DO UPDATE SET
                ipv4_address = excluded.ipv4_address,
                interface_name = excluded.interface_name
        """, (daemon_name, network_name, ipv4_address, interface_name))
        self.conn.commit()

    def get_networks(self, daemon_name: str) -> List[Dict[str, Any]]:
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT n.*, dn.ipv4_address, dn.interface_name
            FROM networks n
            JOIN daemon_networks dn ON n.name = dn.network_name
            WHERE dn.daemon_name = ?
        """, (daemon_name,))
        return self._rows_to_list(cursor.fetchall())

    def remove_network(self, daemon_name: str, network_name: str) -> None:
        cursor = self.conn.cursor()
        cursor.execute("DELETE FROM daemon_networks WHERE daemon_name = ? AND network_name = ?", (daemon_name, network_name))
        self.conn.commit()

    def list_networks(self, topology_name: Optional[str] = None) -> List[Dict[str, Any]]:
        cursor = self.conn.cursor()
        if topology_name:
            cursor.execute("""
                SELECT dn.* FROM daemon_networks dn
                JOIN daemons d ON dn.daemon_name = d.name
                WHERE d.topology_name = ?
            """, (topology_name,))
        else:
            cursor.execute("SELECT * FROM daemon_networks")
        return self._rows_to_list(cursor.fetchall())
