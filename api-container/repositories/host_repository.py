"""
Host Repository
Handles host-related database operations
"""
import logging
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)


class HostRepository:
    """Repository for host database operations"""

    def __init__(self, conn, get_active_topology_func):
        self.conn = conn
        self._get_active_topology = get_active_topology_func

    def _row_to_dict(self, row) -> Optional[Dict[str, Any]]:
        if row is None:
            return None
        return dict(row)

    def _rows_to_list(self, rows) -> List[Dict[str, Any]]:
        return [dict(row) for row in rows]

    def create(self, name: str, gateway_daemon: str, gateway_ip: str,
               container_ip: str, loopback_ip: str, loopback_network: str = "24",
               docker_id: Optional[str] = None, topology_name: Optional[str] = None) -> None:
        if topology_name is None:
            active_topo = self._get_active_topology()
            topology_name = active_topo["name"] if active_topo else "default"

        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO hosts (name, topology_name, gateway_daemon, gateway_ip, container_ip, loopback_ip, loopback_network, docker_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET
                topology_name = excluded.topology_name,
                gateway_daemon = excluded.gateway_daemon,
                gateway_ip = excluded.gateway_ip,
                container_ip = excluded.container_ip,
                loopback_ip = excluded.loopback_ip,
                loopback_network = excluded.loopback_network,
                docker_id = excluded.docker_id,
                updated_at = CURRENT_TIMESTAMP
        """, (name, topology_name, gateway_daemon, gateway_ip, container_ip, loopback_ip, loopback_network, docker_id))
        self.conn.commit()
        logger.info(f"Host '{name}' saved to database")

    def get(self, name: str) -> Optional[Dict[str, Any]]:
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM hosts WHERE name = ?", (name,))
        return self._row_to_dict(cursor.fetchone())

    def list_all(self, topology_name: Optional[str] = None) -> List[Dict[str, Any]]:
        cursor = self.conn.cursor()
        if topology_name:
            cursor.execute("SELECT * FROM hosts WHERE topology_name = ? ORDER BY created_at", (topology_name,))
        else:
            cursor.execute("SELECT * FROM hosts ORDER BY created_at")
        return self._rows_to_list(cursor.fetchall())

    def update_status(self, name: str, status: str) -> None:
        cursor = self.conn.cursor()
        cursor.execute("UPDATE hosts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE name = ?", (status, name))
        self.conn.commit()

    def update_position(self, name: str, x: float, y: float) -> None:
        cursor = self.conn.cursor()
        cursor.execute("UPDATE hosts SET map_x = ?, map_y = ?, updated_at = CURRENT_TIMESTAMP WHERE name = ?", (x, y, name))
        self.conn.commit()

    def update(self, name: str, gateway_daemon: Optional[str] = None,
               gateway_ip: Optional[str] = None, loopback_ip: Optional[str] = None,
               loopback_network: Optional[str] = None, container_ip: Optional[str] = None) -> None:
        """Update host configuration fields"""
        cursor = self.conn.cursor()

        updates = []
        params = []

        if gateway_daemon is not None:
            updates.append("gateway_daemon = ?")
            params.append(gateway_daemon)
        if gateway_ip is not None:
            updates.append("gateway_ip = ?")
            params.append(gateway_ip)
        if loopback_ip is not None:
            updates.append("loopback_ip = ?")
            params.append(loopback_ip)
        if loopback_network is not None:
            updates.append("loopback_network = ?")
            params.append(loopback_network)
        if container_ip is not None:
            updates.append("container_ip = ?")
            params.append(container_ip)

        if not updates:
            return

        updates.append("updated_at = CURRENT_TIMESTAMP")
        params.append(name)

        query = f"UPDATE hosts SET {', '.join(updates)} WHERE name = ?"
        cursor.execute(query, params)
        self.conn.commit()
        logger.info(f"Host '{name}' updated")

    def delete(self, name: str) -> None:
        cursor = self.conn.cursor()
        cursor.execute("DELETE FROM hosts WHERE name = ?", (name,))
        self.conn.commit()
        logger.info(f"Host '{name}' deleted")

    def add_network(self, host_name: str, network_name: str,
                    ipv4_address: Optional[str] = None, interface_name: Optional[str] = None) -> None:
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO host_networks (host_name, network_name, ipv4_address, interface_name)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(host_name, network_name) DO UPDATE SET
                ipv4_address = excluded.ipv4_address,
                interface_name = excluded.interface_name
        """, (host_name, network_name, ipv4_address, interface_name))
        self.conn.commit()

    def get_networks(self, host_name: str) -> List[Dict[str, Any]]:
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT n.*, hn.ipv4_address, hn.interface_name
            FROM networks n
            JOIN host_networks hn ON n.name = hn.network_name
            WHERE hn.host_name = ?
        """, (host_name,))
        return self._rows_to_list(cursor.fetchall())

    def get_interfaces(self, host_name: str) -> List[Dict[str, Any]]:
        return self.get_networks(host_name)

    def remove_network(self, host_name: str, network_name: str) -> None:
        cursor = self.conn.cursor()
        cursor.execute("DELETE FROM host_networks WHERE host_name = ? AND network_name = ?", (host_name, network_name))
        self.conn.commit()
