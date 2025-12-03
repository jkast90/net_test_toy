/**
 * NetFlow Service Layer
 * Handles all API operations for NetFlow data collection and analysis
 *
 * All requests are proxied through the Container Manager API at /proxy/monitoring/*
 * The container manager auto-discovers the monitoring service and routes requests.
 */

import { fetchWrapper } from '../../utils/fetchWrapper';
import {
  NetFlowData,
  NetFlowRecord,
  NetFlowStats,
  NetFlowExporter,
  NetFlowAlert,
  NetFlowCollectorConfig,
  NetFlowFilter,
  NetFlowAggregation,
  NetFlowAnalysis,
  NetFlowTimeSeriesData,
  NetFlowMutationResult
} from './types';

class NetFlowService {
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

    // Build proxy URL: http://localhost:5010/proxy/monitoring/triggered_events
    return `${this.containerManagerUrl}/proxy/monitoring/${path}`;
  }

  // Get URL for a given path, optionally using clientUrl
  private getUrl(path: string, clientUrl?: string): string {
    const baseUrl = clientUrl || this.containerManagerUrl || 'http://localhost:5010';
    return `${baseUrl.replace(/\/$/, '')}/proxy/monitoring${path}`;
  }

  // Query operations
  async getNetFlowData(clientUrl?: string, filter?: NetFlowFilter): Promise<NetFlowData> {
    try {
      // Fetch all data in parallel
      const [stats, flowsData, exporters] = await Promise.all([
        this.getNetFlowStats(clientUrl),
        this.getNetFlowRecords(filter, clientUrl),
        this.getNetFlowExporters(clientUrl).catch(() => [])
      ]);

      return {
        records: flowsData,
        stats,
        exporters,
        alerts: [], // Alerts endpoint may not be available
        config: {
          enabled: true,
          listen_address: '0.0.0.0',
          listen_port: 2055,
          netflow_version: 5,
          storage_retention_days: 7
        }
      };
    } catch (error) {
      // Return empty data structure on error
      return {
        records: [],
        stats: {
          total_flows: 0,
          active_flows: 0,
          total_bytes: 0,
          total_packets: 0,
          flows_per_second: 0,
          bytes_per_second: 0,
          packets_per_second: 0,
          top_talkers: [],
          top_protocols: [],
          last_update: new Date().toISOString()
        },
        exporters: [],
        alerts: [],
        config: {
          enabled: false,
          listen_address: '0.0.0.0',
          listen_port: 2055,
          netflow_version: 5,
          storage_retention_days: 7
        }
      };
    }
  }

  async getNetFlowRecords(filter?: NetFlowFilter, clientUrl?: string): Promise<NetFlowRecord[]> {
    const params = new URLSearchParams();
    if (filter) {
      if (filter.limit) params.append('limit', String(filter.limit));
      // Map other filter params as needed
    } else {
      params.append('limit', '50');
    }

    const url = this.getProxiedUrl('netflow/flows');
    const urlWithParams = params.toString() ? `${url}?${params.toString()}` : url;
    const response = await fetchWrapper<{ flows: NetFlowRecord[] }>(urlWithParams);
    return response.flows || [];
  }

  async getNetFlowStats(clientUrl?: string): Promise<NetFlowStats> {
    const url = this.getProxiedUrl('netflow/stats');
    return fetchWrapper<NetFlowStats>(url);
  }

  async getNetFlowExporters(clientUrl?: string): Promise<NetFlowExporter[]> {
    // The exporters info comes from stats endpoint
    const stats = await this.getNetFlowStats(clientUrl);
    const exporters: NetFlowExporter[] = [];

    // Convert stats.exporters format to NetFlowExporter array
    // This is a placeholder - actual implementation depends on API response
    return exporters;
  }

  async getNetFlowAlerts(clientUrl?: string): Promise<NetFlowAlert[]> {
    // Alerts may not be available in basic NetFlow setup
    return [];
  }

  async getTriggeredEvents(limit: number = 50, clientUrl?: string, suppressLogs: boolean = true): Promise<any[]> {
    const url = this.getProxiedUrl('netflow/triggered_events');
    const urlWithParams = `${url}?limit=${limit}`;
    const response = await fetchWrapper<{ events: any[] }>(urlWithParams, { suppressLogs });
    return response.events || [];
  }

  async getTopTalkers(limit: number = 10, metric: string = 'bytes', clientUrl?: string): Promise<any[]> {
    try {
      const url = this.getProxiedUrl('netflow/top_talkers');
      const urlWithParams = `${url}?limit=${limit}&metric=${metric}`;
      const response = await fetchWrapper<{ talkers: any[] }>(urlWithParams);
      return response.talkers || [];
    } catch (error) {
      console.error('Failed to fetch top talkers:', error);
      return [];
    }
  }

  async getConversations(limit: number = 10, clientUrl?: string): Promise<any[]> {
    try {
      const url = this.getProxiedUrl('netflow/conversations');
      const urlWithParams = `${url}?limit=${limit}`;
      const response = await fetchWrapper<{ conversations: any[] }>(urlWithParams);
      return response.conversations || [];
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
      return [];
    }
  }

  async getNetFlowCollectorConfig(clientUrl?: string): Promise<NetFlowCollectorConfig> {
    // Config endpoint may not exist, return defaults
    return {
      enabled: true,
      listen_address: '0.0.0.0',
      listen_port: 2055,
      netflow_version: 5,
      storage_retention_days: 7
    };
  }

  async getNetFlowAnalysis(
    aggregation?: NetFlowAggregation,
    filter?: NetFlowFilter,
    clientUrl?: string
  ): Promise<NetFlowAnalysis> {
    const params = new URLSearchParams();

    if (aggregation) {
      params.append('aggregation_type', aggregation.type);
      if (aggregation.interval) {
        params.append('interval', aggregation.interval);
      }
      if (aggregation.top_n) {
        params.append('top_n', String(aggregation.top_n));
      }
    }

    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      });
    }

    const url = this.getUrl(`/analysis${params.toString() ? '?' + params.toString() : ''}`, clientUrl);
    return fetchWrapper<NetFlowAnalysis>(url);
  }

  async getNetFlowTimeSeries(
    interval: string = '5m',
    duration: string = '1h',
    clientUrl?: string
  ): Promise<NetFlowTimeSeriesData[]> {
    const params = new URLSearchParams();
    params.append('interval', interval);
    params.append('duration', duration);

    const url = this.getUrl(`/timeseries?${params.toString()}`, clientUrl);
    return fetchWrapper<NetFlowTimeSeriesData[]>(url);
  }

  // Mutation operations
  async startNetFlowCollector(
    config: Partial<NetFlowCollectorConfig>,
    clientUrl?: string
  ): Promise<NetFlowMutationResult> {
    return fetchWrapper<NetFlowMutationResult>(
      this.getUrl('/collector/start', clientUrl),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      }
    );
  }

  async stopNetFlowCollector(clientUrl?: string): Promise<NetFlowMutationResult> {
    return fetchWrapper<NetFlowMutationResult>(
      this.getUrl('/collector/stop', clientUrl),
      { method: 'POST' }
    );
  }

  async updateNetFlowCollectorConfig(
    config: Partial<NetFlowCollectorConfig>,
    clientUrl?: string
  ): Promise<NetFlowMutationResult> {
    return fetchWrapper<NetFlowMutationResult>(
      this.getUrl('/config', clientUrl),
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      }
    );
  }

  async clearNetFlowData(clientUrl?: string): Promise<NetFlowMutationResult> {
    return fetchWrapper<NetFlowMutationResult>(
      this.getUrl('/data', clientUrl),
      { method: 'DELETE' }
    );
  }

  async createNetFlowAlert(
    alert: Omit<NetFlowAlert, 'id' | 'created_at' | 'updated_at' | 'last_triggered' | 'trigger_count'>,
    clientUrl?: string
  ): Promise<NetFlowMutationResult<NetFlowAlert>> {
    return fetchWrapper<NetFlowMutationResult<NetFlowAlert>>(
      this.getUrl('/alerts', clientUrl),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alert)
      }
    );
  }

  async updateNetFlowAlert(
    alertId: string,
    updates: Partial<NetFlowAlert>,
    clientUrl?: string
  ): Promise<NetFlowMutationResult<NetFlowAlert>> {
    return fetchWrapper<NetFlowMutationResult<NetFlowAlert>>(
      this.getUrl(`/alerts/${alertId}`, clientUrl),
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      }
    );
  }

  async deleteNetFlowAlert(alertId: string, clientUrl?: string): Promise<NetFlowMutationResult> {
    return fetchWrapper<NetFlowMutationResult>(
      this.getUrl(`/alerts/${alertId}`, clientUrl),
      { method: 'DELETE' }
    );
  }

  async testNetFlowAlert(alertId: string, clientUrl?: string): Promise<NetFlowMutationResult> {
    return fetchWrapper<NetFlowMutationResult>(
      this.getUrl(`/alerts/${alertId}/test`, clientUrl),
      { method: 'POST' }
    );
  }

  // Export operations
  async exportNetFlowData(
    format: 'csv' | 'json' | 'pcap',
    filter?: NetFlowFilter,
    clientUrl?: string
  ): Promise<Blob> {
    const params = new URLSearchParams();
    params.append('format', format);

    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      });
    }

    const url = this.getUrl(`/export?${params.toString()}`, clientUrl);
    return await fetchWrapper<Blob>(url, { responseType: 'blob' });
  }

  // WebSocket support for real-time NetFlow data via Container Manager proxy
  connectWebSocket(
    containerManagerUrl?: string,
    onMessage?: (data: NetFlowRecord) => void,
    filter?: NetFlowFilter
  ): WebSocket | null {
    if (!containerManagerUrl) {
      console.warn('[NetFlowService] No container manager URL provided for WebSocket connection');
      return null;
    }

    // Connect to Container Manager's NetFlow FLOWS proxy endpoint (for raw flow data)
    // Note: /ws/netflow is for trigger notifications, /ws/netflow/flows is for actual flow data
    const wsUrl = containerManagerUrl.replace(/^http/, 'ws') + '/ws/netflow/flows';

    const params = new URLSearchParams();
    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      });
    }

    const finalWsUrl = params.toString() ? `${wsUrl}?${params.toString()}` : wsUrl;

    console.log('[NetFlowService] Connecting to NetFlow WebSocket via Container Manager:', finalWsUrl);

    try {
      const ws = new WebSocket(finalWsUrl);

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          // Handle different message types from the monitoring service
          if (message.type === 'flow' && message.data) {
            // Raw flow data
            onMessage?.(message.data);
          } else if (message.type === 'connected' || message.type === 'pong') {
            // Connection/keepalive messages - ignore
            console.debug('[NetFlowService] WebSocket:', message.type);
          } else {
            // Legacy format or unknown - try to use as-is
            onMessage?.(message);
          }
        } catch (error) {
          console.error('[NetFlowService] Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[NetFlowService] WebSocket error:', error);
      };

      return ws;
    } catch (error) {
      console.error('[NetFlowService] Failed to create WebSocket connection:', error);
      return null;
    }
  }

  // Multi-client operations
  async getNetFlowDataFromMultipleClients(
    clientUrls: string[],
    filter?: NetFlowFilter
  ): Promise<Record<string, NetFlowData | Error>> {
    const promises = clientUrls.map(async (url) => {
      try {
        const data = await this.getNetFlowData(url, filter);
        return { url, data };
      } catch (error) {
        return { url, error };
      }
    });

    const results = await Promise.allSettled(promises);
    const aggregated: Record<string, NetFlowData | Error> = {};

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        const { url, data, error } = result.value as any;
        aggregated[url] = error || data;
      }
    });

    return aggregated;
  }

  // Aggregated analysis across multiple clients
  async getAggregatedNetFlowAnalysis(
    clientUrls: string[],
    aggregation?: NetFlowAggregation,
    filter?: NetFlowFilter
  ): Promise<NetFlowAnalysis> {
    const clientAnalyses = await Promise.all(
      clientUrls.map(url => this.getNetFlowAnalysis(aggregation, filter, url))
    );

    // Merge analyses from multiple clients
    const merged: NetFlowAnalysis = {
      time_series: [],
      top_conversations: [],
      protocol_distribution: [],
      port_distribution: [],
      geographic_distribution: []
    };

    // Combine time series data
    const timeSeriesMap = new Map<string, NetFlowTimeSeriesData>();
    clientAnalyses.forEach(analysis => {
      analysis.time_series.forEach(point => {
        const existing = timeSeriesMap.get(point.timestamp);
        if (existing) {
          existing.bytes += point.bytes;
          existing.packets += point.packets;
          existing.flows += point.flows;
        } else {
          timeSeriesMap.set(point.timestamp, { ...point });
        }
      });
    });
    merged.time_series = Array.from(timeSeriesMap.values())
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    // Combine and sort top conversations
    const conversationMap = new Map<string, typeof merged.top_conversations[0]>();
    clientAnalyses.forEach(analysis => {
      analysis.top_conversations.forEach(conv => {
        const key = `${conv.source_ip}-${conv.destination_ip}`;
        const existing = conversationMap.get(key);
        if (existing) {
          existing.bytes += conv.bytes;
          existing.packets += conv.packets;
          existing.flows += conv.flows;
          existing.protocols = Array.from(new Set([...existing.protocols, ...conv.protocols]));
        } else {
          conversationMap.set(key, { ...conv });
        }
      });
    });
    merged.top_conversations = Array.from(conversationMap.values())
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, aggregation?.top_n || 10);

    // Combine protocol distribution
    const protocolMap = new Map<number, typeof merged.protocol_distribution[0]>();
    clientAnalyses.forEach(analysis => {
      analysis.protocol_distribution.forEach(proto => {
        const existing = protocolMap.get(proto.protocol);
        if (existing) {
          existing.bytes += proto.bytes;
          existing.packets += proto.packets;
          existing.flow_count += proto.flow_count;
        } else {
          protocolMap.set(proto.protocol, { ...proto });
        }
      });
    });

    // Recalculate percentages
    const totalBytes = Array.from(protocolMap.values()).reduce((sum, p) => sum + p.bytes, 0);
    merged.protocol_distribution = Array.from(protocolMap.values())
      .map(proto => ({ ...proto, percentage: (proto.bytes / totalBytes) * 100 }))
      .sort((a, b) => b.bytes - a.bytes);

    return merged;
  }
}

// Export singleton instance
export const netflowService = new NetFlowService();

// Export class for testing
export default NetFlowService;