/**
 * Testing Service Layer
 * Handles container-based network testing operations through Container Manager API
 */

import { fetchWrapper } from '../../utils/fetchWrapper';
import {
  ContainerTest,
  TestParameters,
  TestServer,
  TestExecution,
  TestResult,
  TestContainer,
  TestProfile,
  TestPreset,
  TestHistory,
  TestMutationResult,
  BatchTest,
  TestCapabilities
} from './types';

class TestingService {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    // No default URL - must be provided via clientUrl parameter to methods
    this.baseUrl = baseUrl;
  }

  private getUrl(endpoint: string, clientUrl?: string): string {
    const base = clientUrl || this.baseUrl;
    return `${base}${endpoint}`;
  }

  // Server management operations (iPerf server, HTTP server)
  async startIperfServer(containerName: string, port: number = 5201, clientUrl?: string): Promise<TestMutationResult<TestServer>> {
    const command = `iperf3 -s -p ${port}`;
    return this.executeInContainer(containerName, command, true, clientUrl);
  }

  async stopIperfServer(containerName: string, clientUrl?: string): Promise<TestMutationResult> {
    const command = 'pkill iperf3';
    return this.executeInContainer(containerName, command, false, clientUrl);
  }

  async startHttpServer(containerName: string, port: number = 8080, root: string = '/tmp', clientUrl?: string): Promise<TestMutationResult<TestServer>> {
    const command = `python3 -m http.server ${port} --directory ${root}`;
    return this.executeInContainer(containerName, command, true, clientUrl);
  }

  async stopHttpServer(containerName: string, clientUrl?: string): Promise<TestMutationResult> {
    const command = 'pkill -f "python3 -m http.server"';
    return this.executeInContainer(containerName, command, false, clientUrl);
  }

  // Test execution operations
  async runPingTest(sourceContainer: string, target: string, params?: Partial<TestParameters>, clientUrl?: string): Promise<TestMutationResult<TestResult>> {
    const count = params?.count || 4;
    const interval = params?.interval || 1;
    const packetSize = params?.packet_size;
    const timeout = params?.timeout || 10;

    let command = `ping -c ${count} -i ${interval} -W ${timeout}`;
    if (packetSize) {
      command += ` -s ${packetSize}`;
    }
    command += ` ${target}`;

    const result = await this.executeInContainer(sourceContainer, command, false, clientUrl);

    if (result.success && result.data) {
      const metrics = this.parsePingOutput(result.data);
      return {
        success: true,
        data: {
          success: metrics.packet_loss_percent === 0,
          metrics,
          raw_output: result.data,
          timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      };
    }

    return result;
  }

  async runTracerouteTest(sourceContainer: string, target: string, params?: Partial<TestParameters>, clientUrl?: string): Promise<TestMutationResult<TestResult>> {
    const maxHops = params?.max_hops || 30;
    const waitTime = params?.wait_time || 3;
    const queries = params?.queries || 3;

    const command = `traceroute -m ${maxHops} -w ${waitTime} -q ${queries} ${target}`;

    const result = await this.executeInContainer(sourceContainer, command, false, clientUrl);

    if (result.success && result.data) {
      const metrics = this.parseTracerouteOutput(result.data);
      return {
        success: true,
        data: {
          success: true,
          metrics,
          raw_output: result.data,
          timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      };
    }

    return result;
  }

  async runIperfTest(sourceContainer: string, serverHost: string, params?: Partial<TestParameters>, clientUrl?: string): Promise<TestMutationResult<TestResult>> {
    const duration = params?.duration || 10;
    const port = params?.port || 5201;
    const parallel = params?.parallel || 1;
    const protocol = params?.protocol || 'tcp';
    const bandwidth = params?.bandwidth;
    const reverse = params?.reverse;

    let command = `iperf3 -c ${serverHost} -p ${port} -t ${duration} -P ${parallel} -J`; // -J for JSON output

    if (protocol === 'udp') {
      command += ' -u';
      if (bandwidth) {
        command += ` -b ${bandwidth}`;
      }
    }

    if (reverse) {
      command += ' -R';
    }

    const result = await this.executeInContainer(sourceContainer, command, false, clientUrl);

    if (result.success && result.data) {
      try {
        const jsonData = JSON.parse(result.data);
        const metrics = this.parseIperfJson(jsonData);
        return {
          success: true,
          data: {
            success: true,
            metrics,
            raw_output: result.data,
            parsed_data: jsonData,
            timestamp: new Date().toISOString()
          },
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        // Fallback to text parsing if JSON parsing fails
        const metrics = this.parseIperfOutput(result.data);
        return {
          success: true,
          data: {
            success: true,
            metrics,
            raw_output: result.data,
            timestamp: new Date().toISOString()
          },
          timestamp: new Date().toISOString()
        };
      }
    }

    return result;
  }

  async runHpingTest(sourceContainer: string, target: string, params?: Partial<TestParameters>, clientUrl?: string): Promise<TestMutationResult<TestResult>> {
    const protocol = params?.hping_protocol || 'tcp';
    const port = params?.hping_port || 80;
    const count = params?.count || 10;
    const syn = params?.syn;
    const flood = params?.flood;
    const dataSize = params?.data_size;

    let command = 'hping3';

    // Protocol selection
    switch (protocol) {
      case 'tcp':
        command += ` -S`; // SYN by default for TCP
        break;
      case 'udp':
        command += ` -2`; // UDP mode
        break;
      case 'icmp':
        command += ` -1`; // ICMP mode
        break;
    }

    if (port && protocol !== 'icmp') {
      command += ` -p ${port}`;
    }

    command += ` -c ${count}`;

    if (flood) {
      command += ' --flood';
    }

    if (dataSize) {
      command += ` -d ${dataSize}`;
    }

    command += ` ${target}`;

    const result = await this.executeInContainer(sourceContainer, command, false, clientUrl);

    if (result.success && result.data) {
      const metrics = this.parseHpingOutput(result.data);
      return {
        success: true,
        data: {
          success: metrics.packet_loss_percent === 0,
          metrics,
          raw_output: result.data,
          timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      };
    }

    return result;
  }

  async runCurlTest(sourceContainer: string, url: string, params?: Partial<TestParameters>, clientUrl?: string): Promise<TestMutationResult<TestResult>> {
    const method = params?.method || 'GET';
    const headers = params?.headers;
    const data = params?.data;
    const followRedirects = params?.follow_redirects !== false;
    const insecure = params?.insecure;

    let command = `curl -X ${method} -w "\n%{http_code}\n%{time_total}\n%{time_namelookup}\n%{time_connect}\n%{speed_download}"`;

    if (headers) {
      Object.entries(headers).forEach(([key, value]) => {
        command += ` -H "${key}: ${value}"`;
      });
    }

    if (data) {
      command += ` -d '${data}'`;
    }

    if (followRedirects) {
      command += ' -L';
    }

    if (insecure) {
      command += ' -k';
    }

    command += ` "${url}"`;

    const result = await this.executeInContainer(sourceContainer, command, false, clientUrl);

    if (result.success && result.data) {
      const metrics = this.parseCurlOutput(result.data);
      return {
        success: true,
        data: {
          success: metrics.http_code !== undefined && metrics.http_code < 400,
          metrics,
          raw_output: result.data,
          timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      };
    }

    return result;
  }

  // Container operations
  async getTestContainers(clientUrl?: string): Promise<TestContainer[]> {
    const response = await fetchWrapper<any[]>(this.getUrl('/containers', clientUrl));

    return response.map(container => ({
      name: container.name,
      id: container.id,
      image: container.image,
      status: container.status,
      networks: container.networks || [],
      ip_addresses: container.ip_addresses || {},
      capabilities: this.detectCapabilities(container.image)
    }));
  }

  async getContainerCapabilities(containerName: string, clientUrl?: string): Promise<TestMutationResult<TestCapabilities>> {
    const checks = {
      ping: 'which ping',
      traceroute: 'which traceroute',
      iperf: 'which iperf',
      iperf3: 'which iperf3',
      hping: 'which hping3',
      curl: 'which curl',
      wget: 'which wget',
      netcat: 'which nc'
    };

    const capabilities: any = {};

    for (const [tool, command] of Object.entries(checks)) {
      const result = await this.executeInContainer(containerName, command, false, clientUrl);
      capabilities[tool] = result.success && !result.error;
    }

    return {
      success: true,
      data: capabilities,
      timestamp: new Date().toISOString()
    };
  }

  // Helper method to execute commands in containers
  private async executeInContainer(
    containerName: string,
    command: string,
    detached: boolean = false,
    clientUrl?: string
  ): Promise<TestMutationResult<any>> {
    try {
      const response = await fetchWrapper<any>(
        this.getUrl(`/containers/${containerName}/exec`, clientUrl),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command, detached })
        }
      );

      return {
        success: true,
        data: response.output || response,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Command execution failed',
        timestamp: new Date().toISOString()
      };
    }
  }

  // Output parsing methods
  private parsePingOutput(output: string): any {
    const metrics: any = {};

    // Parse packet statistics
    const statsMatch = output.match(/(\d+) packets transmitted, (\d+) received, ([\d.]+)% packet loss/);
    if (statsMatch) {
      metrics.packets_sent = parseInt(statsMatch[1]);
      metrics.packets_received = parseInt(statsMatch[2]);
      metrics.packet_loss_percent = parseFloat(statsMatch[3]);
    }

    // Parse RTT statistics
    const rttMatch = output.match(/min\/avg\/max\/mdev = ([\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+)/);
    if (rttMatch) {
      metrics.min_rtt = parseFloat(rttMatch[1]);
      metrics.avg_rtt = parseFloat(rttMatch[2]);
      metrics.max_rtt = parseFloat(rttMatch[3]);
      metrics.mdev_rtt = parseFloat(rttMatch[4]);
    }

    return metrics;
  }

  private parseTracerouteOutput(output: string): any {
    const metrics: any = {
      hops: []
    };

    const lines = output.split('\n');
    let hopCount = 0;

    for (const line of lines) {
      // Skip header line
      if (line.includes('traceroute to') || line.trim() === '') {
        continue;
      }

      // Parse hop line
      // Format: " 1  router (192.168.1.1)  1.234 ms  2.345 ms  3.456 ms"
      // Or: " 1  * * *" for no response
      const hopMatch = line.match(/^\s*(\d+)\s+(.+)$/);
      if (hopMatch) {
        const hopNumber = parseInt(hopMatch[1]);
        const hopData = hopMatch[2].trim();

        const hop: any = {
          hop_number: hopNumber,
          rtt_values: [],
          packet_loss: false
        };

        if (hopData.includes('*')) {
          // Check if all packets were lost
          if (hopData === '* * *' || !hopData.match(/\d+\.\d+\s*ms/)) {
            hop.packet_loss = true;
          }
        }

        // Extract hostname and IP if present
        const hostMatch = hopData.match(/^([^\s]+)\s+\(([^)]+)\)/);
        if (hostMatch) {
          hop.hostname = hostMatch[1];
          hop.ip_address = hostMatch[2];
        }

        // Extract RTT values
        const rttMatches = hopData.match(/(\d+\.\d+)\s*ms/g);
        if (rttMatches) {
          hop.rtt_values = rttMatches.map(rtt => parseFloat(rtt.replace(/\s*ms/, '')));
        }

        metrics.hops.push(hop);
        hopCount = hopNumber;
      }
    }

    metrics.hop_count = hopCount;

    // Calculate total time from last hop with valid RTT
    for (let i = metrics.hops.length - 1; i >= 0; i--) {
      const hop = metrics.hops[i];
      if (hop.rtt_values.length > 0) {
        metrics.total_time_ms = Math.max(...hop.rtt_values);
        break;
      }
    }

    return metrics;
  }

  private parseIperfJson(data: any): any {
    const metrics: any = {};

    if (data.end) {
      const summary = data.end.sum_sent || data.end.sum;
      if (summary) {
        metrics.transfer_bytes = summary.bytes;
        metrics.duration_seconds = summary.seconds;
        metrics.throughput_mbps = (summary.bits_per_second / 1000000).toFixed(2);

        if (summary.retransmits !== undefined) {
          metrics.retransmits = summary.retransmits;
        }
      }

      const receiver = data.end.sum_received;
      if (receiver) {
        metrics.bandwidth_mbps = (receiver.bits_per_second / 1000000).toFixed(2);

        if (data.end.streams && data.end.streams[0]) {
          const stream = data.end.streams[0].udp;
          if (stream) {
            metrics.jitter_ms = stream.jitter_ms;
            metrics.lost_packets = stream.lost_packets;
          }
        }
      }
    }

    return metrics;
  }

  private parseIperfOutput(output: string): any {
    const metrics: any = {};

    // Parse bandwidth
    const bandwidthMatch = output.match(/([\d.]+) Mbits\/sec/);
    if (bandwidthMatch) {
      metrics.bandwidth_mbps = parseFloat(bandwidthMatch[1]);
    }

    // Parse transfer
    const transferMatch = output.match(/([\d.]+) MBytes/);
    if (transferMatch) {
      metrics.transfer_bytes = parseFloat(transferMatch[1]) * 1024 * 1024;
    }

    return metrics;
  }

  private parseHpingOutput(output: string): any {
    const metrics: any = {
      packets_sent: 0,
      packets_received: 0,
      packet_loss_percent: 100
    };

    // Count sent and received packets
    const sentMatches = output.match(/^len=/gm);
    if (sentMatches) {
      metrics.packets_sent = sentMatches.length;
    }

    const receivedMatches = output.match(/flags=[A-Z]+/gm);
    if (receivedMatches) {
      metrics.packets_received = receivedMatches.length;
    }

    if (metrics.packets_sent > 0) {
      metrics.packet_loss_percent = ((metrics.packets_sent - metrics.packets_received) / metrics.packets_sent) * 100;
    }

    return metrics;
  }

  private parseCurlOutput(output: string): any {
    const lines = output.trim().split('\n');
    const metrics: any = {};

    if (lines.length >= 5) {
      const lastLines = lines.slice(-5);
      metrics.http_code = parseInt(lastLines[0]) || 0;
      metrics.response_time_ms = parseFloat(lastLines[1]) * 1000 || 0;
      metrics.dns_lookup_ms = parseFloat(lastLines[2]) * 1000 || 0;
      metrics.connect_time_ms = parseFloat(lastLines[3]) * 1000 || 0;
      metrics.download_speed_bps = parseFloat(lastLines[4]) || 0;
    }

    return metrics;
  }

  private detectCapabilities(image: string): TestCapabilities {
    // Basic capability detection based on common images
    const capabilities: TestCapabilities = {
      ping: true,  // Most images have ping
      traceroute: true,  // Most network images have traceroute
      iperf: false,
      iperf3: false,
      hping: false,
      curl: false,
      wget: false,
      netcat: false
    };

    const imageLower = image.toLowerCase();

    if (imageLower.includes('alpine')) {
      capabilities.wget = true;
    } else if (imageLower.includes('ubuntu') || imageLower.includes('debian')) {
      capabilities.curl = true;
      capabilities.wget = true;
      capabilities.netcat = true;
    } else if (imageLower.includes('centos') || imageLower.includes('fedora')) {
      capabilities.curl = true;
      capabilities.wget = true;
    }

    // Network testing specific images
    if (imageLower.includes('iperf')) {
      capabilities.iperf3 = true;
    }

    if (imageLower.includes('network') || imageLower.includes('nettools')) {
      capabilities.iperf3 = true;
      capabilities.hping = true;
      capabilities.netcat = true;
    }

    return capabilities;
  }
}

// Export singleton instance
export const testingService = new TestingService();

// Export class for testing
export default TestingService;