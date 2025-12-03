"""
Tap Repository
Handles topology tap database operations
"""
import logging
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)


class TapRepository:
    """Repository for topology tap database operations"""

    def __init__(self, conn):
        self.conn = conn

    def _row_to_dict(self, row) -> Optional[Dict[str, Any]]:
        if row is None:
            return None
        return dict(row)

    def _rows_to_list(self, rows) -> List[Dict[str, Any]]:
        return [dict(row) for row in rows]

    def create(self, tap_name: str, topology_name: str, container_name: str,
               network_name: str, collector_ip: str, collector_port: int = 2055,
               netflow_version: int = 5) -> None:
        """Create a tap record linked to topology (container + network)"""
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO topology_taps (tap_name, topology_name, container_name, network_name,
                                      collector_ip, collector_port, netflow_version, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
            ON CONFLICT(topology_name, container_name, network_name) DO UPDATE SET
                tap_name = excluded.tap_name,
                collector_ip = excluded.collector_ip,
                collector_port = excluded.collector_port,
                netflow_version = excluded.netflow_version,
                status = 'active',
                updated_at = CURRENT_TIMESTAMP
        """, (tap_name, topology_name, container_name, network_name, collector_ip, collector_port, netflow_version))
        self.conn.commit()
        logger.info(f"Tap '{tap_name}' saved to topology '{topology_name}'")

    def get(self, topology_name: str, container_name: str, network_name: str) -> Optional[Dict[str, Any]]:
        """Get specific tap for topology by container and network"""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT * FROM topology_taps
            WHERE topology_name = ? AND container_name = ? AND network_name = ?
        """, (topology_name, container_name, network_name))
        return self._row_to_dict(cursor.fetchone())

    def list_all(self, topology_name: Optional[str] = None,
                 container_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """List taps filtered by topology or container"""
        cursor = self.conn.cursor()
        if topology_name and container_name:
            cursor.execute("SELECT * FROM topology_taps WHERE topology_name = ? AND container_name = ?",
                         (topology_name, container_name))
        elif topology_name:
            cursor.execute("SELECT * FROM topology_taps WHERE topology_name = ?", (topology_name,))
        elif container_name:
            cursor.execute("SELECT * FROM topology_taps WHERE container_name = ?", (container_name,))
        else:
            cursor.execute("SELECT * FROM topology_taps")
        return self._rows_to_list(cursor.fetchall())

    def delete(self, topology_name: str, container_name: str, network_name: str) -> None:
        """Delete tap from topology"""
        cursor = self.conn.cursor()
        cursor.execute("""
            DELETE FROM topology_taps
            WHERE topology_name = ? AND container_name = ? AND network_name = ?
        """, (topology_name, container_name, network_name))
        self.conn.commit()
        logger.info(f"Tap for {container_name} on {network_name} deleted from topology '{topology_name}'")

    def update_status(self, topology_name: str, container_name: str,
                      network_name: str, status: str) -> None:
        """Update tap status"""
        cursor = self.conn.cursor()
        cursor.execute("""
            UPDATE topology_taps SET status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE topology_name = ? AND container_name = ? AND network_name = ?
        """, (status, topology_name, container_name, network_name))
        self.conn.commit()
