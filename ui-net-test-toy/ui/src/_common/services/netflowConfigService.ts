// NetFlow Configuration Service - Handles NetFlow configuration operations
import { fetchWrapper } from '../utils/fetchWrapper';

export interface NetFlowConfig {
  address: string;
  port: number;
  enabled?: boolean;
  version?: number;
}

export interface NetFlowConfigResult {
  clientName: string;
  success: boolean;
  error?: string;
}

class NetFlowConfigService {
  // Configure NetFlow on a single target
  async configureNetFlow(
    clientUrl: string,
    config: NetFlowConfig
  ): Promise<void> {
    await fetchWrapper(`${clientUrl}/netflow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
  }

  // Configure NetFlow on multiple targets
  async configureNetFlowOnTargets(
    targets: Array<{ client: { baseUrl: string; name: string } }>,
    config: NetFlowConfig
  ): Promise<{
    success: number;
    failed: number;
    errors: string[];
    results: NetFlowConfigResult[];
  }> {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];
    const results: NetFlowConfigResult[] = [];

    await Promise.all(
      targets.map(async (target) => {
        try {
          await this.configureNetFlow(target.client.baseUrl, config);
          success++;
          results.push({
            clientName: target.client.name,
            success: true
          });
        } catch (err) {
          failed++;
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          errors.push(`${target.client.name}: ${errorMessage}`);
          results.push({
            clientName: target.client.name,
            success: false,
            error: errorMessage
          });
        }
      })
    );

    return { success, failed, errors, results };
  }

  // Enable NetFlow on a daemon
  async enableNetFlow(
    hostUrl: string,
    daemonName: string,
    config: NetFlowConfig
  ): Promise<void> {
    await fetchWrapper(`${hostUrl}/daemons/${daemonName}/netflow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
  }

  // Disable NetFlow on a daemon
  async disableNetFlow(
    hostUrl: string,
    daemonName: string
  ): Promise<void> {
    await fetchWrapper(`${hostUrl}/daemons/${daemonName}/netflow`, {
      method: 'DELETE'
    });
  }

  // Get NetFlow configuration for a daemon
  async getNetFlowConfig(
    hostUrl: string,
    daemonName: string
  ): Promise<NetFlowConfig | null> {
    try {
      return await fetchWrapper(`${hostUrl}/daemons/${daemonName}/netflow`);
    } catch (error) {
      // 404 means no configuration exists
      if (error instanceof Error && error.message.startsWith('404')) {
        return null;
      }
      console.warn(`Failed to get NetFlow config for ${daemonName}:`, error);
      return null;
    }
  }

  // Build configuration message
  buildConfigurationMessage(results: {
    success: number;
    failed: number;
    errors: string[];
  }): string {
    let message = `Configured ${results.success} daemon(s) successfully`;
    if (results.failed > 0) {
      message += `, ${results.failed} failed: ${results.errors.join(', ')}`;
    }
    return message;
  }
}

export const netflowConfigService = new NetFlowConfigService();