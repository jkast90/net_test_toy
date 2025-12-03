/**
 * NetFlow Monitor Table Column Definitions
 * Extracted configuration for data table columns
 */

import type { Column } from '../../_common/components/DataTable';
import { PROTOCOL_NAMES, formatBytes, formatDecimal } from '../../_common/utils/networkUtils';

// Flow type for column definitions
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
  // Calculated bandwidth metrics
  duration_ms?: number;
  bps?: number;
  kbps?: number;
  mbps?: number;
  pps?: number;
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

/**
 * Column definitions for the flow data table
 */
export const flowColumns: Column<Flow>[] = [
  {
    key: 'timestamp',
    header: 'Time',
    render: (flow) => new Date(flow.timestamp).toLocaleTimeString()
  },
  {
    key: 'src_addr',
    header: 'Source',
    render: (flow) => `${flow.src_addr}:${flow.src_port}`
  },
  {
    key: 'dst_addr',
    header: 'Destination',
    render: (flow) => `${flow.dst_addr}:${flow.dst_port}`
  },
  {
    key: 'protocol',
    header: 'Protocol',
    render: (flow) => PROTOCOL_NAMES[flow.protocol] || `Proto ${flow.protocol}`
  },
  {
    key: 'bytes',
    header: 'Bytes',
    render: (flow) => formatBytes(flow.bytes)
  },
  {
    key: 'packets',
    header: 'Packets',
    render: (flow) => flow.packets.toLocaleString()
  },
  {
    key: 'kbps',
    header: 'Bandwidth',
    render: (flow) => {
      if (flow.mbps && flow.mbps >= 1) {
        return `${formatDecimal(flow.mbps, 2)} Mbps`;
      } else if (flow.kbps) {
        return `${formatDecimal(flow.kbps, 2)} Kbps`;
      }
      return '-';
    }
  },
  {
    key: 'exporter',
    header: 'Exporter',
    render: (flow) => flow.exporter
  }
];

/**
 * Column definitions for the top talkers table
 */
export const talkerColumns: Column<TopTalker>[] = [
  {
    key: 'address',
    header: 'IP Address'
  },
  {
    key: 'bytes',
    header: 'Traffic',
    render: (talker) => formatBytes(talker.bytes)
  },
  {
    key: 'packets',
    header: 'Packets',
    render: (talker) => talker.packets.toLocaleString()
  },
  {
    key: 'flows',
    header: 'Flows',
    render: (talker) => talker.flows
  }
];

/**
 * Column definitions for the conversations table
 */
export const conversationColumns: Column<Conversation>[] = [
  {
    key: 'pair',
    header: 'Conversation'
  },
  {
    key: 'bytes',
    header: 'Traffic',
    render: (conv) => formatBytes(conv.bytes)
  },
  {
    key: 'packets',
    header: 'Packets',
    render: (conv) => conv.packets.toLocaleString()
  },
  {
    key: 'flows',
    header: 'Flows',
    render: (conv) => conv.flows
  }
];
