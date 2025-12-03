/**
 * BMP (BGP Monitoring Protocol) type definitions
 * Centralized types for BMP monitoring
 */

export interface BMPPeer {
  address: string;
  as: number;
  router_id: string;
  state: string;
  uptime?: number;
}

export interface BMPRoute {
  prefix: string;
  next_hop: string;
  as_path: (number | string)[];
  local_pref?: number;
  med?: number;
  communities?: string[];
  timestamp: string;
}
