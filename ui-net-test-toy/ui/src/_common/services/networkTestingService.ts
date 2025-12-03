// Network Testing Service - Handles all network testing operations
import { fetchWrapper } from '../utils/fetchWrapper';

export interface TestParameters {
  tool: 'ping' | 'traceroute' | 'iperf' | 'hping' | 'curl';
  params: {
    source_ip?: string;
    host: string;
    [key: string]: any; // Additional tool-specific parameters
  };
}

export interface ActiveTest {
  test_id: string;
  tool: string;
  host?: string;
  start: string | null;
  status: 'running' | 'finished';
  viewers: number;
  params: Record<string, any>;
  source_host?: string;
}

export interface TestWebSocketMessage {
  output?: string;
  error?: string;
  status?: 'running' | 'finished' | 'error';
  tests?: ActiveTest[];
}

export interface TunnelInfo {
  tunnel_name: string;
  tunnel_ip: string;
  remote_ip: string;
}

class NetworkTestingService {
  private activeWebSockets: Map<string, WebSocket> = new Map();

  // Convert HTTP URL to WebSocket URL
  private httpToWsUrl(httpUrl: string, path: string): string {
    try {
      const url = new URL(httpUrl);
      const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${url.host}${path}`;
    } catch (error) {
      console.error('[NetworkTestingService] Invalid URL:', httpUrl, error);
      throw new Error(`Invalid host URL: ${httpUrl}`);
    }
  }

  // Fetch tunnels for a specific container
  async fetchTunnels(hostUrl: string, containerName: string): Promise<TunnelInfo[]> {
    try {
      const data = await fetchWrapper(`${hostUrl}/containers/${containerName}/tunnels`);
      return data.tunnels || [];
    } catch (error) {
      console.error(`Error fetching tunnels for ${containerName}:`, error);
      return [];
    }
  }

  // Start a network test via WebSocket
  startTest(
    containerManagerUrl: string,
    hostName: string,
    testRequest: TestParameters,
    onMessage: (data: TestWebSocketMessage) => void,
    onError?: (error: Error) => void,
    onClose?: () => void
  ): WebSocket {
    // Connect to container manager proxy with host_name query parameter
    const wsUrl = this.httpToWsUrl(containerManagerUrl, `/tools/ws/start?host_name=${encodeURIComponent(hostName)}`);
    console.log('[NetworkTestingService] Connecting to:', wsUrl);
    console.log('[NetworkTestingService] Host:', hostName);
    console.log('[NetworkTestingService] Test request:', testRequest);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[NetworkTestingService] Test WebSocket connected');
      const requestJson = JSON.stringify(testRequest);
      console.log('[NetworkTestingService] Sending test request:', requestJson);
      // Send test request immediately after connection
      ws.send(requestJson);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        onMessage(msg);
      } catch (err) {
        // Handle plain text output
        onMessage({ output: event.data });
      }
    };

    ws.onerror = (event) => {
      console.error('[NetworkTestingService] WebSocket error:', event);
      if (onError) {
        onError(new Error('WebSocket connection error'));
      }
    };

    ws.onclose = () => {
      console.log('[NetworkTestingService] Test WebSocket closed');
      if (onClose) {
        onClose();
      }
      this.activeWebSockets.delete(wsUrl);
    };

    this.activeWebSockets.set(wsUrl, ws);
    return ws;
  }

  // Connect to active tests monitoring
  monitorActiveTests(
    containerManagerUrl: string,
    hostName: string,
    onUpdate: (tests: ActiveTest[]) => void,
    onError?: (error: Error) => void
  ): WebSocket {
    const wsUrl = this.httpToWsUrl(containerManagerUrl, `/tools/ws/active?host_name=${encodeURIComponent(hostName)}`);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[NetworkTestingService] Active tests WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.tests && Array.isArray(msg.tests)) {
          onUpdate(msg.tests);
        }
      } catch (err) {
        console.error('[NetworkTestingService] Failed to parse active tests:', err);
      }
    };

    ws.onerror = (event) => {
      console.error('[NetworkTestingService] Active tests WebSocket error:', event);
      if (onError) {
        onError(new Error('Active tests WebSocket error'));
      }
    };

    ws.onclose = () => {
      console.log('[NetworkTestingService] Active tests WebSocket closed');
      this.activeWebSockets.delete(wsUrl);
    };

    this.activeWebSockets.set(wsUrl, ws);
    return ws;
  }

  // View output of a running test
  viewTestOutput(
    containerManagerUrl: string,
    hostName: string,
    testId: string,
    onOutput: (output: string) => void,
    onError?: (error: Error) => void,
    onClose?: () => void
  ): WebSocket {
    const wsUrl = this.httpToWsUrl(containerManagerUrl, `/tools/ws/view/${testId}?host_name=${encodeURIComponent(hostName)}`);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log(`[NetworkTestingService] Viewing test ${testId}`);
    };

    ws.onmessage = (event) => {
      onOutput(event.data);
    };

    ws.onerror = (event) => {
      console.error(`[NetworkTestingService] View WebSocket error for ${testId}:`, event);
      if (onError) {
        onError(new Error(`Failed to view test ${testId}`));
      }
    };

    ws.onclose = () => {
      console.log(`[NetworkTestingService] View WebSocket closed for ${testId}`);
      if (onClose) {
        onClose();
      }
      this.activeWebSockets.delete(wsUrl);
    };

    this.activeWebSockets.set(wsUrl, ws);
    return ws;
  }

  // Stop a running test
  async stopTest(containerManagerUrl: string, hostName: string, testId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const wsUrl = this.httpToWsUrl(containerManagerUrl, `/tools/ws/stop/${testId}?host_name=${encodeURIComponent(hostName)}`);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log(`[NetworkTestingService] Connected to stop endpoint for test ${testId}`);
      };

      ws.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data);
          console.log(`[NetworkTestingService] Stop response:`, response);
          ws.close();
          resolve(response.stopped);
        } catch (err) {
          console.error(`[NetworkTestingService] Failed to parse stop response:`, err);
          ws.close();
          reject(new Error('Failed to parse stop response'));
        }
      };

      ws.onerror = (event) => {
        console.error(`[NetworkTestingService] WebSocket error stopping test ${testId}:`, event);
        reject(new Error(`Failed to stop test ${testId}`));
      };

      ws.onclose = () => {
        console.log(`[NetworkTestingService] Stop WebSocket closed for test ${testId}`);
      };
    });
  }

  // Close a specific WebSocket connection
  closeWebSocket(wsUrl: string): void {
    const ws = this.activeWebSockets.get(wsUrl);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
      this.activeWebSockets.delete(wsUrl);
    }
  }

  // Close all active WebSockets
  closeAllWebSockets(): void {
    this.activeWebSockets.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });
    this.activeWebSockets.clear();
  }

  // Generate test parameters based on tool and options
  buildTestParameters(
    tool: 'ping' | 'traceroute' | 'iperf' | 'hping' | 'curl',
    sourceIP: string,
    targetIP: string,
    options: Record<string, any>
  ): TestParameters {
    // Backend expects params nested under "params" key
    let toolParams: Record<string, any> = {
      source_ip: sourceIP,
      host: targetIP
    };

    switch (tool) {
      case 'ping':
        toolParams = {
          ...toolParams,
          count: options.count || 4,
          interval: options.interval || 1,
          size: options.size || 56,
          flood: options.flood || false,
          verbose: options.verbose || false
        };
        break;

      case 'traceroute':
        toolParams = {
          ...toolParams,
          maxHops: options.maxHops || 30
        };
        break;

      case 'iperf':
        toolParams = {
          source_ip: sourceIP,
          server: targetIP,  // Backend expects 'server' not 'host' for iperf
          duration: options.duration || 10,
          parallel: options.parallel || 1,
          reverse: options.reverse || false,
          protocol: options.protocol || 'tcp',
          port: options.port || 5201,
          bandwidth: options.bandwidth
        };
        break;

      case 'hping':
        toolParams = {
          ...toolParams,
          protocol: options.protocol || 'tcp',
          port: options.port || 80,
          count: options.count || 4,
          interval: options.interval || '1',
          syn: options.syn || false,
          fin: options.fin || false,
          ack: options.ack || false,
          push: options.push || false,
          rst: options.rst || false,
          urg: options.urg || false,
          flood: options.flood || false,
          rand_source: options.rand_source || false,
          verbose: options.verbose || false,
          frag: options.frag || false
        };
        break;

      case 'curl':
        toolParams = {
          ...toolParams,
          url: options.url || `http://${targetIP}`,
          method: options.method || 'GET',
          headers: options.headers || {},
          data: options.data,
          follow: options.follow || false,
          verbose: options.verbose || false,
          very_verbose: options.very_verbose || false,
          insecure: options.insecure || false
        };
        break;
    }

    // Return in the format expected by backend: { tool: string, params: {...} }
    return {
      tool,
      params: toolParams
    } as any;
  }
}

export const networkTestingService = new NetworkTestingService();