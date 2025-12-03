"""
Topology Configuration Repository
Manages route advertisements and triggers associated with topologies
"""
import logging
from typing import List, Dict, Optional
from .base_repository import BaseRepository


logger = logging.getLogger(__name__)


class TopologyConfigRepository(BaseRepository):
    """Repository for topology-specific configurations (route advertisements and triggers)"""

    # ==================== Route Advertisements ====================

    def create_route_advertisement(
        self,
        topology_name: str,
        target_daemon: str,
        prefix: str,
        cidr: str,
        next_hop: Optional[str] = None,
        communities: Optional[str] = None,
        med: Optional[int] = None,
        as_path: Optional[str] = None
    ) -> int:
        """
        Save a route advertisement configuration to a topology
        Returns the ID of the created record
        """
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO topology_route_advertisements (
                topology_name, target_daemon, prefix, cidr,
                next_hop, communities, med, as_path
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (topology_name, target_daemon, prefix, cidr, next_hop, communities, med, as_path))
        self.conn.commit()
        logger.info(f"Created route advertisement for topology '{topology_name}': {prefix}/{cidr}")
        return cursor.lastrowid

    def get_route_advertisements(self, topology_name: str) -> List[Dict]:
        """Get all route advertisements for a topology"""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT * FROM topology_route_advertisements
            WHERE topology_name = ?
            ORDER BY created_at DESC
        """, (topology_name,))
        rows = cursor.fetchall()
        return self._rows_to_list(rows)

    def get_route_advertisement(self, advertisement_id: int) -> Optional[Dict]:
        """Get a specific route advertisement by ID"""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT * FROM topology_route_advertisements
            WHERE id = ?
        """, (advertisement_id,))
        row = cursor.fetchone()
        return self._row_to_dict(row)

    def delete_route_advertisement(self, advertisement_id: int) -> bool:
        """Delete a route advertisement"""
        cursor = self.conn.cursor()
        cursor.execute("""
            DELETE FROM topology_route_advertisements
            WHERE id = ?
        """, (advertisement_id,))
        self.conn.commit()
        deleted = cursor.rowcount > 0
        if deleted:
            logger.info(f"Deleted route advertisement ID {advertisement_id}")
        return deleted

    # ==================== Triggers ====================

    def create_trigger(
        self,
        topology_name: str,
        name: str,
        enabled: bool = True,
        min_kbps: Optional[str] = None,
        min_mbps: Optional[str] = None,
        min_pps: Optional[str] = None,
        min_bytes: Optional[str] = None,
        src_addr: Optional[str] = None,
        dst_addr: Optional[str] = None,
        src_or_dst_addr: Optional[str] = None,
        protocol: Optional[str] = None,
        action_type: str = "log",
        action_message: Optional[str] = None,
        rate_limit_kbps: Optional[str] = None
    ) -> int:
        """
        Save a trigger configuration to a topology
        Returns the ID of the created record
        """
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO topology_triggers (
                topology_name, name, enabled,
                min_kbps, min_mbps, min_pps, min_bytes,
                src_addr, dst_addr, src_or_dst_addr, protocol,
                action_type, action_message, rate_limit_kbps
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            topology_name, name, enabled,
            min_kbps, min_mbps, min_pps, min_bytes,
            src_addr, dst_addr, src_or_dst_addr, protocol,
            action_type, action_message, rate_limit_kbps
        ))
        self.conn.commit()
        logger.info(f"Created trigger '{name}' for topology '{topology_name}'")
        return cursor.lastrowid

    def get_triggers(self, topology_name: str) -> List[Dict]:
        """Get all triggers for a topology"""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT * FROM topology_triggers
            WHERE topology_name = ?
            ORDER BY created_at DESC
        """, (topology_name,))
        rows = cursor.fetchall()
        return self._rows_to_list(rows)

    def get_trigger(self, trigger_id: int) -> Optional[Dict]:
        """Get a specific trigger by ID"""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT * FROM topology_triggers
            WHERE id = ?
        """, (trigger_id,))
        row = cursor.fetchone()
        return self._row_to_dict(row)

    def update_trigger(
        self,
        trigger_id: int,
        name: Optional[str] = None,
        enabled: Optional[bool] = None,
        min_kbps: Optional[str] = None,
        min_mbps: Optional[str] = None,
        min_pps: Optional[str] = None,
        min_bytes: Optional[str] = None,
        src_addr: Optional[str] = None,
        dst_addr: Optional[str] = None,
        src_or_dst_addr: Optional[str] = None,
        protocol: Optional[str] = None,
        action_type: Optional[str] = None,
        action_message: Optional[str] = None,
        rate_limit_kbps: Optional[str] = None
    ) -> bool:
        """Update a trigger configuration"""
        # Build dynamic update query based on provided fields
        updates = []
        params = []

        if name is not None:
            updates.append("name = ?")
            params.append(name)
        if enabled is not None:
            updates.append("enabled = ?")
            params.append(enabled)
        if min_kbps is not None:
            updates.append("min_kbps = ?")
            params.append(min_kbps)
        if min_mbps is not None:
            updates.append("min_mbps = ?")
            params.append(min_mbps)
        if min_pps is not None:
            updates.append("min_pps = ?")
            params.append(min_pps)
        if min_bytes is not None:
            updates.append("min_bytes = ?")
            params.append(min_bytes)
        if src_addr is not None:
            updates.append("src_addr = ?")
            params.append(src_addr)
        if dst_addr is not None:
            updates.append("dst_addr = ?")
            params.append(dst_addr)
        if src_or_dst_addr is not None:
            updates.append("src_or_dst_addr = ?")
            params.append(src_or_dst_addr)
        if protocol is not None:
            updates.append("protocol = ?")
            params.append(protocol)
        if action_type is not None:
            updates.append("action_type = ?")
            params.append(action_type)
        if action_message is not None:
            updates.append("action_message = ?")
            params.append(action_message)
        if rate_limit_kbps is not None:
            updates.append("rate_limit_kbps = ?")
            params.append(rate_limit_kbps)

        if not updates:
            return False

        updates.append("updated_at = CURRENT_TIMESTAMP")
        params.append(trigger_id)

        cursor = self.conn.cursor()
        query = f"UPDATE topology_triggers SET {', '.join(updates)} WHERE id = ?"
        cursor.execute(query, params)
        self.conn.commit()

        updated = cursor.rowcount > 0
        if updated:
            logger.info(f"Updated trigger ID {trigger_id}")
        return updated

    def delete_trigger(self, trigger_id: int) -> bool:
        """Delete a trigger"""
        cursor = self.conn.cursor()
        cursor.execute("""
            DELETE FROM topology_triggers
            WHERE id = ?
        """, (trigger_id,))
        self.conn.commit()
        deleted = cursor.rowcount > 0
        if deleted:
            logger.info(f"Deleted trigger ID {trigger_id}")
        return deleted
