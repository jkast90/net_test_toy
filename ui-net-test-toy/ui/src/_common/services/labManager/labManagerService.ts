import { fetchWrapper } from '../../utils/fetchWrapper';

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
  networks?: Array<NetworkInfo | string>;
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
  networks?: Array<NetworkInfo | string>;
  created: string;
}

export interface LabData {
  daemons: LabDaemon[];
  hosts: LabHost[];
}

export interface ExecCommandResult {
  stdout: string;
  stderr: string;
  exit_code: number;
}

class LabManagerService {
  // Query operations
  /**
   * Fetch daemons from a lab manager host
   */
  async getDaemons(baseUrl: string): Promise<LabDaemon[]> {
    return fetchWrapper(`${baseUrl}/daemons`);
  }

  /**
   * Fetch hosts from a lab manager host
   */
  async getHosts(baseUrl: string): Promise<LabHost[]> {
    return fetchWrapper(`${baseUrl}/hosts`);
  }

  /**
   * Fetch both daemons and hosts from a lab manager host
   */
  async getLabData(baseUrl: string): Promise<LabData> {
    const [daemons, hosts] = await Promise.all([
      this.getDaemons(baseUrl),
      this.getHosts(baseUrl)
    ]);

    return {
      daemons: daemons || [],
      hosts: hosts || []
    };
  }

  /**
   * Fetch lab data from multiple hosts
   */
  async getLabDataFromHosts(hosts: Array<{ id: string; url: string; enabled: boolean }>): Promise<
    Array<{
      hostId: string;
      daemons: LabDaemon[];
      hosts: LabHost[];
      status: 'connected' | 'error';
      error?: string;
    }>
  > {
    const enabledHosts = hosts.filter(h => h.enabled);

    const results = await Promise.all(
      enabledHosts.map(async (host) => {
        try {
          const data = await this.getLabData(host.url);
          return {
            hostId: host.id,
            daemons: data.daemons,
            hosts: data.hosts,
            status: 'connected' as const
          };
        } catch (error) {
          return {
            hostId: host.id,
            daemons: [],
            hosts: [],
            status: 'error' as const,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      })
    );

    return results;
  }

  // Mutation operations - Daemons
  /**
   * Create a new daemon
   */
  async createDaemon(
    baseUrl: string,
    config: {
      name: string;
      daemon_type: 'gobgp' | 'frr' | 'exabgp';
      asn?: string;
      router_id?: string;
    }
  ): Promise<LabDaemon> {
    return fetchWrapper(`${baseUrl}/daemons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
  }

  /**
   * Update an existing daemon
   */
  async updateDaemon(
    baseUrl: string,
    daemonId: string,
    config: Partial<LabDaemon>
  ): Promise<LabDaemon> {
    return fetchWrapper(`${baseUrl}/daemons/${daemonId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
  }

  /**
   * Delete a daemon
   */
  async deleteDaemon(baseUrl: string, daemonId: string): Promise<void> {
    return fetchWrapper(`${baseUrl}/daemons/${daemonId}`, {
      method: 'DELETE'
    });
  }

  // Mutation operations - Hosts
  /**
   * Create a new host
   */
  async createHost(
    baseUrl: string,
    config: {
      name: string;
      gateway_daemon?: string;
      loopback_network?: string;
    }
  ): Promise<LabHost> {
    return fetchWrapper(`${baseUrl}/hosts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
  }

  /**
   * Delete a host
   */
  async deleteHost(baseUrl: string, hostId: string): Promise<void> {
    return fetchWrapper(`${baseUrl}/hosts/${hostId}`, {
      method: 'DELETE'
    });
  }

  // Other operations
  /**
   * Execute a command in a container
   */
  async execCommand(
    baseUrl: string,
    containerId: string,
    command: string
  ): Promise<ExecCommandResult> {
    return fetchWrapper(`${baseUrl}/exec/${containerId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command })
    });
  }

  /**
   * Associate a network with a container
   */
  async associateNetwork(
    baseUrl: string,
    containerId: string,
    networkName: string
  ): Promise<void> {
    return fetchWrapper(`${baseUrl}/network/associate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        container_id: containerId,
        network_name: networkName
      })
    });
  }

  /**
   * Restore lab from saved state
   */
  async restoreLab(baseUrl: string): Promise<void> {
    return fetchWrapper(`${baseUrl}/restore-lab`, {
      method: 'POST'
    });
  }
}

export const labManagerService = new LabManagerService();
