/**
 * NetFlow Service Types
 * All type definitions for NetFlow operations
 */

export interface NetFlowRecord {
  id: string;
  timestamp: string;
  source_ip: string;
  destination_ip: string;
  source_port: number;
  destination_port: number;
  protocol: number;
  protocol_name?: string;
  bytes: number;
  packets: number;
  start_time: string;
  end_time: string;
  duration_ms: number;
  tcp_flags?: string;
  input_interface?: number;
  output_interface?: number;
  as_src?: number;
  as_dst?: number;
  next_hop?: string;
  src_mask?: number;
  dst_mask?: number;
  flow_label?: string;
  client_id?: string;
}

export interface NetFlowStats {
  total_flows: number;
  active_flows: number;
  total_bytes: number;
  total_packets: number;
  flows_per_second: number;
  bytes_per_second: number;
  packets_per_second: number;
  top_talkers: NetFlowTopTalker[];
  top_protocols: NetFlowProtocolStats[];
  last_update: string;
}

export interface NetFlowTopTalker {
  ip_address: string;
  hostname?: string;
  bytes_sent: number;
  bytes_received: number;
  total_bytes: number;
  flow_count: number;
  percentage: number;
}

export interface NetFlowProtocolStats {
  protocol: number;
  protocol_name: string;
  bytes: number;
  packets: number;
  flow_count: number;
  percentage: number;
}

export interface NetFlowFilter {
  source_ip?: string;
  destination_ip?: string;
  port?: number;
  protocol?: number;
  start_time?: string;
  end_time?: string;
  min_bytes?: number;
  max_bytes?: number;
  interface?: number;
  as_number?: number;
  limit?: number;
}

export interface NetFlowAggregation {
  type: 'source' | 'destination' | 'protocol' | 'port' | 'as' | 'interface';
  interval?: '1m' | '5m' | '15m' | '1h' | '1d';
  top_n?: number;
}

export interface NetFlowCollectorConfig {
  enabled: boolean;
  listen_address: string;
  listen_port: number;
  netflow_version: 5 | 9 | 10; // v5, v9, IPFIX
  template_refresh_interval?: number;
  max_flows_per_second?: number;
  buffer_size?: number;
  storage_retention_days?: number;
}

export interface NetFlowExporter {
  id: string;
  name: string;
  ip_address: string;
  port: number;
  version: 5 | 9 | 10;
  status: 'active' | 'inactive' | 'unknown';
  last_seen: string;
  flow_count: number;
  byte_count: number;
}

export interface NetFlowAlert {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  condition: NetFlowAlertCondition;
  actions: NetFlowAlertAction[];
  last_triggered?: string;
  trigger_count: number;
  created_at: string;
  updated_at: string;
}

export interface NetFlowAlertCondition {
  type: 'threshold' | 'anomaly' | 'pattern';
  metric: 'bytes_per_second' | 'packets_per_second' | 'flows_per_second' | 'specific_flow';
  operator: '>' | '<' | '=' | '>=' | '<=';
  value: number;
  duration_seconds?: number;
  filter?: NetFlowFilter;
}

export interface NetFlowAlertAction {
  type: 'email' | 'webhook' | 'syslog' | 'script';
  config: Record<string, any>;
}

export interface NetFlowData {
  records: NetFlowRecord[];
  stats: NetFlowStats;
  exporters: NetFlowExporter[];
  alerts: NetFlowAlert[];
  config: NetFlowCollectorConfig;
}

export interface NetFlowTimeSeriesData {
  timestamp: string;
  bytes: number;
  packets: number;
  flows: number;
}

export interface NetFlowAnalysis {
  time_series: NetFlowTimeSeriesData[];
  top_conversations: NetFlowConversation[];
  protocol_distribution: NetFlowProtocolStats[];
  port_distribution: NetFlowPortStats[];
  geographic_distribution?: NetFlowGeoStats[];
}

export interface NetFlowConversation {
  source_ip: string;
  destination_ip: string;
  bytes: number;
  packets: number;
  flows: number;
  protocols: number[];
  start_time: string;
  end_time: string;
}

export interface NetFlowPortStats {
  port: number;
  service_name?: string;
  bytes: number;
  packets: number;
  flow_count: number;
  percentage: number;
}

export interface NetFlowGeoStats {
  country_code: string;
  country_name: string;
  bytes_in: number;
  bytes_out: number;
  flow_count: number;
}

export interface NetFlowMutationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}