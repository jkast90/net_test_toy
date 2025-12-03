/**
 * BMP Service Layer
 * Handles all API operations for BGP Monitoring Protocol
 *
 * All requests are proxied through the Container Manager API at /proxy/monitoring/bmp/*
 * The container manager auto-discovers the monitoring service and routes requests.
 */

import { fetchWrapper } from '../../utils/fetchWrapper';
import {
  BMPData,
  BMPPeer,
  BMPRoute,
  BMPFlowSpecRule,
  BMPFilter,
  BMPStats,
  BMPMessage,
  BMPServerConfig,
  BMPMutationResult
} from './types';

class BMPService {
  private containerManagerUrl: string = '';

  // Set the container manager URL
  setContainerManagerUrl(url: string) {
    this.containerManagerUrl = url.replace(/\/$/, ''); // Remove trailing slash
  }

  // Get proxied endpoint URL through container manager
  // Container manager handles routing to the auto-discovered monitoring service
  private getProxiedUrl(path: string): string {
    if (!this.containerManagerUrl) {
      throw new Error('Container Manager URL not configured. Please configure container manager first.');
    }

    // Build proxy URL: http://localhost:5010/proxy/monitoring/bmp/peers
    return `${this.containerManagerUrl}/proxy/monitoring/${path}`;
  }

  // Get URL for a given path, optionally using clientUrl
  private getUrl(path: string, clientUrl?: string): string {
    const baseUrl = clientUrl || this.containerManagerUrl || 'http://localhost:5010';
    return `${baseUrl.replace(/\/$/, '')}/proxy/monitoring/${path}`;
  }

  // Query operations
  async getBMPData(_clientUrl?: string): Promise<BMPData> {
    // Fetch all data in parallel
    const [peers, routes, flowspecRules] = await Promise.all([
      this.getBMPPeers().catch(() => []),
      this.getBMPRoutesMap().catch(() => ({})),
      this.getBMPFlowSpecRules().catch(() => ([]))
    ]);

    return {
      peers,
      routes,
      flowspec: {
        count: flowspecRules.length,
        rules: flowspecRules
      },
      stats: {
        total_peers: peers.length,
        active_peers: peers.filter(p => p.state === 'up').length,
        total_routes: Object.values(routes).reduce((sum, r) => sum + r.advertised.length + r.received.length, 0),
        total_prefixes: Object.values(routes).reduce((sum, r) => sum + r.advertised.length, 0),
        messages_per_second: 0,
        last_update: new Date().toISOString()
      },
      messages: []
    };
  }

  async getBMPPeers(): Promise<BMPPeer[]> {
    const url = this.getProxiedUrl('bmp/peers');
    const response = await fetchWrapper<{ peers: BMPPeer[] }>(url);
    return response.peers || [];
  }

  async getBMPPeer(peerId: string): Promise<BMPPeer> {
    const url = this.getProxiedUrl(`bmp/peers/${peerId}`);
    return fetchWrapper<BMPPeer>(url);
  }

  async getBMPRoutes(peerAddress?: string): Promise<BMPRoute[]> {
    let url = this.getProxiedUrl('bmp/routes');
    if (peerAddress) {
      url += `?peer=${peerAddress}`;
    }
    return fetchWrapper<BMPRoute[]>(url);
  }

  async getBMPRoutesMap(): Promise<{ [key: string]: { advertised: BMPRoute[]; received: BMPRoute[]; } }> {
    const url = this.getProxiedUrl('bmp/routes');
    const response = await fetchWrapper<{ routes: { [key: string]: { advertised: BMPRoute[]; received: BMPRoute[]; } } }>(url);
    return response.routes || {};
  }

  async getBMPFlowSpecRules(): Promise<BMPFlowSpecRule[]> {
    const url = this.getProxiedUrl('bmp/flowspec');
    return fetchWrapper<BMPFlowSpecRule[]>(url);
  }

  async getBMPHealth(): Promise<{ status: string; uptime: number }> {
    const url = this.getProxiedUrl('bmp/health');
    return fetchWrapper<{ status: string; uptime: number }>(url);
  }

  async getBMPStats(): Promise<BMPStats> {
    const url = this.getProxiedUrl('bmp/stats');
    return fetchWrapper<BMPStats>(url);
  }

  async getBMPMessages(limit: number = 100): Promise<BMPMessage[]> {
    const url = this.getProxiedUrl(`bmp/messages?limit=${limit}`);
    return fetchWrapper<BMPMessage[]>(url);
  }

  async getBMPServerConfig(): Promise<BMPServerConfig> {
    const url = this.getProxiedUrl('bmp/config');
    return fetchWrapper<BMPServerConfig>(url);
  }

  // Mutation operations
  async startBMPServer(config: Partial<BMPServerConfig>, clientUrl?: string): Promise<BMPMutationResult<BMPServerConfig>> {
    const url = this.getUrl('bmp/start', clientUrl);
    return fetchWrapper<BMPMutationResult<BMPServerConfig>>(url, {
      method: 'POST',
      body: JSON.stringify(config)
    });
  }

  async stopBMPServer(clientUrl?: string): Promise<BMPMutationResult> {
    const url = this.getUrl('bmp/stop', clientUrl);
    return fetchWrapper<BMPMutationResult>(url, {
      method: 'POST'
    });
  }

  async updateBMPServerConfig(config: Partial<BMPServerConfig>, clientUrl?: string): Promise<BMPMutationResult<BMPServerConfig>> {
    const url = this.getUrl('bmp/config', clientUrl);
    return fetchWrapper<BMPMutationResult<BMPServerConfig>>(url, {
      method: 'PUT',
      body: JSON.stringify(config)
    });
  }

  async clearBMPData(clientUrl?: string): Promise<BMPMutationResult> {
    const url = this.getUrl('bmp/clear', clientUrl);
    return fetchWrapper<BMPMutationResult>(url, {
      method: 'POST'
    });
  }

  async deleteBMPFlowSpecRule(ruleId: string, clientUrl?: string): Promise<BMPMutationResult> {
    const url = this.getUrl(`bmp/flowspec/${ruleId}`, clientUrl);
    return fetchWrapper<BMPMutationResult>(url, {
      method: 'DELETE'
    });
  }

  async addBMPFlowSpecRule(rule: Omit<BMPFlowSpecRule, 'id' | 'timestamp'>, clientUrl?: string): Promise<BMPMutationResult<BMPFlowSpecRule>> {
    const url = this.getUrl('bmp/flowspec', clientUrl);
    return fetchWrapper<BMPMutationResult<BMPFlowSpecRule>>(url, {
      method: 'POST',
      body: JSON.stringify(rule)
    });
  }

  /**
   * Connect to BMP WebSocket stream via Container Manager proxy
   * @param containerManagerUrl - Container Manager base URL (e.g., 'http://localhost:5010')
   * @param onMessage - Callback for handling incoming messages
   * @returns WebSocket instance
   */
  connectWebSocket(containerManagerUrl: string | undefined, onMessage: (message: BMPMessage) => void): WebSocket | null {
    if (!containerManagerUrl) {
      console.warn('[BMPService] No container manager URL provided for WebSocket connection');
      return null;
    }

    // Convert HTTP URL to WebSocket URL
    const wsUrl = containerManagerUrl.replace(/^http/, 'ws') + '/ws/bmp';

    console.log('[BMPService] Connecting to BMP WebSocket via Container Manager:', wsUrl);

    try {
      const ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as BMPMessage;
          onMessage(message);
        } catch (error) {
          console.error('[BMPService] Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[BMPService] WebSocket error:', error);
      };

      return ws;
    } catch (error) {
      console.error('[BMPService] Failed to create WebSocket connection:', error);
      return null;
    }
  }
}

// Export singleton instance
export const bmpService = new BMPService();

// Export class for testing
export default BMPService;