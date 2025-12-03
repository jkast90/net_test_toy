"""
Node Repository
Handles unified node database operations (combines daemons, hosts, external nodes)
"""
import logging
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)


class NodeRepository:
    """Repository for unified node database operations"""

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
    # Unified Node Methods
    # ========================================================================

    def create(self, name: str, node_type: str, topology_name: Optional[str] = None,
               # Common fields
               docker_id: Optional[str] = None, status: str = "created",
               map_x: Optional[float] = None, map_y: Optional[float] = None,
               color: Optional[str] = None,
               # Daemon-specific fields
               daemon_type: Optional[str] = None, asn: Optional[int] = None,
               router_id: Optional[str] = None, ip_address: Optional[str] = None,
               api_port: Optional[int] = None, location: str = "Local",
               docker_image: Optional[str] = None,
               # Host-specific fields
               gateway_node: Optional[str] = None, gateway_ip: Optional[str] = None,
               container_ip: Optional[str] = None, loopback_ip: Optional[str] = None,
               loopback_network: str = "24") -> None:
        """Create or update a unified node record"""
        if topology_name is None:
            active_topo = self._get_active_topology()
            topology_name = active_topo["name"] if active_topo else "default"

        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO nodes (name, topology_name, node_type, docker_id, status, map_x, map_y, color,
                              daemon_type, asn, router_id, ip_address, api_port, location, docker_image,
                              gateway_node, gateway_ip, container_ip, loopback_ip, loopback_network)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(name, topology_name) DO UPDATE SET
                node_type = excluded.node_type,
                docker_id = excluded.docker_id,
                status = excluded.status,
                map_x = excluded.map_x,
                map_y = excluded.map_y,
                color = excluded.color,
                daemon_type = excluded.daemon_type,
                asn = excluded.asn,
                router_id = excluded.router_id,
                ip_address = excluded.ip_address,
                api_port = excluded.api_port,
                location = excluded.location,
                docker_image = excluded.docker_image,
                gateway_node = excluded.gateway_node,
                gateway_ip = excluded.gateway_ip,
                container_ip = excluded.container_ip,
                loopback_ip = excluded.loopback_ip,
                loopback_network = excluded.loopback_network,
                updated_at = CURRENT_TIMESTAMP
        """, (name, topology_name, node_type, docker_id, status, map_x, map_y, color,
              daemon_type, asn, router_id, ip_address, api_port, location, docker_image,
              gateway_node, gateway_ip, container_ip, loopback_ip, loopback_network))
        self.conn.commit()
        logger.info(f"Node '{name}' ({node_type}) saved to topology '{topology_name}'")

    def get(self, name: str, topology_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Get a specific node by name and topology"""
        if topology_name is None:
            active_topo = self._get_active_topology()
            topology_name = active_topo["name"] if active_topo else "default"

        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM nodes WHERE name = ? AND topology_name = ?", (name, topology_name))
        return self._row_to_dict(cursor.fetchone())

    def list_all(self, topology_name: Optional[str] = None,
                 node_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """List nodes, optionally filtered by topology and/or type"""
        cursor = self.conn.cursor()
        if topology_name and node_type:
            cursor.execute("""
                SELECT * FROM nodes
                WHERE topology_name = ? AND node_type = ?
                ORDER BY created_at
            """, (topology_name, node_type))
        elif topology_name:
            cursor.execute("SELECT * FROM nodes WHERE topology_name = ? ORDER BY created_at", (topology_name,))
        elif node_type:
            cursor.execute("SELECT * FROM nodes WHERE node_type = ? ORDER BY created_at", (node_type,))
        else:
            cursor.execute("SELECT * FROM nodes ORDER BY created_at")
        return self._rows_to_list(cursor.fetchall())

    def update_status(self, name: str, status: str, topology_name: Optional[str] = None) -> None:
        """Update node status"""
        if topology_name is None:
            active_topo = self._get_active_topology()
            topology_name = active_topo["name"] if active_topo else "default"

        cursor = self.conn.cursor()
        cursor.execute("""
            UPDATE nodes SET status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE name = ? AND topology_name = ?
        """, (status, name, topology_name))
        self.conn.commit()

    def update_position(self, name: str, x: float, y: float, topology_name: Optional[str] = None) -> None:
        """Update node position on the map"""
        if topology_name is None:
            active_topo = self._get_active_topology()
            topology_name = active_topo["name"] if active_topo else "default"

        cursor = self.conn.cursor()
        cursor.execute("""
            UPDATE nodes SET map_x = ?, map_y = ?, updated_at = CURRENT_TIMESTAMP
            WHERE name = ? AND topology_name = ?
        """, (x, y, name, topology_name))
        self.conn.commit()

    def update_properties(self, name: str, topology_name: Optional[str] = None,
                          color: Optional[str] = None) -> None:
        """Update node properties like color"""
        if topology_name is None:
            active_topo = self._get_active_topology()
            topology_name = active_topo["name"] if active_topo else "default"

        cursor = self.conn.cursor()
        updates = []
        params = []

        if color is not None:
            updates.append("color = ?")
            params.append(color)

        if updates:
            updates.append("updated_at = CURRENT_TIMESTAMP")
            params.extend([name, topology_name])
            sql = f"UPDATE nodes SET {', '.join(updates)} WHERE name = ? AND topology_name = ?"
            cursor.execute(sql, params)
            self.conn.commit()
            logger.info(f"Node '{name}' properties updated")

    def delete(self, name: str, topology_name: Optional[str] = None) -> None:
        """Delete a node from the topology"""
        if topology_name is None:
            active_topo = self._get_active_topology()
            topology_name = active_topo["name"] if active_topo else "default"

        cursor = self.conn.cursor()
        cursor.execute("DELETE FROM nodes WHERE name = ? AND topology_name = ?", (name, topology_name))
        self.conn.commit()
        logger.info(f"Node '{name}' deleted from topology '{topology_name}'")

    # ========================================================================
    # Node Networks Methods
    # ========================================================================

    def add_network(self, node_name: str, network_name: str,
                    topology_name: Optional[str] = None,
                    ipv4_address: Optional[str] = None,
                    interface_name: Optional[str] = None) -> None:
        """Add a network connection to a node"""
        if topology_name is None:
            active_topo = self._get_active_topology()
            topology_name = active_topo["name"] if active_topo else "default"

        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO node_networks (node_name, topology_name, network_name, ipv4_address, interface_name)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(node_name, topology_name, network_name) DO UPDATE SET
                ipv4_address = excluded.ipv4_address,
                interface_name = excluded.interface_name
        """, (node_name, topology_name, network_name, ipv4_address, interface_name))
        self.conn.commit()

    def get_networks(self, node_name: str, topology_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get all network connections for a node"""
        if topology_name is None:
            active_topo = self._get_active_topology()
            topology_name = active_topo["name"] if active_topo else "default"

        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT n.*, nn.ipv4_address, nn.interface_name
            FROM networks n
            JOIN node_networks nn ON n.name = nn.network_name
            WHERE nn.node_name = ? AND nn.topology_name = ?
        """, (node_name, topology_name))
        return self._rows_to_list(cursor.fetchall())

    def remove_network(self, node_name: str, network_name: str,
                       topology_name: Optional[str] = None) -> None:
        """Remove a network connection from a node"""
        if topology_name is None:
            active_topo = self._get_active_topology()
            topology_name = active_topo["name"] if active_topo else "default"

        cursor = self.conn.cursor()
        cursor.execute("""
            DELETE FROM node_networks
            WHERE node_name = ? AND topology_name = ? AND network_name = ?
        """, (node_name, topology_name, network_name))
        self.conn.commit()

    # ========================================================================
    # External Node Methods
    # ========================================================================

    def create_external(self, name: str, topology_name: str,
                        x: Optional[float] = None, y: Optional[float] = None) -> None:
        """Create or update an external node in the topology"""
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO external_nodes (name, topology_name, map_x, map_y)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(name, topology_name) DO UPDATE SET
                map_x = excluded.map_x,
                map_y = excluded.map_y,
                updated_at = CURRENT_TIMESTAMP
        """, (name, topology_name, x, y))
        self.conn.commit()
        logger.info(f"External node '{name}' saved to topology '{topology_name}'")

    def list_external(self, topology_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """List all external nodes, optionally filtered by topology"""
        cursor = self.conn.cursor()
        if topology_name:
            cursor.execute("SELECT * FROM external_nodes WHERE topology_name = ? ORDER BY created_at", (topology_name,))
        else:
            cursor.execute("SELECT * FROM external_nodes ORDER BY created_at")
        return self._rows_to_list(cursor.fetchall())

    def update_external_position(self, name: str, topology_name: str, x: float, y: float) -> None:
        """Update external node position on the map"""
        cursor = self.conn.cursor()
        cursor.execute("""
            UPDATE external_nodes SET map_x = ?, map_y = ?, updated_at = CURRENT_TIMESTAMP
            WHERE name = ? AND topology_name = ?
        """, (x, y, name, topology_name))
        self.conn.commit()

    def delete_external(self, name: str, topology_name: str) -> None:
        """Delete an external node from a topology"""
        cursor = self.conn.cursor()
        cursor.execute("DELETE FROM external_nodes WHERE name = ? AND topology_name = ?", (name, topology_name))
        self.conn.commit()
        logger.info(f"External node '{name}' deleted from topology '{topology_name}'")
