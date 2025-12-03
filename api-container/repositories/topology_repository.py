"""Topology Repository - Handles topology CRUD operations"""
import logging
from typing import Optional, List, Dict, Any


logger = logging.getLogger(__name__)


class TopologyRepository:
    """Repository for topology operations"""

    def __init__(self, conn):
        self.conn = conn

    def create(self, name: str, description: Optional[str] = None, active: bool = False,
               management_network: Optional[str] = None) -> None:
        """Create or update a topology"""
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO topologies (name, description, active, management_network)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET
                description = excluded.description,
                active = excluded.active,
                management_network = excluded.management_network,
                updated_at = CURRENT_TIMESTAMP
        """, (name, description, int(active), management_network))
        self.conn.commit()
        logger.info(f"Topology '{name}' saved to database")

    def list_all(self) -> List[Dict[str, Any]]:
        """List all topologies"""
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM topologies ORDER BY created_at")
        return [dict(row) for row in cursor.fetchall()]

    def get(self, name: str) -> Optional[Dict[str, Any]]:
        """Get topology by name"""
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM topologies WHERE name = ?", (name,))
        row = cursor.fetchone()
        return dict(row) if row else None

    def set_active(self, name: str) -> None:
        """Set a topology as active (and deactivate all others)"""
        cursor = self.conn.cursor()
        cursor.execute("UPDATE topologies SET active = 0")
        cursor.execute("UPDATE topologies SET active = 1 WHERE name = ?", (name,))
        self.conn.commit()
        logger.info(f"Topology '{name}' set as active")

    def get_active(self) -> Optional[Dict[str, Any]]:
        """Get the currently active topology"""
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM topologies WHERE active = 1 LIMIT 1")
        row = cursor.fetchone()
        return dict(row) if row else None

    def delete(self, name: str) -> None:
        """Delete a topology and all associated resources"""
        cursor = self.conn.cursor()
        cursor.execute("DELETE FROM topologies WHERE name = ?", (name,))
        self.conn.commit()
        logger.info(f"Topology '{name}' deleted from database")

    def get_and_increment_ip_counter(self, topology_name: str) -> int:
        """Get current IP counter value and increment it atomically"""
        cursor = self.conn.cursor()
        cursor.execute("SELECT ip_counter FROM topologies WHERE name = ?", (topology_name,))
        row = cursor.fetchone()

        if not row:
            raise ValueError(f"Topology '{topology_name}' not found")

        current_value = row[0] if row[0] is not None else 0
        cursor.execute("UPDATE topologies SET ip_counter = ip_counter + 1 WHERE name = ?", (topology_name,))
        self.conn.commit()

        logger.info(f"Topology '{topology_name}' IP counter: {current_value} -> {current_value + 1}")
        return current_value
