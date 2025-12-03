/**
 * BMP Service Types
 * All type definitions for BMP (BGP Monitoring Protocol) operations
 */

export interface BMPPeer {
  id: string;
  address: string;
  as: number;
  router_id: string;
  state: 'up' | 'down' | 'idle' | 'established' | 'Established';
  uptime?: number;
  timestamp: string;
  client_id?: string;
  daemon_type?: string;
}

export interface BMPRoute {
  prefix: string;
  next_hop: string;
  as_path: (number | string)[];
  local_pref?: number;
  med?: number;
  communities?: string[];
  timestamp: string;
  peer_address?: string;
  origin?: 'igp' | 'egp' | 'incomplete';
  route_type: 'advertised' | 'received';
}

export interface BMPFlowSpecRule {
  id: string;
  match: {
    source?: string;
    destination?: string;
    protocol?: number;
    source_port?: number;
    destination_port?: number;
  };
  actions: {
    action: string;
    rate?: number;
  };
  timestamp: string;
}

export interface BMPMessage {
  id: string;
  type: 'peer_up' | 'peer_down' | 'route_add' | 'route_del' | 'stats';
  peer_address: string;
  timestamp: string;
  data: any;
}

export interface BMPStats {
  total_peers: number;
  active_peers: number;
  total_routes: number;
  total_prefixes: number;
  messages_per_second: number;
  last_update: string;
}

export interface BMPServerConfig {
  enabled: boolean;
  listen_address: string;
  listen_port: number;
  max_connections: number;
  buffer_size: number;
}

export interface BMPData {
  peers: BMPPeer[];
  routes: {
    [peer_address: string]: {
      advertised: BMPRoute[];
      received: BMPRoute[];
    };
  };
  flowspec: {
    count: number;
    rules: BMPFlowSpecRule[];
  };
  stats: BMPStats;
  messages: BMPMessage[];
}

export interface BMPFilter {
  peer_address?: string;
  as_number?: number;
  route_type?: 'advertised' | 'received';
  prefix?: string;
  state?: 'up' | 'down';
  start_time?: string;
  end_time?: string;
}

export interface BMPMutationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}