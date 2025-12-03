// BGP API service for unified BGP API
// @deprecated - Most methods in this file are deprecated. Use multiClientBgpApi instead
// which properly handles multiple BGP clients with dynamic URLs.
import { fetchWrapper } from '../utils/fetchWrapper';

// Default BGP API base URL (can be overridden by passing clientUrl)
const BGP_API_BASE = 'http://localhost:5050';

export interface RouteAttributes {
  next_hop?: string;
  community?: string[];
  extended_community?: string[];
  as_path?: number[];
  med?: number;
}

export interface NeighborAttributes {
  remote_asn: number;
  local_asn?: number;
  out_policy?: string;
  in_policy?: string;
  description?: string;
  local_address?: string;
  ebgp_multihop?: boolean;
  ebgp_multihop_ttl?: number;
  auth_password?: string;
}

export interface Neighbor {
  address: string;
  asn: number;
  state: string;
  uptime?: string;
  received_routes?: number;
  accepted_routes?: number;
}

export interface Route {
  prefix: string;
  next_hop: string;
  as_path?: number[];
  community?: string[];
  med?: number;
  rpki_validation?: string;
  rpki_reason?: string;
}

export interface FlowSpecMatch {
  source?: string;
  destination?: string;
  protocol?: number;
  source_port?: number;
  destination_port?: number;
  icmp_type?: number;
  icmp_code?: number;
  tcp_flags?: string[];
  packet_length?: string;
  dscp?: number;
  fragment?: string;
}

export interface FlowSpecActions {
  action: 'discard' | 'accept' | 'rate-limit' | 'redirect' | 'mark';
  rate?: number;
  redirect_rt?: string;
  mark_dscp?: number;
}

export interface FlowSpecRule {
  family?: 'ipv4' | 'ipv6';
  match: FlowSpecMatch;
  actions: FlowSpecActions;
}

export interface PolicyStatement {
  name: string;
  conditions?: {
    prefix_set?: string[];
    neighbor_set?: string[];
    as_path_length?: { operator: string; value: number };
    community_set?: string[];
  };
  actions?: {
    route_disposition?: 'accept' | 'reject';
    med?: number;
    local_pref?: number;
    community?: { add?: string[]; remove?: string[]; replace?: string[] };
    as_path_prepend?: { asn: number; repeat: number };
  };
}

export interface Policy {
  name: string;
  statements: PolicyStatement[];
}

export interface PrefixListEntry {
  prefix: string;
  mask_length_range?: string; // e.g. "24..32"
}

export interface PrefixList {
  name: string;
  entries: PrefixListEntry[];
}

export const bgpApi = {
  // Get available backends
  async getBackends(clientUrl?: string) {
    const base = clientUrl || BGP_API_BASE;
    return await fetchWrapper(`${base}/backends`);
  },

  // Get BGP status
  async getStatus(backend?: string) {
    const url = backend
      ? `${BGP_API_BASE}/status?backend=${backend}`
      : `${BGP_API_BASE}/status`;
    return await fetchWrapper(url);
  },

  // Get neighbors
  async getNeighbors(backend?: string) {
    const url = backend
      ? `${BGP_API_BASE}/neighbor?backend=${backend}`
      : `${BGP_API_BASE}/neighbor`;
    return await fetchWrapper(url);
  },

  // Get neighbor routes
  async getNeighborRoutes(ip: string, backend?: string) {
    const url = backend
      ? `${BGP_API_BASE}/neighbor/${ip}?backend=${backend}`
      : `${BGP_API_BASE}/neighbor/${ip}`;
    return await fetchWrapper(url);
  },

  // Advertise a route
  async advertiseRoute(
    prefix: string,
    cidr: string,
    attributes: RouteAttributes,
    backend?: string
  ) {
    const url = backend
      ? `${BGP_API_BASE}/route/${prefix}/${cidr}?backend=${backend}`
      : `${BGP_API_BASE}/route/${prefix}/${cidr}`;

    return await fetchWrapper(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(attributes),
    });
  },

  // Withdraw a route
  async withdrawRoute(prefix: string, cidr: string, backend?: string) {
    const url = backend
      ? `${BGP_API_BASE}/route/${prefix}/${cidr}?backend=${backend}`
      : `${BGP_API_BASE}/route/${prefix}/${cidr}`;

    return await fetchWrapper(url, {
      method: 'DELETE',
    });
  },

  // Configure a neighbor
  async configureNeighbor(
    neighborIp: string,
    attributes: NeighborAttributes,
    backend?: string
  ) {
    const url = backend
      ? `${BGP_API_BASE}/neighbor/${neighborIp}?backend=${backend}`
      : `${BGP_API_BASE}/neighbor/${neighborIp}`;

    return await fetchWrapper(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(attributes),
    });
  },

  // Bring up neighbor
  async bringUpNeighbor(neighborIp: string, remoteAsn: number, backend?: string) {
    const url = backend
      ? `${BGP_API_BASE}/neighbor/status/${neighborIp}?backend=${backend}`
      : `${BGP_API_BASE}/neighbor/status/${neighborIp}`;

    return await fetchWrapper(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ remote_asn: remoteAsn }),
    });
  },

  // Shut down neighbor
  async shutDownNeighbor(neighborIp: string, backend?: string) {
    const url = backend
      ? `${BGP_API_BASE}/neighbor/status/${neighborIp}?backend=${backend}`
      : `${BGP_API_BASE}/neighbor/status/${neighborIp}`;

    return await fetchWrapper(url, {
      method: 'DELETE',
    });
  },

  // FlowSpec operations
  async getFlowSpecRules(family: 'ipv4' | 'ipv6' = 'ipv4', backend?: string) {
    const url = backend
      ? `${BGP_API_BASE}/flowspec?family=${family}&backend=${backend}`
      : `${BGP_API_BASE}/flowspec?family=${family}`;
    return await fetchWrapper(url);
  },

  async addFlowSpecRule(rule: FlowSpecRule, backend?: string) {
    const url = backend
      ? `${BGP_API_BASE}/flowspec?backend=${backend}`
      : `${BGP_API_BASE}/flowspec`;

    return await fetchWrapper(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(rule),
    });
  },

  async deleteFlowSpecRule(rule: FlowSpecRule, backend?: string) {
    const url = backend
      ? `${BGP_API_BASE}/flowspec?backend=${backend}`
      : `${BGP_API_BASE}/flowspec`;

    return await fetchWrapper(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(rule),
    });
  },

  // Policy operations
  async getPolicies(backend?: string) {
    const url = backend
      ? `${BGP_API_BASE}/policy?backend=${backend}`
      : `${BGP_API_BASE}/policy`;
    return await fetchWrapper(url);
  },

  async createPolicy(name: string, policy: Policy, backend?: string) {
    const url = backend
      ? `${BGP_API_BASE}/policy/${name}?backend=${backend}`
      : `${BGP_API_BASE}/policy/${name}`;

    return await fetchWrapper(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(policy),
    });
  },

  async deletePolicy(name: string, backend?: string) {
    const url = backend
      ? `${BGP_API_BASE}/policy/${name}?backend=${backend}`
      : `${BGP_API_BASE}/policy/${name}`;

    return await fetchWrapper(url, {
      method: 'DELETE',
    });
  },

  // Prefix list operations
  async getPrefixLists(backend?: string) {
    const url = backend
      ? `${BGP_API_BASE}/prefix_list?backend=${backend}`
      : `${BGP_API_BASE}/prefix_list`;
    return await fetchWrapper(url);
  },

  async createPrefixList(name: string, prefixList: PrefixList, backend?: string) {
    const url = backend
      ? `${BGP_API_BASE}/prefix_list/${name}?backend=${backend}`
      : `${BGP_API_BASE}/prefix_list/${name}`;

    return await fetchWrapper(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(prefixList),
    });
  },

  async deletePrefixList(name: string, backend?: string) {
    const url = backend
      ? `${BGP_API_BASE}/prefix_list/${name}?backend=${backend}`
      : `${BGP_API_BASE}/prefix_list/${name}`;

    return await fetchWrapper(url, {
      method: 'DELETE',
    });
  },

  // Save configuration
  async saveConfig(backend?: string) {
    const url = backend
      ? `${BGP_API_BASE}/save?backend=${backend}`
      : `${BGP_API_BASE}/save`;

    return await fetchWrapper(url, {
      method: 'POST',
    });
  },
};
