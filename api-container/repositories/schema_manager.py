"""
Schema Manager - Handles database table creation and migrations
"""
import logging


logger = logging.getLogger(__name__)


class SchemaManager:
    """Manages database schema - tables and migrations"""

    def __init__(self, conn):
        """Initialize with database connection"""
        self.conn = conn

    def run_migrations(self):
        """Run database migrations to update schema"""
        cursor = self.conn.cursor()

        try:
            # Migration 1: Add topology_name to networks table
            cursor.execute("PRAGMA table_info(networks)")
            columns = [col[1] for col in cursor.fetchall()]
            if 'topology_name' not in columns and 'name' in columns:
                logger.info("Running migration: Adding topology_name to networks table")
                cursor.execute("ALTER TABLE networks ADD COLUMN topology_name TEXT DEFAULT 'default'")
                self.conn.commit()

            # Migration 2: Add topology_name to daemons table
            cursor.execute("PRAGMA table_info(daemons)")
            columns = [col[1] for col in cursor.fetchall()]
            if 'topology_name' not in columns and 'name' in columns:
                logger.info("Running migration: Adding topology_name to daemons table")
                cursor.execute("ALTER TABLE daemons ADD COLUMN topology_name TEXT DEFAULT 'default'")
                self.conn.commit()

            # Migration 3: Add topology_name to hosts table
            cursor.execute("PRAGMA table_info(hosts)")
            columns = [col[1] for col in cursor.fetchall()]
            if 'topology_name' not in columns and 'name' in columns:
                logger.info("Running migration: Adding topology_name to hosts table")
                cursor.execute("ALTER TABLE hosts ADD COLUMN topology_name TEXT DEFAULT 'default'")
                self.conn.commit()

            # Migration 4: Add topology_name to gre_tunnels table
            cursor.execute("PRAGMA table_info(gre_tunnels)")
            columns = [col[1] for col in cursor.fetchall()]
            if 'topology_name' not in columns and 'container_name' in columns:
                logger.info("Running migration: Adding topology_name to gre_tunnels table")
                cursor.execute("ALTER TABLE gre_tunnels ADD COLUMN topology_name TEXT DEFAULT 'default'")
                self.conn.commit()

            # Migration 5: Enable foreign key support
            cursor.execute("PRAGMA foreign_keys = ON")
            self.conn.commit()

            # Migration 6: Add map positions to daemons table
            cursor.execute("PRAGMA table_info(daemons)")
            columns = [col[1] for col in cursor.fetchall()]
            if 'map_x' not in columns and 'name' in columns:
                logger.info("Running migration: Adding map_x, map_y to daemons table")
                cursor.execute("ALTER TABLE daemons ADD COLUMN map_x REAL")
                cursor.execute("ALTER TABLE daemons ADD COLUMN map_y REAL")
                self.conn.commit()

            # Migration 7: Add map positions to hosts table
            cursor.execute("PRAGMA table_info(hosts)")
            columns = [col[1] for col in cursor.fetchall()]
            if 'map_x' not in columns and 'name' in columns:
                logger.info("Running migration: Adding map_x, map_y to hosts table")
                cursor.execute("ALTER TABLE hosts ADD COLUMN map_x REAL")
                cursor.execute("ALTER TABLE hosts ADD COLUMN map_y REAL")
                self.conn.commit()

            # Migration 8: Add map positions to networks table
            cursor.execute("PRAGMA table_info(networks)")
            columns = [col[1] for col in cursor.fetchall()]
            if 'map_x' not in columns and 'name' in columns:
                logger.info("Running migration: Adding map_x, map_y to networks table")
                cursor.execute("ALTER TABLE networks ADD COLUMN map_x REAL")
                cursor.execute("ALTER TABLE networks ADD COLUMN map_y REAL")
                self.conn.commit()

            # Migration 9: Add management_network to topologies table
            cursor.execute("PRAGMA table_info(topologies)")
            columns = [col[1] for col in cursor.fetchall()]
            if 'management_network' not in columns and 'name' in columns:
                logger.info("Running migration: Adding management_network to topologies table")
                cursor.execute("ALTER TABLE topologies ADD COLUMN management_network TEXT")
                self.conn.commit()

            # Migration 10: Add ip_counter to topologies table
            cursor.execute("PRAGMA table_info(topologies)")
            columns = [col[1] for col in cursor.fetchall()]
            if 'ip_counter' not in columns and 'name' in columns:
                logger.info("Running migration: Adding ip_counter to topologies table")
                cursor.execute("ALTER TABLE topologies ADD COLUMN ip_counter INTEGER DEFAULT 0")
                self.conn.commit()

            # Migration 11: Remove foreign key constraint from bgp_peers to allow external nodes
            # Check if bgp_peers table exists and has the old foreign key
            cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='bgp_peers'")
            result = cursor.fetchone()
            if result and 'FOREIGN KEY (local_daemon) REFERENCES daemons(name)' in result[0]:
                logger.info("Running migration: Removing foreign key constraint from bgp_peers table")
                # In SQLite, we need to recreate the table without the foreign key
                # First, rename the old table
                cursor.execute("ALTER TABLE bgp_peers RENAME TO bgp_peers_old")

                # Create new table without foreign key constraint
                cursor.execute("""
                    CREATE TABLE bgp_peers (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        local_daemon TEXT NOT NULL,
                        local_asn INTEGER,
                        local_ip TEXT,
                        peer_ip TEXT NOT NULL,
                        peer_asn INTEGER NOT NULL,
                        peer_router_id TEXT,
                        address_families TEXT,
                        auth_key TEXT,
                        description TEXT,
                        status TEXT DEFAULT 'configured',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(local_daemon, peer_ip)
                    )
                """)

                # Copy data from old table to new table
                cursor.execute("""
                    INSERT INTO bgp_peers
                    SELECT * FROM bgp_peers_old
                """)

                # Drop old table
                cursor.execute("DROP TABLE bgp_peers_old")
                self.conn.commit()

            # Migration 12: Add external flag to networks table
            cursor.execute("PRAGMA table_info(networks)")
            columns = [col[1] for col in cursor.fetchall()]
            if 'external' not in columns and 'name' in columns:
                logger.info("Running migration: Adding external flag to networks table")
                cursor.execute("ALTER TABLE networks ADD COLUMN external BOOLEAN DEFAULT 0")
                self.conn.commit()

            # Migration 13: Add color column to daemons table
            cursor.execute("PRAGMA table_info(daemons)")
            columns = [col[1] for col in cursor.fetchall()]
            if 'color' not in columns and 'name' in columns:
                logger.info("Running migration: Adding color column to daemons table")
                cursor.execute("ALTER TABLE daemons ADD COLUMN color TEXT")
                self.conn.commit()

            # Migration 14: Add color column to hosts table
            cursor.execute("PRAGMA table_info(hosts)")
            columns = [col[1] for col in cursor.fetchall()]
            if 'color' not in columns and 'name' in columns:
                logger.info("Running migration: Adding color column to hosts table")
                cursor.execute("ALTER TABLE hosts ADD COLUMN color TEXT")
                self.conn.commit()

            # Migration 15: Add color column to external_nodes table
            cursor.execute("PRAGMA table_info(external_nodes)")
            columns = [col[1] for col in cursor.fetchall()]
            if 'color' not in columns and 'name' in columns:
                logger.info("Running migration: Adding color column to external_nodes table")
                cursor.execute("ALTER TABLE external_nodes ADD COLUMN color TEXT")
                self.conn.commit()

            # Migration 16: Recreate bgp_sessions table with new schema (IPs and ASNs)
            # Check if old schema exists (missing daemon1_ip column)
            cursor.execute("PRAGMA table_info(bgp_sessions)")
            columns = [col[1] for col in cursor.fetchall()]
            if columns and 'daemon1_ip' not in columns:
                logger.info("Running migration: Recreating bgp_sessions table with IPs and ASNs")
                # Drop the old table (it's new and likely has no critical data)
                cursor.execute("DROP TABLE IF EXISTS bgp_sessions")
                self.conn.commit()
                # The new table will be created by create_tables()

            # Migration 17: Add arc column to bgp_sessions table for line curvature
            cursor.execute("PRAGMA table_info(bgp_sessions)")
            columns = [col[1] for col in cursor.fetchall()]
            if columns and 'arc' not in columns:
                logger.info("Running migration: Adding arc column to bgp_sessions table")
                cursor.execute("ALTER TABLE bgp_sessions ADD COLUMN arc REAL DEFAULT 0")
                self.conn.commit()

            # Migration 18: Change topology_taps from interface_name to network_name
            cursor.execute("PRAGMA table_info(topology_taps)")
            columns = [col[1] for col in cursor.fetchall()]
            if 'interface_name' in columns and 'network_name' not in columns:
                logger.info("Running migration: Changing topology_taps from interface_name to network_name")
                # Rename old table
                cursor.execute("ALTER TABLE topology_taps RENAME TO topology_taps_old")
                # Create new table with network_name
                cursor.execute("""
                    CREATE TABLE topology_taps (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        tap_name TEXT NOT NULL,
                        topology_name TEXT NOT NULL,
                        container_name TEXT NOT NULL,
                        network_name TEXT NOT NULL,
                        collector_ip TEXT NOT NULL,
                        collector_port INTEGER DEFAULT 2055,
                        netflow_version INTEGER DEFAULT 5,
                        status TEXT DEFAULT 'active',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(topology_name, container_name, network_name),
                        FOREIGN KEY (topology_name) REFERENCES topologies(name) ON DELETE CASCADE
                    )
                """)
                # Don't migrate old data since interface_name != network_name
                cursor.execute("DROP TABLE topology_taps_old")
                self.conn.commit()

            # Migration 19: Add arc column to gre_links table for line curvature
            cursor.execute("PRAGMA table_info(gre_links)")
            columns = [col[1] for col in cursor.fetchall()]
            if columns and 'arc' not in columns:
                logger.info("Running migration: Adding arc column to gre_links table")
                cursor.execute("ALTER TABLE gre_links ADD COLUMN arc REAL DEFAULT 0")
                self.conn.commit()

            # Migration 20: Add parent_interface column to networks table for macvlan/ipvlan
            cursor.execute("PRAGMA table_info(networks)")
            columns = [col[1] for col in cursor.fetchall()]
            if 'parent_interface' not in columns and 'name' in columns:
                logger.info("Running migration: Adding parent_interface column to networks table")
                cursor.execute("ALTER TABLE networks ADD COLUMN parent_interface TEXT")
                self.conn.commit()

        except Exception as e:
            logger.error(f"Migration failed: {e}")
            # Don't raise - continue with table creation

    def create_tables(self):
        """Create database tables if they don't exist"""
        cursor = self.conn.cursor()

        # Run migrations first
        self.run_migrations()

        # Topologies table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS topologies (
                name TEXT PRIMARY KEY,
                description TEXT,
                active BOOLEAN DEFAULT 0,
                management_network TEXT,
                ip_counter INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Networks table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS networks (
                name TEXT PRIMARY KEY,
                topology_name TEXT DEFAULT 'default',
                subnet TEXT NOT NULL,
                gateway TEXT NOT NULL,
                driver TEXT DEFAULT 'bridge',
                docker_id TEXT,
                map_x REAL,
                map_y REAL,
                external BOOLEAN DEFAULT 0,
                parent_interface TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Unified nodes table - combines daemons, hosts, and external nodes
        # node_type determines which fields are relevant
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS nodes (
                name TEXT NOT NULL,
                topology_name TEXT DEFAULT 'default',
                node_type TEXT NOT NULL,
                -- Common fields
                docker_id TEXT,
                status TEXT DEFAULT 'created',
                map_x REAL,
                map_y REAL,
                color TEXT,
                -- Daemon-specific fields
                daemon_type TEXT,
                asn INTEGER,
                router_id TEXT,
                ip_address TEXT,
                api_port INTEGER,
                location TEXT DEFAULT 'Local',
                docker_image TEXT,
                -- Host-specific fields
                gateway_node TEXT,
                gateway_ip TEXT,
                container_ip TEXT,
                loopback_ip TEXT,
                loopback_network TEXT DEFAULT '24',
                -- Timestamps
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (name, topology_name),
                FOREIGN KEY (topology_name) REFERENCES topologies(name) ON DELETE CASCADE
            )
        """)

        # Node networks (many-to-many) - unified from daemon_networks and host_networks
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS node_networks (
                node_name TEXT NOT NULL,
                topology_name TEXT NOT NULL,
                network_name TEXT NOT NULL,
                ipv4_address TEXT,
                interface_name TEXT,
                PRIMARY KEY (node_name, topology_name, network_name),
                FOREIGN KEY (node_name, topology_name) REFERENCES nodes(name, topology_name) ON DELETE CASCADE,
                FOREIGN KEY (network_name) REFERENCES networks(name) ON DELETE CASCADE
            )
        """)

        # Legacy tables kept for backward compatibility during migration
        # Daemons table (legacy)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS daemons (
                name TEXT PRIMARY KEY,
                topology_name TEXT DEFAULT 'default',
                daemon_type TEXT NOT NULL,
                asn INTEGER NOT NULL,
                router_id TEXT NOT NULL,
                ip_address TEXT NOT NULL,
                api_port INTEGER NOT NULL,
                location TEXT DEFAULT 'Local',
                docker_id TEXT,
                docker_image TEXT,
                status TEXT DEFAULT 'created',
                map_x REAL,
                map_y REAL,
                color TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (topology_name) REFERENCES topologies(name) ON DELETE CASCADE
            )
        """)

        # Daemon networks (legacy - many-to-many)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS daemon_networks (
                daemon_name TEXT NOT NULL,
                network_name TEXT NOT NULL,
                ipv4_address TEXT,
                interface_name TEXT,
                PRIMARY KEY (daemon_name, network_name),
                FOREIGN KEY (daemon_name) REFERENCES daemons(name) ON DELETE CASCADE,
                FOREIGN KEY (network_name) REFERENCES networks(name) ON DELETE CASCADE
            )
        """)

        # Hosts table (legacy)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS hosts (
                name TEXT PRIMARY KEY,
                topology_name TEXT DEFAULT 'default',
                gateway_daemon TEXT NOT NULL,
                gateway_ip TEXT NOT NULL,
                container_ip TEXT NOT NULL,
                loopback_ip TEXT NOT NULL,
                loopback_network TEXT DEFAULT '24',
                docker_id TEXT,
                status TEXT DEFAULT 'created',
                map_x REAL,
                map_y REAL,
                color TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (gateway_daemon) REFERENCES daemons(name) ON DELETE CASCADE,
                FOREIGN KEY (topology_name) REFERENCES topologies(name) ON DELETE CASCADE
            )
        """)

        # Host networks (legacy - many-to-many)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS host_networks (
                host_name TEXT NOT NULL,
                network_name TEXT NOT NULL,
                ipv4_address TEXT,
                interface_name TEXT,
                PRIMARY KEY (host_name, network_name),
                FOREIGN KEY (host_name) REFERENCES hosts(name) ON DELETE CASCADE,
                FOREIGN KEY (network_name) REFERENCES networks(name) ON DELETE CASCADE
            )
        """)

        # BGP sessions table - single record per session between two daemons
        # Stores both daemon names and their IPs for the session
        # Unique constraint on IPs since daemons could have multiple sessions on different networks
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS bgp_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                topology_name TEXT DEFAULT 'default',
                daemon1 TEXT NOT NULL,
                daemon1_asn INTEGER,
                daemon1_ip TEXT NOT NULL,
                daemon2 TEXT NOT NULL,
                daemon2_asn INTEGER,
                daemon2_ip TEXT NOT NULL,
                network TEXT,
                address_families TEXT DEFAULT 'ipv4-unicast',
                auth_key TEXT,
                description TEXT,
                arc REAL DEFAULT 0,
                status TEXT DEFAULT 'configured',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(topology_name, daemon1_ip, daemon2_ip),
                FOREIGN KEY (topology_name) REFERENCES topologies(name) ON DELETE CASCADE
            )
        """)

        # Legacy BGP peers table (no foreign key to allow external nodes)
        # Kept for backward compatibility - will be migrated to bgp_sessions
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS bgp_peers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                local_daemon TEXT NOT NULL,
                local_asn INTEGER,
                local_ip TEXT,
                peer_ip TEXT NOT NULL,
                peer_asn INTEGER NOT NULL,
                peer_router_id TEXT,
                address_families TEXT,
                auth_key TEXT,
                description TEXT,
                status TEXT DEFAULT 'configured',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(local_daemon, peer_ip)
            )
        """)

        # Add new columns to existing bgp_peers table (migration)
        try:
            cursor.execute("ALTER TABLE bgp_peers ADD COLUMN local_asn INTEGER")
        except:
            pass  # Column already exists
        try:
            cursor.execute("ALTER TABLE bgp_peers ADD COLUMN local_ip TEXT")
        except:
            pass
        try:
            cursor.execute("ALTER TABLE bgp_peers ADD COLUMN address_families TEXT")
        except:
            pass
        try:
            cursor.execute("ALTER TABLE bgp_peers ADD COLUMN auth_key TEXT")
        except:
            pass
        try:
            cursor.execute("ALTER TABLE bgp_peers ADD COLUMN description TEXT")
        except:
            pass

        # BGP routes table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS bgp_routes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                local_daemon TEXT NOT NULL,
                prefix TEXT NOT NULL,
                next_hop TEXT,
                origin TEXT DEFAULT 'incomplete',
                local_pref INTEGER,
                med INTEGER,
                communities TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(local_daemon, prefix),
                FOREIGN KEY (local_daemon) REFERENCES daemons(name) ON DELETE CASCADE
            )
        """)

        # GRE links table - single record per tunnel between two containers
        # Underlay IPs are resolved at deploy time from container interfaces on the shared network
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS gre_links (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                topology_name TEXT DEFAULT 'default',
                container1 TEXT NOT NULL,
                container2 TEXT NOT NULL,
                network TEXT NOT NULL,
                tunnel_ip1 TEXT NOT NULL,
                tunnel_ip2 TEXT NOT NULL,
                tunnel_network TEXT DEFAULT '30',
                gre_key INTEGER,
                ttl INTEGER DEFAULT 64,
                arc REAL DEFAULT 0,
                status TEXT DEFAULT 'configured',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(topology_name, container1, container2),
                FOREIGN KEY (topology_name) REFERENCES topologies(name) ON DELETE CASCADE
            )
        """)

        # Legacy GRE tunnels table - kept for backward compatibility
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS gre_tunnels (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                container_name TEXT NOT NULL,
                tunnel_name TEXT NOT NULL,
                topology_name TEXT DEFAULT 'default',
                local_ip TEXT NOT NULL,
                remote_ip TEXT NOT NULL,
                tunnel_ip TEXT NOT NULL,
                tunnel_network TEXT DEFAULT '30',
                gre_key INTEGER,
                ttl INTEGER DEFAULT 64,
                status TEXT DEFAULT 'configured',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(container_name, tunnel_name),
                FOREIGN KEY (topology_name) REFERENCES topologies(name) ON DELETE CASCADE
            )
        """)

        # Topology route advertisements table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS topology_route_advertisements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                topology_name TEXT NOT NULL,
                target_daemon TEXT NOT NULL,
                prefix TEXT NOT NULL,
                cidr TEXT NOT NULL,
                next_hop TEXT,
                communities TEXT,
                med INTEGER,
                as_path TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (topology_name) REFERENCES topologies(name) ON DELETE CASCADE
            )
        """)

        # Topology triggers table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS topology_triggers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                topology_name TEXT NOT NULL,
                name TEXT NOT NULL,
                enabled BOOLEAN DEFAULT 1,
                min_kbps TEXT,
                min_mbps TEXT,
                min_pps TEXT,
                min_bytes TEXT,
                src_addr TEXT,
                dst_addr TEXT,
                src_or_dst_addr TEXT,
                protocol TEXT,
                action_type TEXT NOT NULL,
                action_message TEXT,
                rate_limit_kbps TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (topology_name) REFERENCES topologies(name) ON DELETE CASCADE
            )
        """)

        # External nodes table (legacy - now part of unified nodes table)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS external_nodes (
                name TEXT NOT NULL,
                topology_name TEXT NOT NULL,
                map_x REAL,
                map_y REAL,
                color TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (name, topology_name),
                FOREIGN KEY (topology_name) REFERENCES topologies(name) ON DELETE CASCADE
            )
        """)

        # Topology taps table - taps are tied to container + network
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS topology_taps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tap_name TEXT NOT NULL,
                topology_name TEXT NOT NULL,
                container_name TEXT NOT NULL,
                network_name TEXT NOT NULL,
                collector_ip TEXT NOT NULL,
                collector_port INTEGER DEFAULT 2055,
                netflow_version INTEGER DEFAULT 5,
                status TEXT DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(topology_name, container_name, network_name),
                FOREIGN KEY (topology_name) REFERENCES topologies(name) ON DELETE CASCADE
            )
        """)

        # IPsec links table - single record per tunnel between two containers
        # Similar to GRE links but with StrongSwan-specific parameters
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ipsec_links (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                topology_name TEXT DEFAULT 'default',
                container1 TEXT NOT NULL,
                container2 TEXT NOT NULL,
                network TEXT NOT NULL,
                tunnel_ip1 TEXT NOT NULL,
                tunnel_ip2 TEXT NOT NULL,
                tunnel_network TEXT DEFAULT '30',
                psk TEXT,
                ike_version INTEGER DEFAULT 2,
                ike_cipher TEXT DEFAULT 'aes256-sha256-modp2048',
                esp_cipher TEXT DEFAULT 'aes256-sha256',
                dh_group TEXT DEFAULT 'modp2048',
                ike_lifetime INTEGER DEFAULT 86400,
                sa_lifetime INTEGER DEFAULT 3600,
                dpd_delay INTEGER DEFAULT 30,
                dpd_timeout INTEGER DEFAULT 120,
                arc REAL DEFAULT 0,
                status TEXT DEFAULT 'configured',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(topology_name, container1, container2),
                FOREIGN KEY (topology_name) REFERENCES topologies(name) ON DELETE CASCADE
            )
        """)

        # Legacy IPsec tunnels table - per-container tunnel records
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ipsec_tunnels (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                container_name TEXT NOT NULL,
                tunnel_name TEXT NOT NULL,
                topology_name TEXT DEFAULT 'default',
                local_ip TEXT NOT NULL,
                remote_ip TEXT NOT NULL,
                tunnel_ip TEXT NOT NULL,
                tunnel_network TEXT DEFAULT '30',
                psk TEXT,
                ike_version INTEGER DEFAULT 2,
                ike_cipher TEXT DEFAULT 'aes256-sha256-modp2048',
                esp_cipher TEXT DEFAULT 'aes256-sha256',
                status TEXT DEFAULT 'configured',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(container_name, tunnel_name),
                FOREIGN KEY (topology_name) REFERENCES topologies(name) ON DELETE CASCADE
            )
        """)

        self.conn.commit()
        logger.info("Database tables created/verified")
