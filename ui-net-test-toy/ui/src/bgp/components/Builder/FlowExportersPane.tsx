import React from 'react';
import { NetFlowStats } from './builderTypes';
import { formatBytes } from '../../../_common/utils/networkUtils';

interface FlowExportersPaneProps {
  netflowStats: NetFlowStats | null;
}

const FlowExportersPane: React.FC<FlowExportersPaneProps> = ({ netflowStats }) => {
  return (
    <>
      {netflowStats && Object.keys(netflowStats.exporters).length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
          {Object.entries(netflowStats.exporters).map(([ip, data], idx) => (
            <div key={`exporter-${ip}-${idx}`} style={{
              padding: '0.75rem',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '4px'
            }}>
              <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: 'var(--color-text-primary)', fontSize: '0.875rem' }}>{ip}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                <span>Flows: {data.flows.toLocaleString()}</span>
                <span>Packets: {data.packets.toLocaleString()}</span>
                <span>Bytes: {formatBytes(data.bytes)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          No exporters detected
        </div>
      )}
    </>
  );
};

export default FlowExportersPane;
