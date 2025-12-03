// Multi-client BGP API service
import { UnifiedClient, DaemonConfig } from '../store/connectionSlice';
import { RouteAttributes, NeighborAttributes, FlowSpecRule } from './bgpApi';
import { fetchWrapper } from '../utils/fetchWrapper';

export interface ClientDaemonPair {
  client: UnifiedClient;
  daemon: DaemonConfig;
}

export interface AggregatedNeighbor {
  neighbor_ip: string;
  state: number | string;
  remote_as: number;
  local_as: number;
  description?: string;
  uptime_str?: string;
  admin_shutdown?: boolean;
  received_routes?: any[];
  advertised_routes?: any[];
  // Metadata
  clientId: string;
  clientName: string;
  backend: DaemonConfig['type'];
}

export interface AggregatedRoute {
  prefix: string;
  next_hop: string;
  as_path?: number[];
  community?: string[];
  med?: number;
  local_pref?: number;
  communities?: string[];
  // Metadata
  clientId: string;
  clientName: string;
  backend: DaemonConfig['type'];
}

/**
 * Build URL for a client's daemon endpoint
 */
function buildUrl(client: UnifiedClient, daemon: DaemonConfig, path: string): string {
  // For BGP daemons (gobgp, frr, exabgp), use the client's base URL directly
  // since the unified API handles all three backends on the same port
  if (['gobgp', 'frr', 'exabgp'].includes(daemon.type)) {
    return `${client.baseUrl}${path}`;
  }

  // For BMP and NetFlow, use the daemon-specific port
  const port = daemon.port || getDaemonDefaultPort(daemon.type);
  const baseUrl = client.baseUrl.replace(/:\d+$/, ''); // Remove existing port if any
  return `${baseUrl}:${port}${path}`;
}

function getDaemonDefaultPort(type: DaemonConfig['type']): number {
  switch (type) {
    case 'gobgp':
    case 'frr':
    case 'exabgp':
      return 5001;
    case 'bmp':
      return 5002;
    case 'netflow':
      return 5003;
    default:
      return 5001;
  }
}

/**
 * Fetch neighbors from multiple client-daemon pairs
 */
export async function fetchAggregatedNeighbors(
  pairs: ClientDaemonPair[]
): Promise<AggregatedNeighbor[]> {
  const results: AggregatedNeighbor[] = [];

  // Filter to only BGP daemons (not BMP/NetFlow)
  const bgpPairs = pairs.filter(p =>
    ['gobgp', 'frr', 'exabgp'].includes(p.daemon.type)
  );

  await Promise.allSettled(
    bgpPairs.map(async ({ client, daemon }) => {
      try {
        const url = buildUrl(client, daemon, `/neighbor?backend=${daemon.type}`);
        const data = await fetchWrapper(url);
        const neighbors = data.neighbors || [];

        neighbors.forEach((neighbor: any) => {
          results.push({
            ...neighbor,
            clientId: client.id,
            clientName: client.name,
            backend: daemon.type
          });
        });
      } catch (error) {
        console.error(`Error fetching neighbors from ${client.name} (${daemon.type}):`, error);
      }
    })
  );

  return results;
}

/**
 * Fetch routes from multiple client-daemon pairs
 */
export async function fetchAggregatedRoutes(
  pairs: ClientDaemonPair[]
): Promise<AggregatedRoute[]> {
  const results: AggregatedRoute[] = [];

  // Filter to only BGP daemons
  const bgpPairs = pairs.filter(p =>
    ['gobgp', 'frr', 'exabgp'].includes(p.daemon.type)
  );

  await Promise.allSettled(
    bgpPairs.map(async ({ client, daemon }) => {
      try {
        const url = buildUrl(client, daemon, `/route?backend=${daemon.type}`);
        const data = await fetchWrapper(url);
        const routes = data.routes || [];

        routes.forEach((route: any) => {
          results.push({
            ...route,
            clientId: client.id,
            clientName: client.name,
            backend: daemon.type
          });
        });
      } catch (error) {
        console.error(`Error fetching routes from ${client.name} (${daemon.type}):`, error);
      }
    })
  );

  return results;
}

/**
 * Advertise route to specific client-daemon pairs
 */
export async function advertiseRouteToTargets(
  targets: ClientDaemonPair[],
  prefix: string,
  cidr: string,
  attributes: RouteAttributes
): Promise<{ success: number; failed: number; errors: string[] }> {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  const results = await Promise.allSettled(
    targets.map(async ({ client, daemon }) => {
      const url = buildUrl(client, daemon, `/route/${prefix}/${cidr}?backend=${daemon.type}`);

      return await fetchWrapper(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attributes)
      });
    })
  );

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      success++;
    } else {
      failed++;
      const target = targets[index];
      errors.push(`${target.client.name} (${target.daemon.type}): ${result.reason}`);
    }
  });

  return { success, failed, errors };
}

/**
 * Withdraw route from specific client-daemon pairs
 */
export async function withdrawRouteFromTargets(
  targets: ClientDaemonPair[],
  prefix: string,
  cidr: string
): Promise<{ success: number; failed: number; errors: string[] }> {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  const results = await Promise.allSettled(
    targets.map(async ({ client, daemon }) => {
      const url = buildUrl(client, daemon, `/route/${prefix}/${cidr}?backend=${daemon.type}`);

      return await fetchWrapper(url, {
        method: 'DELETE'
      });
    })
  );

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      success++;
    } else {
      failed++;
      const target = targets[index];
      errors.push(`${target.client.name} (${target.daemon.type}): ${result.reason}`);
    }
  });

  return { success, failed, errors };
}

/**
 * Configure neighbor on specific client-daemon pairs
 */
export async function configureNeighborOnTargets(
  targets: ClientDaemonPair[],
  neighborIp: string,
  attributes: NeighborAttributes
): Promise<{ success: number; failed: number; errors: string[] }> {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  const results = await Promise.allSettled(
    targets.map(async ({ client, daemon }) => {
      const url = buildUrl(client, daemon, `/neighbor/${neighborIp}?backend=${daemon.type}`);

      return await fetchWrapper(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attributes)
      });
    })
  );

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      success++;
    } else {
      failed++;
      const target = targets[index];
      errors.push(`${target.client.name} (${target.daemon.type}): ${result.reason}`);
    }
  });

  return { success, failed, errors };
}

/**
 * Delete neighbor from specific client-daemon pairs
 */
export async function deleteNeighborFromTargets(
  targets: ClientDaemonPair[],
  neighborIp: string
): Promise<{ success: number; failed: number; errors: string[] }> {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  const results = await Promise.allSettled(
    targets.map(async ({ client, daemon }) => {
      const url = buildUrl(client, daemon, `/neighbor/${neighborIp}?backend=${daemon.type}`);

      return await fetchWrapper(url, {
        method: 'DELETE'
      });
    })
  );

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      success++;
    } else {
      failed++;
      const target = targets[index];
      errors.push(`${target.client.name} (${target.daemon.type}): ${result.reason}`);
    }
  });

  return { success, failed, errors };
}

/**
 * Add FlowSpec rule to specific client-daemon pairs (GoBGP only)
 */
export async function addFlowSpecRuleToTargets(
  targets: ClientDaemonPair[],
  rule: FlowSpecRule
): Promise<{ success: number; failed: number; errors: string[] }> {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  // FlowSpec only works on GoBGP
  const gobgpTargets = targets.filter(t => t.daemon.type === 'gobgp');

  const results = await Promise.allSettled(
    gobgpTargets.map(async ({ client, daemon }) => {
      const url = buildUrl(client, daemon, `/flowspec?backend=${daemon.type}`);

      return await fetchWrapper(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule)
      });
    })
  );

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      success++;
    } else {
      failed++;
      const target = gobgpTargets[index];
      errors.push(`${target.client.name} (${target.daemon.type}): ${result.reason}`);
    }
  });

  return { success, failed, errors };
}
