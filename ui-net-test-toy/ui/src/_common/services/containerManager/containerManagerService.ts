/**
 * Container Manager Service Layer
 * Handles all API operations for container/daemon/host/network/tunnel management
 */

import { fetchWrapper } from '../../utils/fetchWrapper';

export interface Daemon {
  name: string;
  type: string;
  asn?: string;
  router_id?: string;
  container_ip?: string;
  loopback_ip?: string;
  networks?: any[];
}

export interface Host {
  name: string;
  container_ip?: string;
  loopback_ip?: string;
  networks?: any[];
}

export interface Network {
  id: string;
  name: string;
  driver: string;
  scope: string;
  subnet: string | null;
  gateway: string | null;
  container_count?: number;
  created?: string;
}

export interface NetworkCreateParams {
  name: string;
  subnet: string;
  gateway: string;
  driver?: string;
}

export interface GreTunnel {
  id: number;
  container_name: string;
  tunnel_name: string;
  topology_name: string;
  local_ip: string;
  remote_ip: string;
  tunnel_ip: string;
  tunnel_network: string;
  gre_key: number | null;
  ttl: number;
  status: string;
  created_at: string;
}

export interface GreTunnelCreateParams {
  remote_host: string;
  remote_ip: string;
  tunnel_network: string;
  tunnel_ip_a?: string;
  tunnel_ip_b?: string;
  tunnel_name?: string;
  gre_key?: number;
  ttl?: number;
}

class ContainerManagerService {
  /**
   * Get all daemons from a container manager host
   */
  async getDaemons(baseUrl: string): Promise<Daemon[]> {
    return fetchWrapper<Daemon[]>(`${baseUrl}/daemons`);
  }

  /**
   * Get all hosts from a container manager host
   */
  async getHosts(baseUrl: string): Promise<Host[]> {
    return fetchWrapper<Host[]>(`${baseUrl}/hosts`);
  }

  /**
   * Get all networks from a container manager host
   */
  async getNetworks(baseUrl: string): Promise<Network[]> {
    return fetchWrapper<Network[]>(`${baseUrl}/networks`);
  }

  /**
   * Create a new network
   */
  async createNetwork(baseUrl: string, params: NetworkCreateParams): Promise<void> {
    return fetchWrapper<void>(`${baseUrl}/networks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
  }

  /**
   * Delete a network
   */
  async deleteNetwork(baseUrl: string, networkName: string): Promise<void> {
    return fetchWrapper<void>(`${baseUrl}/networks/${networkName}`, {
      method: 'DELETE'
    });
  }

  /**
   * Get all GRE tunnels from a container manager host
   */
  async getGreTunnels(baseUrl: string): Promise<GreTunnel[]> {
    return fetchWrapper<GreTunnel[]>(`${baseUrl}/gre-tunnels`);
  }

  /**
   * Create a GRE tunnel between two containers
   */
  async createGreTunnel(
    baseUrl: string,
    containerName: string,
    params: GreTunnelCreateParams
  ): Promise<void> {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });

    return fetchWrapper<void>(
      `${baseUrl}/containers/${containerName}/tunnels?${searchParams.toString()}`,
      { method: 'POST' }
    );
  }

  /**
   * Get backends from a BGP daemon
   */
  async getBackends(baseUrl: string): Promise<any> {
    return fetchWrapper<any>(`${baseUrl}/backends`);
  }

  /**
   * Get lab topology from a container manager host
   */
  async getTopology(baseUrl: string): Promise<any> {
    return fetchWrapper<any>(`${baseUrl}/lab/topology`);
  }

  /**
   * Get suggested daemon configuration
   */
  async getSuggestedDaemonConfig(baseUrl: string): Promise<any> {
    return fetchWrapper<any>(`${baseUrl}/network/suggested-daemon-config`);
  }

  /**
   * Get next available IP for host
   */
  async getNextHostIp(baseUrl: string): Promise<{ ip: string }> {
    return fetchWrapper<{ ip: string }>(`${baseUrl}/network/next-ip`);
  }

  /**
   * Create a new daemon
   */
  async createDaemon(baseUrl: string, params: any): Promise<void> {
    return fetchWrapper<void>(`${baseUrl}/daemons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
  }

  /**
   * Delete a daemon
   */
  async deleteDaemon(baseUrl: string, name: string): Promise<void> {
    return fetchWrapper<void>(`${baseUrl}/daemons/${name}`, {
      method: 'DELETE'
    });
  }

  /**
   * Update a daemon (daemon must be stopped)
   */
  async updateDaemon(baseUrl: string, name: string, params: {
    asn?: number;
    router_id?: string;
    ip_address?: string;
  }): Promise<void> {
    return fetchWrapper<void>(`${baseUrl}/daemons/${name}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
  }

  /**
   * Control daemon (start/stop/restart)
   */
  async controlDaemon(baseUrl: string, name: string, action: 'start' | 'stop' | 'restart'): Promise<void> {
    return fetchWrapper<void>(`${baseUrl}/daemons/${name}/${action}`, {
      method: 'POST'
    });
  }

  /**
   * Create a new host
   */
  async createHost(baseUrl: string, params: any): Promise<void> {
    return fetchWrapper<void>(`${baseUrl}/hosts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
  }

  /**
   * Delete a host
   */
  async deleteHost(baseUrl: string, name: string): Promise<void> {
    return fetchWrapper<void>(`${baseUrl}/hosts/${name}`, {
      method: 'DELETE'
    });
  }

  /**
   * Update a host
   */
  async updateHost(baseUrl: string, name: string, params: {
    gateway_daemon?: string;
    gateway_ip?: string;
    loopback_ip?: string;
    loopback_network?: string;
    container_ip?: string;
  }): Promise<void> {
    return fetchWrapper<void>(`${baseUrl}/hosts/${name}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
  }

  /**
   * Fetch daemons and hosts from multiple container manager instances
   */
  async getContainersFromHosts(hosts: Array<{ url: string; id: string; name: string }>) {
    const results = await Promise.allSettled(
      hosts.map(async (host) => {
        const containers: Array<{
          host_id: string;
          host_name: string;
          name: string;
          type: string;
        }> = [];

        try {
          // Fetch daemons
          const daemons = await this.getDaemons(host.url);
          for (const daemon of daemons) {
            containers.push({
              host_id: host.id,
              host_name: host.name,
              name: daemon.name,
              type: 'daemon'
            });
          }

          // Fetch hosts
          const hostContainers = await this.getHosts(host.url);
          for (const hostContainer of hostContainers) {
            containers.push({
              host_id: host.id,
              host_name: host.name,
              name: hostContainer.name,
              type: 'host'
            });
          }

          return { host, containers };
        } catch (error) {
          console.error(`Failed to fetch containers from ${host.name}:`, error);
          return { host, containers: [] };
        }
      })
    );

    return results
      .filter((result) => result.status === 'fulfilled')
      .map((result) => (result as PromiseFulfilledResult<any>).value);
  }

  /**
   * Fetch networks from multiple hosts
   */
  async getNetworksFromHosts(hosts: Array<{ url: string; id: string; enabled: boolean }>) {
    const networksMap: Record<string, Network[]> = {};

    await Promise.all(
      hosts
        .filter((h) => h.enabled)
        .map(async (host) => {
          try {
            const data = await this.getNetworks(host.url);
            networksMap[host.id] = Array.isArray(data) ? data : [];
          } catch (err) {
            console.error(`Failed to fetch networks from ${host.id}:`, err);
            networksMap[host.id] = [];
          }
        })
    );

    return networksMap;
  }

  /**
   * Fetch GRE tunnels from multiple hosts
   */
  async getGreTunnelsFromHosts(
    hosts: Array<{ url: string; id: string; enabled: boolean }>,
    selectedHostIds: string[]
  ) {
    const greTunnelsMap: Record<string, GreTunnel[]> = {};

    await Promise.all(
      hosts
        .filter((h) => h.enabled && selectedHostIds.includes(h.id))
        .map(async (host) => {
          try {
            const data = await this.getGreTunnels(host.url);
            greTunnelsMap[host.id] = Array.isArray(data) ? data : [];
          } catch (err) {
            console.error(`Failed to fetch GRE tunnels from ${host.id}:`, err);
            greTunnelsMap[host.id] = [];
          }
        })
    );

    return greTunnelsMap;
  }
}

// Export singleton instance
export const containerManagerService = new ContainerManagerService();

// Export class for testing
export default ContainerManagerService;
