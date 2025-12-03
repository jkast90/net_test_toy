import { fetchWrapper } from '../../utils/fetchWrapper';

/**
 * Connection Service
 * Handles connection health checks and status monitoring
 */
class ConnectionService {
  /**
   * Check if a client connection is healthy
   * @param baseUrl - The base URL of the client to check
   * @param timeoutMs - Request timeout in milliseconds (default: 5000)
   * @param suppressLogs - Whether to suppress console logs (default: false, set to true for polling)
   * @returns Promise that resolves if connection is healthy, rejects otherwise
   */
  async checkHealth(baseUrl: string, timeoutMs: number = 5000, suppressLogs: boolean = false): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // Test connection with a simple health check on /backends endpoint
      await fetchWrapper(`${baseUrl}/backends`, {
        signal: controller.signal,
        suppressLogs
      });

      clearTimeout(timeoutId);
    } catch (error) {
      clearTimeout(timeoutId);

      // Re-throw with more specific error message
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Connection timeout');
      }

      throw error;
    }
  }

  /**
   * Check multiple client connections in parallel
   * @param clients - Array of client objects with id and baseUrl
   * @param timeoutMs - Request timeout in milliseconds per client
   * @returns Array of results with client id and status
   */
  async checkMultipleConnections(
    clients: Array<{ id: string; baseUrl: string }>,
    timeoutMs: number = 5000
  ): Promise<Array<{ id: string; status: 'connected' | 'error'; error?: string }>> {
    const results = await Promise.allSettled(
      clients.map(async (client) => {
        try {
          await this.checkHealth(client.baseUrl, timeoutMs);
          return { id: client.id, status: 'connected' as const };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Connection failed';
          return { id: client.id, status: 'error' as const, error: errorMessage };
        }
      })
    );

    return results
      .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
      .map(result => result.value);
  }
}

export const connectionService = new ConnectionService();
