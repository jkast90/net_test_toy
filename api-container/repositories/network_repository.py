"""
Network Repository
Handles network-related database operations
"""
import logging
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)


class NetworkRepository:
    """Repository for network database operations"""

    def __init__(self, conn, get_active_topology_func):
        self.conn = conn
        self._get_active_topology = get_active_topology_func

    def _row_to_dict(self, row) -> Optional[Dict[str, Any]]:
        if row is None:
            return None
        return dict(row)

    def _rows_to_list(self, rows) -> List[Dict[str, Any]]:
        return [dict(row) for row in rows]

    def create(self, name: str, subnet: str, gateway: str, driver: str = "bridge",
               docker_id: Optional[str] = None, topology_name: Optional[str] = None,
               external: bool = False, parent_interface: Optional[str] = None) -> None:
        """Create or update a network record"""
        if topology_name is None:
            active_topo = self._get_active_topology()
            topology_name = active_topo["name"] if active_topo else "default"

        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO networks (name, topology_name, subnet, gateway, driver, docker_id, external, parent_interface)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET
                topology_name = excluded.topology_name,
                subnet = excluded.subnet,
                gateway = excluded.gateway,
                driver = excluded.driver,
                docker_id = excluded.docker_id,
                external = excluded.external,
                parent_interface = excluded.parent_interface,
                updated_at = CURRENT_TIMESTAMP
        """, (name, topology_name, subnet, gateway, driver, docker_id, external, parent_interface))
        self.conn.commit()
        logger.info(f"Network '{name}' saved to database (external={external}, driver={driver}, parent={parent_interface})")

    def get(self, name: str) -> Optional[Dict[str, Any]]:
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM networks WHERE name = ?", (name,))
        return self._row_to_dict(cursor.fetchone())

    def list_all(self, topology_name: Optional[str] = None) -> List[Dict[str, Any]]:
        cursor = self.conn.cursor()
        if topology_name:
            cursor.execute("SELECT * FROM networks WHERE topology_name = ? ORDER BY created_at", (topology_name,))
        else:
            cursor.execute("SELECT * FROM networks ORDER BY created_at")
        return self._rows_to_list(cursor.fetchall())

    def update_position(self, name: str, x: float, y: float) -> None:
        cursor = self.conn.cursor()
        cursor.execute("UPDATE networks SET map_x = ?, map_y = ?, updated_at = CURRENT_TIMESTAMP WHERE name = ?", (x, y, name))
        self.conn.commit()

    def delete(self, name: str) -> None:
        cursor = self.conn.cursor()
        cursor.execute("DELETE FROM networks WHERE name = ?", (name,))
        self.conn.commit()
        logger.info(f"Network '{name}' deleted")
