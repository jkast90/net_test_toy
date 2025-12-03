import React, { useMemo } from 'react';
import DataTable from '../../../_common/components/DataTable';
import type { Flow } from './builderTypes';
import type { NetFlowRecord } from '../../../_common/services/netflow/types';
import { PROTOCOL_NAMES, formatBytes, formatDecimal } from '../../../_common/utils/networkUtils';

interface RecentFlowsPaneProps {
  records: NetFlowRecord[];
}

const RecentFlowsPane: React.FC<RecentFlowsPaneProps> = ({ records }) => {
  // Transform NetFlowRecord[] to Flow[]
  const flows = useMemo(() => {
    return records.map(record => ({
      src_addr: record.source_ip,
      dst_addr: record.destination_ip,
      src_port: record.source_port,
      dst_port: record.destination_port,
      protocol: record.protocol,
      packets: record.packets,
      bytes: record.bytes,
      exporter: record.client_id || 'unknown',
      timestamp: record.timestamp,
      kbps: record.duration_ms ? (record.bytes * 8) / record.duration_ms : undefined,
      mbps: record.duration_ms ? (record.bytes * 8) / record.duration_ms / 1000 : undefined
    }));
  }, [records]);
  return (
    <DataTable
      data={flows}
      columns={[
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
          render: (flow) => PROTOCOL_NAMES[flow.protocol] || `Proto-${flow.protocol}`
        },
        { key: 'packets', header: 'Packets' },
        {
          key: 'bytes',
          header: 'Bytes',
          render: (flow) => formatBytes(flow.bytes)
        },
        {
          key: 'kbps',
          header: 'kbps',
          render: (flow) => flow.kbps !== undefined ? formatDecimal(flow.kbps, 2) : 'N/A'
        },
        {
          key: 'mbps',
          header: 'Mbps',
          render: (flow) => flow.mbps !== undefined ? formatDecimal(flow.mbps, 4) : 'N/A'
        },
        { key: 'exporter', header: 'Exporter' }
      ]}
      emptyMessage="No flows captured yet"
    />
  );
};

export default RecentFlowsPane;
