/**
 * Tap Service
 * Handles NetFlow tap creation and management
 */

export interface TapCreateRequest {
  container_name: string;
  interface: string;
  collector_ip?: string;
  collector_port?: number;
  netflow_version?: number;
  topology_name?: string;
}

export interface TapInfo {
  tap_name: string;
  target_container: string;
  target_interface: string;
  status: string;
  collector: string;
  created: string;
}

export interface TapStats {
  tap_name: string;
  status: string;
  softflowd_stats: string;
  interface_stats: string;
}

export const tapService = {
  /**
   * Create a NetFlow tap on a container's interface
   */
  async createTap(
    containerManagerUrl: string,
    request: TapCreateRequest
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const response = await fetch(`${containerManagerUrl}/taps/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.detail || 'Failed to create tap' };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  /**
   * Delete a NetFlow tap
   */
  async deleteTap(
    containerManagerUrl: string,
    containerName: string,
    interfaceName: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(
        `${containerManagerUrl}/taps/${containerName}/${interfaceName}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.detail || 'Failed to delete tap' };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  /**
   * List all taps, optionally filtered by container
   */
  async listTaps(
    containerManagerUrl: string,
    containerName?: string
  ): Promise<{ success: boolean; taps?: TapInfo[]; error?: string }> {
    try {
      const url = new URL(`${containerManagerUrl}/taps/list`);
      if (containerName) {
        url.searchParams.append('container_name', containerName);
      }

      const response = await fetch(url.toString());

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.detail || 'Failed to list taps' };
      }

      const data = await response.json();
      return { success: true, taps: data.taps };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  /**
   * Get statistics for a specific tap
   */
  async getTapStats(
    containerManagerUrl: string,
    containerName: string,
    interfaceName: string
  ): Promise<{ success: boolean; stats?: TapStats; error?: string }> {
    try {
      const response = await fetch(
        `${containerManagerUrl}/taps/stats/${containerName}/${interfaceName}`
      );

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.detail || 'Failed to get tap stats' };
      }

      const stats = await response.json();
      return { success: true, stats };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  /**
   * Start a stopped tap
   */
  async startTap(
    containerManagerUrl: string,
    containerName: string,
    interfaceName: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(
        `${containerManagerUrl}/taps/start/${containerName}/${interfaceName}`,
        { method: 'POST' }
      );

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.detail || 'Failed to start tap' };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  /**
   * Stop a running tap
   */
  async stopTap(
    containerManagerUrl: string,
    containerName: string,
    interfaceName: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(
        `${containerManagerUrl}/taps/stop/${containerName}/${interfaceName}`,
        { method: 'POST' }
      );

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.detail || 'Failed to stop tap' };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
};
