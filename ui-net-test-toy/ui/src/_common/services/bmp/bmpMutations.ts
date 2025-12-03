/**
 * BMP Mutations
 * Centralized mutation functions for BMP operations
 * These provide a clean API for components to perform BMP actions
 */

import { bmpService } from './bmpService';
import {
  BMPServerConfig,
  BMPFlowSpecRule,
  BMPMutationResult
} from './types';

/**
 * Server Management Mutations
 */
export const bmpServerMutations = {
  /**
   * Start the BMP server with configuration
   */
  async start(config?: Partial<BMPServerConfig>, clientUrl?: string): Promise<BMPMutationResult> {
    try {
      const defaultConfig: Partial<BMPServerConfig> = {
        enabled: true,
        listen_address: '0.0.0.0',
        listen_port: 11019,
        max_connections: 100,
        buffer_size: 4096,
        ...config
      };

      const result = await bmpService.startBMPServer(defaultConfig, clientUrl);

      if (!result.success) {
        throw new Error(result.error || 'Failed to start BMP server');
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
   * Stop the BMP server
   */
  async stop(clientUrl?: string): Promise<BMPMutationResult> {
    try {
      const result = await bmpService.stopBMPServer(clientUrl);

      if (!result.success) {
        throw new Error(result.error || 'Failed to stop BMP server');
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
   * Update BMP server configuration
   */
  async updateConfig(config: Partial<BMPServerConfig>, clientUrl?: string): Promise<BMPMutationResult> {
    try {
      const result = await bmpService.updateBMPServerConfig(config, clientUrl);

      if (!result.success) {
        throw new Error(result.error || 'Failed to update BMP server config');
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
   * Restart BMP server with new configuration
   */
  async restart(config?: Partial<BMPServerConfig>, clientUrl?: string): Promise<BMPMutationResult> {
    try {
      // Stop the server first
      await bmpService.stopBMPServer(clientUrl);

      // Wait a moment for clean shutdown
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Start with new config
      const result = await bmpService.startBMPServer(config || {}, clientUrl);

      if (!result.success) {
        throw new Error(result.error || 'Failed to restart BMP server');
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
 * FlowSpec Rule Mutations
 */
export const bmpFlowSpecMutations = {
  /**
   * Add a new FlowSpec rule
   */
  async addRule(
    rule: Omit<BMPFlowSpecRule, 'id' | 'timestamp'>,
    clientUrl?: string
  ): Promise<BMPMutationResult<BMPFlowSpecRule>> {
    try {
      const result = await bmpService.addBMPFlowSpecRule(rule, clientUrl);

      if (!result.success) {
        throw new Error(result.error || 'Failed to add FlowSpec rule');
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
   * Delete a FlowSpec rule
   */
  async deleteRule(ruleId: string, clientUrl?: string): Promise<BMPMutationResult> {
    try {
      const result = await bmpService.deleteBMPFlowSpecRule(ruleId, clientUrl);

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete FlowSpec rule');
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
   * Batch add multiple FlowSpec rules
   */
  async addMultipleRules(
    rules: Array<Omit<BMPFlowSpecRule, 'id' | 'timestamp'>>,
    clientUrl?: string
  ): Promise<BMPMutationResult<BMPFlowSpecRule[]>> {
    try {
      const results = await Promise.allSettled(
        rules.map(rule => bmpService.addBMPFlowSpecRule(rule, clientUrl))
      );

      const successful: BMPFlowSpecRule[] = [];
      const errors: string[] = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.success && result.value.data) {
          successful.push(result.value.data);
        } else if (result.status === 'rejected') {
          errors.push(`Rule ${index + 1}: ${result.reason}`);
        } else if (result.status === 'fulfilled' && !result.value.success) {
          errors.push(`Rule ${index + 1}: ${result.value.error || 'Unknown error'}`);
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
   * Batch delete multiple FlowSpec rules
   */
  async deleteMultipleRules(ruleIds: string[], clientUrl?: string): Promise<BMPMutationResult> {
    try {
      const results = await Promise.allSettled(
        ruleIds.map(id => bmpService.deleteBMPFlowSpecRule(id, clientUrl))
      );

      let successCount = 0;
      const errors: string[] = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.success) {
          successCount++;
        } else if (result.status === 'rejected') {
          errors.push(`Rule ${ruleIds[index]}: ${result.reason}`);
        } else if (result.status === 'fulfilled' && !result.value.success) {
          errors.push(`Rule ${ruleIds[index]}: ${result.value.error || 'Unknown error'}`);
        }
      });

      if (errors.length > 0) {
        return {
          success: successCount > 0,
          error: errors.join('; '),
          data: { deleted: successCount, failed: errors.length },
          timestamp: new Date().toISOString()
        };
      }

      return {
        success: true,
        data: { deleted: successCount },
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
export const bmpDataMutations = {
  /**
   * Clear all BMP data
   */
  async clearAll(clientUrl?: string): Promise<BMPMutationResult> {
    try {
      const result = await bmpService.clearBMPData(clientUrl);

      if (!result.success) {
        throw new Error(result.error || 'Failed to clear BMP data');
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
   * Export BMP data to file
   */
  async exportData(clientUrl?: string): Promise<BMPMutationResult<Blob>> {
    try {
      const data = await bmpService.getBMPData(clientUrl);

      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });

      return {
        success: true,
        data: blob,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export BMP data',
        timestamp: new Date().toISOString()
      };
    }
  },

  /**
   * Download BMP data as file
   */
  async downloadData(filename: string = 'bmp-data.json', clientUrl?: string): Promise<BMPMutationResult> {
    try {
      const exportResult = await this.exportData(clientUrl);

      if (!exportResult.success || !exportResult.data) {
        throw new Error(exportResult.error || 'Failed to export data');
      }

      const url = window.URL.createObjectURL(exportResult.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
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
        error: error instanceof Error ? error.message : 'Failed to download BMP data',
        timestamp: new Date().toISOString()
      };
    }
  }
};

/**
 * Multi-client Mutations
 */
export const bmpMultiClientMutations = {
  /**
   * Start BMP servers on multiple clients
   */
  async startMultiple(
    clientUrls: string[],
    config?: Partial<BMPServerConfig>
  ): Promise<Record<string, BMPMutationResult>> {
    const results: Record<string, BMPMutationResult> = {};

    await Promise.all(
      clientUrls.map(async (url) => {
        results[url] = await bmpServerMutations.start(config, url);
      })
    );

    return results;
  },

  /**
   * Stop BMP servers on multiple clients
   */
  async stopMultiple(clientUrls: string[]): Promise<Record<string, BMPMutationResult>> {
    const results: Record<string, BMPMutationResult> = {};

    await Promise.all(
      clientUrls.map(async (url) => {
        results[url] = await bmpServerMutations.stop(url);
      })
    );

    return results;
  },

  /**
   * Clear data on multiple clients
   */
  async clearMultiple(clientUrls: string[]): Promise<Record<string, BMPMutationResult>> {
    const results: Record<string, BMPMutationResult> = {};

    await Promise.all(
      clientUrls.map(async (url) => {
        results[url] = await bmpDataMutations.clearAll(url);
      })
    );

    return results;
  },

  /**
   * Add FlowSpec rule to multiple clients
   */
  async addRuleToMultiple(
    clientUrls: string[],
    rule: Omit<BMPFlowSpecRule, 'id' | 'timestamp'>
  ): Promise<Record<string, BMPMutationResult<BMPFlowSpecRule>>> {
    const results: Record<string, BMPMutationResult<BMPFlowSpecRule>> = {};

    await Promise.all(
      clientUrls.map(async (url) => {
        results[url] = await bmpFlowSpecMutations.addRule(rule, url);
      })
    );

    return results;
  }
};

// Export all mutations
export const bmpMutations = {
  server: bmpServerMutations,
  flowSpec: bmpFlowSpecMutations,
  data: bmpDataMutations,
  multiClient: bmpMultiClientMutations
};

export default bmpMutations;