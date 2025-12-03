/**
 * Topology Service Types
 * All type definitions for network topology management
 */

// Core topology types
export interface Topology {
  id?: string;
  name: string;
  description: string | null;
  active: number; // SQLite returns 0 or 1 for boolean fields
  created_at: string;
  updated_at: string;
  nodes?: TopologyNode[];
  edges?: TopologyEdge[];
  metadata?: Record<string, any>;
}

export interface TopologyDetails {
  topology: Topology;
  networks: Network[];
  // New unified model
  nodes: UnifiedNode[];
  bgp_sessions: BGPSession[];
  gre_links: GRELink[];
  // Legacy - kept for backward compatibility
  daemons: Daemon[];
  hosts: Host[];
  external_nodes: ExternalNode[];
  connections: Connection[];
  bgp_peers: BGPPeer[];
  bgp_routes: BGPRoute[];
  gre_tunnels: GRETunnel[];
  taps: TopologyTap[];
  triggers: TopologyTrigger[];
}

// Unified node model - combines daemons, hosts, and external nodes
export interface UnifiedNode {
  name: string;
  node_type: 'daemon' | 'host' | 'external';
  topology_name?: string;
  // Common fields
  status?: string;
  map_x?: number;
  map_y?: number;
  color?: string;
  docker_id?: string;
  // Daemon-specific fields
  daemon_type?: 'gobgp' | 'frr' | 'exabgp';
  asn?: number;
  router_id?: string;
  ip_address?: string;
  api_port?: number;
  location?: string;
  docker_image?: string;
  // Host-specific fields
  gateway_node?: string;
  gateway_ip?: string;
  container_ip?: string;
  loopback_ip?: string;
  loopback_network?: string;
  // Network connections
  networks?: string[];
  interfaces?: NetworkInterface[];
}

// BGP session - single record for a peer relationship
export interface BGPSession {
  id: number;
  topology_name: string;
  daemon1: string;
  daemon1_ip: string;
  daemon1_asn?: number;
  daemon2: string;
  daemon2_ip: string;
  daemon2_asn?: number;
  network?: string;
  address_families?: string;
  auth_key?: string;
  description?: string;
  arc?: number; // Line curvature for visualization (positive = curve up/right, negative = down/left, 0 = straight)
  status?: string;
  created_at?: string;
}

// GRE link - single record for a tunnel between two containers
export interface GRELink {
  id: number;
  topology_name: string;
  container1: string;
  container2: string;
  network: string;
  tunnel_ip1: string;
  tunnel_ip2: string;
  tunnel_network?: string;
  gre_key?: number;
  ttl?: number;
  created_at?: string;
}

// External node for representing external BGP peers on the topology
export interface ExternalNode {
  name: string;
  topology_name?: string;
  map_x?: number;
  map_y?: number;
  color?: string;
}

// Topology tap for NetFlow monitoring
export interface TopologyTap {
  id?: number;
  tap_name: string;
  topology_name: string;
  container_name: string;
  interface_name: string;
  collector_ip: string;
  collector_port: number;
  netflow_version: number;
  status: string;
}

// Topology trigger for automated actions
export interface TopologyTrigger {
  id: number;
  topology_name: string;
  name: string;
  enabled: boolean;
  min_kbps?: string;
  min_mbps?: string;
  min_pps?: string;
  min_bytes?: string;
  src_addr?: string;
  dst_addr?: string;
  src_or_dst_addr?: string;
  protocol?: string;
  action_type: string;
  action_message?: string;
  rate_limit_kbps?: string;
}

// Network components
export interface Network {
  id: string;
  name: string;
  subnet: string;
  gateway: string;
  driver: string;
  scope?: string;
  ipam?: {
    driver: string;
    config: Array<{
      subnet: string;
      gateway?: string;
    }>;
  };
  containers: Array<{
    id: string;
    name: string;
    ipv4: string;
    mac?: string;
  }>;
  container_count?: number;
  created?: string;
}

export interface Daemon {
  id: string;
  name: string;
  type: 'gobgp' | 'frr' | 'exabgp';
  status: 'running' | 'stopped' | 'exited' | 'paused';
  asn: number;
  router_id: string;
  ip_address: string;
  api_port: number;
  interfaces: NetworkInterface[];
  container_id?: string;
  image?: string;
  created?: string;
}

export interface Host {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'exited';
  gateway_daemon: string;
  gateway_ip: string;
  loopback_ip: string;
  loopback_network: string;
  interfaces: NetworkInterface[];
  container_id?: string;
  image?: string;
  created?: string;
}

export interface NetworkInterface {
  network: string;
  ipv4: string;
  ipv6?: string;
  gateway: string;
  mac: string;
  mtu?: number;
}

export interface Connection {
  id: string;
  network: string;
  container: string;
  container_type: 'daemon' | 'host';
  ip_address: string;
  mac_address?: string;
}

// BGP configuration
export interface BGPPeer {
  id?: string;
  source: string;  // Local daemon name
  target: string;  // Remote daemon name
  source_asn: number;
  target_asn: number;
  peer_ip: string;
  peer_group?: string;
  import_policy?: string;
  export_policy?: string;
  enabled?: boolean;
  state?: 'idle' | 'connect' | 'active' | 'opensent' | 'openconfirm' | 'established';
}

export interface BGPRoute {
  id?: string;
  prefix: string;
  next_hop: string;
  origin: 'igp' | 'egp' | 'incomplete';
  as_path?: string;
  local_pref?: number;
  med?: number;
  communities?: string[];
  daemon_name?: string;
}

// Tunnels
export interface GRETunnel {
  id: number;
  container_name: string;
  tunnel_name: string;
  topology_name: string;
  local_ip: string;
  remote_ip: string;
  tunnel_ip: string;
  tunnel_network: string;
  gre_key?: number;
  ttl?: number;
  status: 'up' | 'down' | 'unknown';
  created_at: string;
}

// Lab management
export interface ManagedHost {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  status: 'connected' | 'disconnected' | 'error';
  error?: string;
  last_check?: string;
}

// Topology operations
export interface TopologyMutationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface TopologyTemplate {
  id: string;
  name: string;
  description: string;
  networks: Partial<Network>[];
  daemons: Partial<Daemon>[];
  hosts: Partial<Host>[];
  bgp_config?: {
    peers: Partial<BGPPeer>[];
    routes: Partial<BGPRoute>[];
  };
  tags?: string[];
}

// Visualization data
export interface TopologyNode {
  id: string;
  name: string;
  type: 'network' | 'daemon' | 'host';
  x?: number;
  y?: number;
  data: Network | Daemon | Host;
  status?: 'running' | 'stopped' | 'error';
  label?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface TopologyLink {
  source: string;
  target: string;
  type: 'network' | 'bgp-peer' | 'tunnel';
  label?: string;
  data?: any;
}

export interface TopologyLayout {
  nodes: TopologyNode[];
  links: TopologyLink[];
  bounds?: {
    width: number;
    height: number;
  };
}

// Topology creation/update
export interface CreateTopologyRequest {
  name: string;
  description?: string;
  template?: string;  // Template ID to use
  nodes?: TopologyNode[];
  edges?: TopologyEdge[];
  networks?: Array<{
    name: string;
    subnet: string;
    gateway?: string;
    driver?: string;
  }>;
  daemons?: Array<{
    name: string;
    type: 'gobgp' | 'frr' | 'exabgp';
    asn: number;
    router_id: string;
    networks: string[];
  }>;
  hosts?: Array<{
    name: string;
    gateway_daemon: string;
    loopback_ip: string;
    loopback_network: string;
    networks: string[];
  }>;
  metadata?: Record<string, any>;
}

// Topology statistics
export interface TopologyStats {
  network_count: number;
  daemon_count: number;
  host_count: number;
  peer_count: number;
  route_count: number;
  tunnel_count: number;
  total_containers: number;
  running_containers: number;
  resource_usage?: {
    cpu_percent: number;
    memory_mb: number;
    disk_mb: number;
  };
}

// Alias for TopologyLayout string type used in UI
export type TopologyLayoutType = 'hierarchical' | 'force' | 'circular' | 'grid' | 'custom';

// Additional types needed for imports
export interface TopologyDefinition {
  id: string;
  name: string;
  description?: string;
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  metadata?: Record<string, any>;
}

export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  type: 'network' | 'bgp-peer' | 'tunnel' | 'physical';
  label?: string;
  metadata?: Record<string, any>;
}

export interface TopologyFilter {
  nodeTypes?: Array<'network' | 'daemon' | 'host'>;
  node_types?: Array<'network' | 'daemon' | 'host'>;
  status?: Array<'running' | 'stopped' | 'error'>;
  node_status?: Array<'running' | 'stopped' | 'error'>;
  search?: string;
  search_query?: string;
  tags?: string[];
  edge_types?: Array<'network' | 'bgp-peer' | 'tunnel' | 'physical'>;
  include_orphan_edges?: boolean;
}

export interface TopologyDiscovery {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  method?: string;
  discovered_nodes: number;
  discovered_edges: number;
  started_at: string;
  completed_at?: string;
  error?: string;
}

export interface TopologyValidation {
  id: string;
  status: 'valid' | 'invalid' | 'warning';
  issues: Array<{
    severity: 'error' | 'warning' | 'info';
    message: string;
    node_id?: string;
    edge_id?: string;
  }>;
  validated_at: string;
}

export interface TopologySimulation {
  id: string;
  type?: string;
  status: 'running' | 'stopped' | 'paused';
  started_at: string;
  metrics?: Record<string, any>;
}

export interface TopologyVisualization {
  layout: TopologyLayout;
  options?: Record<string, any>;
}

export interface TopologySnapshot {
  id: string;
  name: string;
  topology_id: string;
  created_at: string;
  data: TopologyDefinition;
}

export interface TopologyDiff {
  added_nodes: TopologyNode[];
  removed_nodes: TopologyNode[];
  modified_nodes: Array<{ before: TopologyNode; after: TopologyNode }>;
  added_edges: TopologyEdge[];
  removed_edges: TopologyEdge[];
  modified_edges: Array<{ before: TopologyEdge; after: TopologyEdge }>;
}

export interface TopologyExportOptions {
  format: 'json' | 'yaml' | 'dot' | 'png' | 'svg';
  include_metadata?: boolean;
  include_positions?: boolean;
  include_stats?: boolean;
  include_styles?: boolean;
}