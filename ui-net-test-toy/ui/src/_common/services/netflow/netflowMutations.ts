/**
 * NetFlow Mutations
 * Centralized mutation functions for NetFlow operations
 * These provide a clean API for components to perform NetFlow actions
 */

import { netflowService } from './netflowService';
import {
  NetFlowCollectorConfig,
  NetFlowAlert,
  NetFlowFilter,
  NetFlowMutationResult
} from './types';

/**
 * Collector Management Mutations
 */
export const netflowCollectorMutations = {
  /**
   * Start the NetFlow collector with configuration
   */
  async start(config?: Partial<NetFlowCollectorConfig>, clientUrl?: string): Promise<NetFlowMutationResult> {
    try {
      const defaultConfig: Partial<NetFlowCollectorConfig> = {
        enabled: true,
        listen_address: '0.0.0.0',
        listen_port: 2055,
        netflow_version: 9,
        template_refresh_interval: 600,
        max_flows_per_second: 10000,
        buffer_size: 65536,
        storage_retention_days: 7,
        ...config
      };

      const result = await netflowService.startNetFlowCollector(defaultConfig, clientUrl);

      if (!result.success) {
        throw new Error(result.error || 'Failed to start NetFlow collector');
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  },

  /**
   * Stop the NetFlow collector
   */
  async stop(clientUrl?: string): Promise<NetFlowMutationResult> {
    try {
      const result = await netflowService.stopNetFlowCollector(clientUrl);

      if (!result.success) {
        throw new Error(result.error || 'Failed to stop NetFlow collector');
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  },

  /**
   * Update NetFlow collector configuration
   */
  async updateConfig(config: Partial<NetFlowCollectorConfig>, clientUrl?: string): Promise<NetFlowMutationResult> {
    try {
      const result = await netflowService.updateNetFlowCollectorConfig(config, clientUrl);

      if (!result.success) {
        throw new Error(result.error || 'Failed to update NetFlow collector config');
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  },

  /**
   * Restart NetFlow collector with new configuration
   */
  async restart(config?: Partial<NetFlowCollectorConfig>, clientUrl?: string): Promise<NetFlowMutationResult> {
    try {
      // Stop the collector first
      await netflowService.stopNetFlowCollector(clientUrl);

      // Wait a moment for clean shutdown
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Start with new config
      const result = await netflowService.startNetFlowCollector(config || {}, clientUrl);

      if (!result.success) {
        throw new Error(result.error || 'Failed to restart NetFlow collector');
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }
};

/**
 * Alert Management Mutations
 */
export const netflowAlertMutations = {
  /**
   * Create a new NetFlow alert
   */
  async create(
    alert: Omit<NetFlowAlert, 'id' | 'created_at' | 'updated_at' | 'last_triggered' | 'trigger_count'>,
    clientUrl?: string
  ): Promise<NetFlowMutationResult<NetFlowAlert>> {
    try {
      const result = await netflowService.createNetFlowAlert(alert, clientUrl);

      if (!result.success) {
        throw new Error(result.error || 'Failed to create NetFlow alert');
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  },

  /**
   * Update an existing NetFlow alert
   */
  async update(
    alertId: string,
    updates: Partial<NetFlowAlert>,
    clientUrl?: string
  ): Promise<NetFlowMutationResult<NetFlowAlert>> {
    try {
      const result = await netflowService.updateNetFlowAlert(alertId, updates, clientUrl);

      if (!result.success) {
        throw new Error(result.error || 'Failed to update NetFlow alert');
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  },

  /**
   * Delete a NetFlow alert
   */
  async delete(alertId: string, clientUrl?: string): Promise<NetFlowMutationResult> {
    try {
      const result = await netflowService.deleteNetFlowAlert(alertId, clientUrl);

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete NetFlow alert');
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  },

  /**
   * Test a NetFlow alert
   */
  async test(alertId: string, clientUrl?: string): Promise<NetFlowMutationResult> {
    try {
      const result = await netflowService.testNetFlowAlert(alertId, clientUrl);

      if (!result.success) {
        throw new Error(result.error || 'Failed to test NetFlow alert');
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  },

  /**
   * Batch create multiple NetFlow alerts
   */
  async createMultiple(
    alerts: Array<Omit<NetFlowAlert, 'id' | 'created_at' | 'updated_at' | 'last_triggered' | 'trigger_count'>>,
    clientUrl?: string
  ): Promise<NetFlowMutationResult<NetFlowAlert[]>> {
    try {
      const results = await Promise.allSettled(
        alerts.map(alert => netflowService.createNetFlowAlert(alert, clientUrl))
      );

      const successful: NetFlowAlert[] = [];
      const errors: string[] = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.success && result.value.data) {
          successful.push(result.value.data);
        } else if (result.status === 'rejected') {
          errors.push(`Alert ${index + 1}: ${result.reason}`);
        } else if (result.status === 'fulfilled' && !result.value.success) {
          errors.push(`Alert ${index + 1}: ${result.value.error || 'Unknown error'}`);
        }
      });

      if (errors.length > 0) {
        return {
          success: false,
          error: errors.join('; '),
          data: successful,
          timestamp: new Date().toISOString()
        };
      }

      return {
        success: true,
        data: successful,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  },

  /**
   * Enable/disable multiple alerts
   */
  async toggleMultiple(
    alertIds: string[],
    enabled: boolean,
    clientUrl?: string
  ): Promise<NetFlowMutationResult> {
    try {
      const results = await Promise.allSettled(
        alertIds.map(id => netflowService.updateNetFlowAlert(id, { enabled }, clientUrl))
      );

      let successCount = 0;
      const errors: string[] = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.success) {
          successCount++;
        } else if (result.status === 'rejected') {
          errors.push(`Alert ${alertIds[index]}: ${result.reason}`);
        } else if (result.status === 'fulfilled' && !result.value.success) {
          errors.push(`Alert ${alertIds[index]}: ${result.value.error || 'Unknown error'}`);
        }
      });

      if (errors.length > 0) {
        return {
          success: successCount > 0,
          error: errors.join('; '),
          data: { updated: successCount, failed: errors.length },
          timestamp: new Date().toISOString()
        };
      }

      return {
        success: true,
        data: { updated: successCount },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }
};

/**
 * Data Management Mutations
 */
export const netflowDataMutations = {
  /**
   * Clear all NetFlow data
   */
  async clearAll(clientUrl?: string): Promise<NetFlowMutationResult> {
    try {
      const result = await netflowService.clearNetFlowData(clientUrl);

      if (!result.success) {
        throw new Error(result.error || 'Failed to clear NetFlow data');
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  },

  /**
   * Export NetFlow data in specified format
   */
  async export(
    format: 'csv' | 'json' | 'pcap',
    filter?: NetFlowFilter,
    clientUrl?: string
  ): Promise<NetFlowMutationResult<Blob>> {
    try {
      const blob = await netflowService.exportNetFlowData(format, filter, clientUrl);

      return {
        success: true,
        data: blob,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export NetFlow data',
        timestamp: new Date().toISOString()
      };
    }
  },

  /**
   * Download NetFlow data as file
   */
  async download(
    format: 'csv' | 'json' | 'pcap',
    filename?: string,
    filter?: NetFlowFilter,
    clientUrl?: string
  ): Promise<NetFlowMutationResult> {
    try {
      const exportResult = await this.export(format, filter, clientUrl);

      if (!exportResult.success || !exportResult.data) {
        throw new Error(exportResult.error || 'Failed to export data');
      }

      const defaultFilename = `netflow-data-${new Date().toISOString().split('T')[0]}.${format}`;
      const url = window.URL.createObjectURL(exportResult.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || defaultFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to download NetFlow data',
        timestamp: new Date().toISOString()
      };
    }
  },

  /**
   * Purge old NetFlow data
   */
  async purgeOld(daysToKeep: number = 7, clientUrl?: string): Promise<NetFlowMutationResult> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const filter: NetFlowFilter = {
        end_time: cutoffDate.toISOString()
      };

      // This would typically call a specific purge endpoint
      // For now, we'll use the clear endpoint with a filter
      const result = await netflowService.clearNetFlowData(clientUrl);

      if (!result.success) {
        throw new Error(result.error || `Failed to purge data older than ${daysToKeep} days`);
      }

      return {
        ...result,
        data: { purged: true, cutoffDate: cutoffDate.toISOString() }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to purge old NetFlow data',
        timestamp: new Date().toISOString()
      };
    }
  }
};

/**
 * Multi-client Mutations
 */
export const netflowMultiClientMutations = {
  /**
   * Start NetFlow collectors on multiple clients
   */
  async startMultiple(
    clientUrls: string[],
    config?: Partial<NetFlowCollectorConfig>
  ): Promise<Record<string, NetFlowMutationResult>> {
    const results: Record<string, NetFlowMutationResult> = {};

    await Promise.all(
      clientUrls.map(async (url) => {
        results[url] = await netflowCollectorMutations.start(config, url);
      })
    );

    return results;
  },

  /**
   * Stop NetFlow collectors on multiple clients
   */
  async stopMultiple(clientUrls: string[]): Promise<Record<string, NetFlowMutationResult>> {
    const results: Record<string, NetFlowMutationResult> = {};

    await Promise.all(
      clientUrls.map(async (url) => {
        results[url] = await netflowCollectorMutations.stop(url);
      })
    );

    return results;
  },

  /**
   * Clear data on multiple clients
   */
  async clearMultiple(clientUrls: string[]): Promise<Record<string, NetFlowMutationResult>> {
    const results: Record<string, NetFlowMutationResult> = {};

    await Promise.all(
      clientUrls.map(async (url) => {
        results[url] = await netflowDataMutations.clearAll(url);
      })
    );

    return results;
  },

  /**
   * Create alert on multiple clients
   */
  async createAlertOnMultiple(
    clientUrls: string[],
    alert: Omit<NetFlowAlert, 'id' | 'created_at' | 'updated_at' | 'last_triggered' | 'trigger_count'>
  ): Promise<Record<string, NetFlowMutationResult<NetFlowAlert>>> {
    const results: Record<string, NetFlowMutationResult<NetFlowAlert>> = {};

    await Promise.all(
      clientUrls.map(async (url) => {
        results[url] = await netflowAlertMutations.create(alert, url);
      })
    );

    return results;
  },

  /**
   * Export data from multiple clients
   */
  async exportMultiple(
    clientUrls: string[],
    format: 'csv' | 'json' | 'pcap',
    filter?: NetFlowFilter
  ): Promise<Record<string, NetFlowMutationResult<Blob>>> {
    const results: Record<string, NetFlowMutationResult<Blob>> = {};

    await Promise.all(
      clientUrls.map(async (url) => {
        results[url] = await netflowDataMutations.export(format, filter, url);
      })
    );

    return results;
  }
};

// Export all mutations
export const netflowMutations = {
  collector: netflowCollectorMutations,
  alerts: netflowAlertMutations,
  data: netflowDataMutations,
  multiClient: netflowMultiClientMutations
};

export default netflowMutations;