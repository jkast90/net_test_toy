/**
 * Testing Service Types
 * All type definitions for container-based network testing operations
 */

// Container-based test configuration
export interface ContainerTest {
  id: string;
  name: string;
  description?: string;
  type: 'ping' | 'traceroute' | 'iperf' | 'hping' | 'curl';
  source_container: string;  // Container name to run test from
  target: string;            // Target IP/hostname or container name
  parameters: TestParameters;
  status: 'idle' | 'running' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface TestParameters {
  // Ping parameters
  count?: number;         // Number of packets
  interval?: number;      // Interval between packets (seconds)
  packet_size?: number;   // Packet size in bytes
  timeout?: number;       // Timeout in seconds

  // Traceroute parameters
  max_hops?: number;      // Maximum number of hops (default 30)
  wait_time?: number;     // Wait time per probe (seconds)
  queries?: number;       // Number of queries per hop

  // iPerf parameters
  duration?: number;      // Test duration in seconds
  port?: number;          // Port number (default 5201)
  parallel?: number;      // Number of parallel streams
  bandwidth?: string;     // Target bandwidth (e.g., "10M", "1G")
  protocol?: 'tcp' | 'udp';
  reverse?: boolean;      // Reverse test direction
  server_mode?: boolean;  // Run in server mode

  // Hping parameters
  hping_protocol?: 'tcp' | 'udp' | 'icmp';
  hping_port?: number;
  syn?: boolean;          // SYN flag for TCP
  flood?: boolean;        // Flood mode
  data_size?: number;     // Data size in bytes

  // Curl parameters
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  data?: string;          // Request body
  follow_redirects?: boolean;
  insecure?: boolean;     // Skip SSL verification
}

// Server configuration for test endpoints
export interface TestServer {
  id: string;
  container_name: string;
  type: 'iperf' | 'http';
  port: number;
  status: 'stopped' | 'starting' | 'running' | 'stopping';
  config?: ServerConfig;
  started_at?: string;
}

export interface ServerConfig {
  // iPerf server config
  iperf_port?: number;
  iperf_interval?: number;

  // HTTP server config
  http_port?: number;
  http_root?: string;
  enable_upload?: boolean;
  enable_cors?: boolean;
}

// Test execution and results
export interface TestExecution {
  id: string;
  test_id: string;
  container_name: string;
  command: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  start_time: string;
  end_time?: string;
  output?: string;
  error?: string;
  exit_code?: number;
  result?: TestResult;
}

export interface TestResult {
  success: boolean;
  metrics?: TestMetrics;
  raw_output: string;
  parsed_data?: any;
  timestamp: string;
}

export interface TestMetrics {
  // Ping metrics
  packets_sent?: number;
  packets_received?: number;
  packet_loss_percent?: number;
  min_rtt?: number;
  avg_rtt?: number;
  max_rtt?: number;
  mdev_rtt?: number;

  // Traceroute metrics
  hop_count?: number;
  total_time_ms?: number;
  hops?: TracerouteHop[];

  // iPerf metrics
  throughput_mbps?: number;
  bandwidth_mbps?: number;
  transfer_bytes?: number;
  duration_seconds?: number;
  retransmits?: number;
  jitter_ms?: number;
  lost_packets?: number;
  cpu_utilization_percent?: number;

  // HTTP/Curl metrics
  http_code?: number;
  response_time_ms?: number;
  dns_lookup_ms?: number;
  connect_time_ms?: number;
  transfer_time_ms?: number;
  download_speed_bps?: number;
  upload_speed_bps?: number;
}

// Traceroute hop information
export interface TracerouteHop {
  hop_number: number;
  hostname?: string;
  ip_address?: string;
  rtt_values: number[];  // Multiple RTT measurements for this hop
  packet_loss?: boolean;
}

// Container management for testing
export interface TestContainer {
  name: string;
  id: string;
  image: string;
  status: string;
  networks: string[];
  ip_addresses: Record<string, string>; // network -> IP mapping
  capabilities?: TestCapabilities;
}

export interface TestCapabilities {
  ping: boolean;
  traceroute: boolean;
  iperf: boolean;
  iperf3: boolean;
  hping: boolean;
  curl: boolean;
  wget: boolean;
  netcat: boolean;
}

// Test profiles and presets
export interface TestProfile {
  id: string;
  name: string;
  description: string;
  tests: ContainerTest[];
  run_parallel?: boolean;
  tags?: string[];
}

export interface TestPreset {
  id: string;
  name: string;
  type: ContainerTest['type'];
  parameters: TestParameters;
  description?: string;
}

// Monitoring and history
export interface TestHistory {
  test_id: string;
  executions: TestExecution[];
  summary?: TestSummary;
}

export interface TestSummary {
  total_runs: number;
  successful_runs: number;
  failed_runs: number;
  average_metrics?: TestMetrics;
  trend?: 'improving' | 'stable' | 'degrading';
}

// Mutations
export interface TestMutationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// WebSocket messages for real-time output
export interface TestStreamMessage {
  type: 'output' | 'status' | 'complete' | 'error';
  test_id: string;
  execution_id?: string;
  data: string | TestResult;
  timestamp: string;
}

// Batch testing
export interface BatchTest {
  id: string;
  name: string;
  tests: Array<{
    test: ContainerTest;
    delay_ms?: number; // Delay before starting this test
  }>;
  parallel: boolean;
  stop_on_failure: boolean;
  status: 'pending' | 'running' | 'completed' | 'failed';
  results?: Record<string, TestResult>;
}