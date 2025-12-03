import React from 'react';

// Re-export centralized types for backward compatibility
export type {
  NetFlowStats,
  Flow,
  TopTalker,
  Conversation,
  TriggeredEvent,
} from '../../../_common/types/netflow';

export type { BMPPeer, BMPRoute } from '../../../_common/types/bmp';

// Local types specific to Builder
export interface PaneConfig {
  id: string;
  title: string;
  category: string;
  component: React.ReactNode;
}

export interface FlowSpecRule {
  match: {
    source?: string;
    destination?: string;
    protocol?: number;
    source_port?: number;
    destination_port?: number;
  };
  actions: {
    action: string;
    rate?: number;
  };
  timestamp: string;
}
