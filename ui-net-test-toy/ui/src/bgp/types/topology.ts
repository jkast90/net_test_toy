/**
 * Topology Builder Type Definitions
 */

export interface Position {
  x: number;
  y: number;
}

export interface TopologyNode {
  id: string;
  type: 'daemon' | 'host' | 'network' | 'external_node';
  label: string;
  position: Position;
  data: any;
  asn?: number;
  color?: string;
}

export interface TopologyLink {
  id: string;
  source: string;
  target: string;
  type: 'network' | 'bgp' | 'gre';
  label?: string;
  color?: string;
  width?: number;
  sourceLabel?: string;  // Label to show 1/3 from source
  targetLabel?: string;  // Label to show 1/3 from target
  arc?: number;          // Custom arc value for line curvature (BGP sessions only)
  data?: any;  // Link-specific data (e.g., BGP peer info for deployment, GRE tunnel info)
}

export interface TopologyNetwork {
  id: string;
  name: string;
  subnet?: string;
  gateway?: string;
}

export interface NetworkInfo {
  name: string;
  ips: string[];
}

export interface LabDaemon {
  id: string;
  name: string;
  status: string;
  daemon_type: string;
  asn: string;
  router_id: string;
  ip_address: string;
  api_port: string;
  created: string;
  networks?: (NetworkInfo | string)[];
}

export interface LabHost {
  id: string;
  name: string;
  status: string;
  gateway_daemon: string;
  gateway_ip: string;
  loopback_ip: string;
  loopback_network: string;
  container_ip: string;
  networks?: (NetworkInfo | string)[];
  created: string;
}

export type InteractionMode = 'select' | 'add-link' | 'add-bgp-neighbor' | 'add-network' | 'add-gre-tunnel' | 'quick-test';
