import React, { useState, useMemo, useEffect } from 'react';
import { EmptyState } from '../../../_common/components';
import type { Flow } from './builderTypes';
import type { NetFlowRecord } from '../../../_common/services/netflow/types';
import { PROTOCOL_NAMES, formatDecimal } from '../../../_common/utils/networkUtils';

interface TopBandwidthFlowsPaneProps {
  records: NetFlowRecord[];
}

const TopBandwidthFlowsPane: React.FC<TopBandwidthFlowsPaneProps> = ({
  records
}) => {
  // Manage limit state with localStorage persistence
  const [topFlowsLimit, setTopFlowsLimit] = useState(() => {
    const saved = localStorage.getItem('topFlowsLimit');
    return saved ? parseInt(saved) : 10;
  });

  // Save to localStorage when limit changes
  useEffect(() => {
    localStorage.setItem('topFlowsLimit', topFlowsLimit.toString());
  }, [topFlowsLimit]);

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
    <>
      {flows.length > 0 && flows.some(f => f.kbps !== undefined && f.kbps > 0) ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {flows
            .filter(f => f.kbps !== undefined && f.kbps > 0)
            .sort((a, b) => (b.kbps || 0) - (a.kbps || 0))
            .slice(0, topFlowsLimit)
            .map((flow, idx) => {
              const maxKbps = Math.max(...flows.filter(f => f.kbps).map(f => f.kbps || 0));
              const widthPercent = maxKbps > 0 ? ((flow.kbps || 0) / maxKbps) * 100 : 0;
              return (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem',
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '4px',
                  fontSize: '0.75rem'
                }}>
                  <div style={{ flex: '0 0 180px', fontFamily: 'monospace', color: 'var(--color-text-primary)', fontSize: '0.7rem' }}>
                    {flow.src_addr}:{flow.src_port} → {flow.dst_addr}:{flow.dst_port}
                  </div>
                  <div style={{ flex: 1, position: 'relative', height: '18px', backgroundColor: 'var(--color-bg-secondary, #e0e0e0)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      height: '100%',
                      width: `${widthPercent}%`,
                      backgroundColor: flow.protocol === 6 ? 'var(--color-success, #4CAF50)' : flow.protocol === 17 ? 'var(--color-info, #2196F3)' : 'var(--color-warning, #FF9800)',
                      transition: 'width 0.3s ease'
                    }} />
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: 0,
                      bottom: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      color: widthPercent > 30 ? '#fff' : 'var(--color-text-primary)'
                    }}>
                      {flow.kbps ? formatDecimal(flow.kbps, 2) : ''} kbps {flow.mbps && flow.mbps >= 1 ? `(${formatDecimal(flow.mbps, 2)} Mbps)` : ''}
                    </div>
                  </div>
                  <div style={{ flex: '0 0 40px', fontSize: '0.65rem', textAlign: 'right', color: 'var(--color-text-secondary)' }}>
                    {PROTOCOL_NAMES[flow.protocol] || `P${flow.protocol}`}
                  </div>
                </div>
              );
            })}
        </div>
      ) : (
        <EmptyState message="No bandwidth data available" />
      )}
    </>
  );
};

export default TopBandwidthFlowsPane;
