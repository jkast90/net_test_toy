// Config Service - Handles application configuration loading
import { fetchWrapper } from '../utils/fetchWrapper';

export interface MonitoringConfig {
  url: string;
  bmp_tcp_port: number | null;
  netflow_udp_port: number | null;
  bmp?: {
    endpoints: {
      peers: string;
      routes: string;
      flowspec: string;
      health: string;
    };
  };
  netflow?: {
    endpoints: {
      stats: string;
      flows: string;
      triggers: string;
      triggered_events: string;
      top_talkers: string;
      conversations: string;
    };
  };
}

export interface DaemonConfig {
  name: string;
  type: string;
  asn: string;
  router_id: string;
  url: string;
  status: string;
  websockets: {
    bgp_stream: string;
    neighbors: string;
    routes: string;
  };
}

export interface HostConfig {
  name: string;
  url: string;
  status: string;
  websockets: {
    tools_start: string;
    tools_active: string;
    traffic_active: string;
  };
}

export interface AppConfig {
  container_manager: {
    url: string;
  };
  monitoring: MonitoringConfig;
  daemons: DaemonConfig[];
  hosts: HostConfig[];
}

class ConfigService {
  private baseUrl: string;

  constructor() {
    // Get the container manager URL from environment
    // No hardcoded default - must be configured via environment variable or setBaseUrl()
    this.baseUrl = import.meta.env.VITE_CONTAINER_MANAGER_URL || '';
  }

  // Fetch the application configuration
  async fetchConfig(suppressLogs = false): Promise<AppConfig> {
    return await fetchWrapper(`${this.baseUrl}/config`, { suppressLogs });
  }

  // Get container manager URL
  getContainerManagerUrl(): string {
    return this.baseUrl;
  }

  // Update base URL (if needed for different environments)
  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  // Probe a URL to check if it's a valid Container Manager
  async probeContainerManager(url: string): Promise<boolean> {
    try {
      const data = await fetchWrapper(`${url}/`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      // Check if the response identifies itself as NetStream Container Management API
      return data?.message?.includes('NetStream Container Management API');
    } catch (error) {
      console.debug(`Failed to probe ${url}:`, error);
      return false;
    }
  }

  // Auto-detect container manager on localhost:5010
  async autoDetectContainerManager(): Promise<boolean> {
    const defaultUrl = 'http://localhost:5010';

    console.log('[ConfigService] Auto-detecting container manager at', defaultUrl);

    const isValid = await this.probeContainerManager(defaultUrl);

    if (isValid) {
      console.log('[ConfigService] Found container manager at', defaultUrl);
      this.setBaseUrl(defaultUrl);
      return true;
    }

    console.log('[ConfigService] No container manager found at', defaultUrl);
    return false;
  }

  // Validate configuration
  validateConfig(config: AppConfig): boolean {
    // Check required fields
    if (!config.container_manager?.url) {
      console.error('Config validation failed: missing container_manager.url');
      return false;
    }

    if (!config.monitoring?.url) {
      console.error('Config validation failed: missing monitoring.url');
      return false;
    }

    // Validate daemons
    if (config.daemons && !Array.isArray(config.daemons)) {
      console.error('Config validation failed: daemons must be an array');
      return false;
    }

    // Validate hosts
    if (config.hosts && !Array.isArray(config.hosts)) {
      console.error('Config validation failed: hosts must be an array');
      return false;
    }

    return true;
  }

  // Get monitoring endpoints with base URL
  getMonitoringEndpoints(config: MonitoringConfig): {
    bmp: Record<string, string>;
    netflow: Record<string, string>;
  } {
    const baseUrl = config.url;

    return {
      bmp: {
        peers: `${baseUrl}${config.bmp.endpoints.peers}`,
        routes: `${baseUrl}${config.bmp.endpoints.routes}`,
        flowspec: `${baseUrl}${config.bmp.endpoints.flowspec}`,
        health: `${baseUrl}${config.bmp.endpoints.health}`
      },
      netflow: {
        stats: `${baseUrl}${config.netflow.endpoints.stats}`,
        flows: `${baseUrl}${config.netflow.endpoints.flows}`,
        triggers: `${baseUrl}${config.netflow.endpoints.triggers}`,
        triggered_events: `${baseUrl}${config.netflow.endpoints.triggered_events}`,
        top_talkers: `${baseUrl}${config.netflow.endpoints.top_talkers}`,
        conversations: `${baseUrl}${config.netflow.endpoints.conversations}`
      }
    };
  }
}

export const configService = new ConfigService();