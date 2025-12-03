/**
 * NetFlow type definitions
 * Centralized types for NetFlow monitoring, triggers, and flow data
 */

// ===========================
// NetFlow Core Types
// ===========================

export interface NetFlowStats {
  total_flows: number;
  total_packets: number;
  total_bytes: number;
  flows_in_memory: number;
  exporters: { [key: string]: { flows: number; packets: number; bytes: number } };
}

export interface Flow {
  src_addr: string;
  dst_addr: string;
  src_port: number;
  dst_port: number;
  protocol: number;
  packets: number;
  bytes: number;
  exporter: string;
  timestamp: string;
  kbps?: number;
  mbps?: number;
}

export interface TopTalker {
  address: string;
  bytes: number;
  packets: number;
  flows: number;
}

export interface Conversation {
  pair: string;
  bytes: number;
  packets: number;
  flows: number;
}

// ===========================
// NetFlow Trigger Types
// ===========================

export interface TriggerConditions {
  min_kbps?: number;
  min_mbps?: number;
  min_pps?: number;
  min_bytes?: number;
  src_addr?: string;
  dst_addr?: string;
  src_or_dst_addr?: string;
  protocol?: number;
}

export interface TriggerAction {
  type: 'log' | 'alert' | 'flowspec';
  message?: string;
  rate_limit_kbps?: number;
}

export interface Trigger {
  id: string;
  name: string;
  enabled: boolean;
  conditions: TriggerConditions;
  action: TriggerAction;
  created_at?: string;
  updated_at?: string;
}

export interface TriggeredEvent {
  timestamp: string;
  trigger_id: string;
  trigger_name: string;
  flow: {
    src_addr: string;
    dst_addr: string;
    src_port: number;
    dst_port: number;
    protocol: number;
    bytes: number;
    packets: number;
    kbps: number;
    mbps: number;
  };
  action_type: string;
  action_result: string;
}
