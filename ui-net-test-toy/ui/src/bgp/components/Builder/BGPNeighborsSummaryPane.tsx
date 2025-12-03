import React from 'react';
import { AggregatedNeighbor } from '../../../_common/services/multiClientBgpApi';
import { isBGPEstablished, getBGPStateName } from '../../../_common/utils/networkUtils';

interface BGPNeighborsSummaryPaneProps {
  neighbors: AggregatedNeighbor[];
  loading: boolean;
}

const BGPNeighborsSummaryPane: React.FC<BGPNeighborsSummaryPaneProps> = ({
  neighbors,
  loading
}) => {
  return (
    <>
      {neighbors.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <p>No BGP neighbors configured</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {neighbors.slice(0, 10).map((neighbor, idx) => {
            const isEstablished = isBGPEstablished(neighbor.state);
            const stateText = getBGPStateName(neighbor.state);

            return (
              <div key={`${neighbor.clientId}-${neighbor.neighbor_ip}-${neighbor.remote_as}-${idx}`} style={{
                padding: '0.75rem',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '4px'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '0.25rem', color: 'var(--color-text-primary)', fontSize: '0.875rem' }}>
                      {neighbor.neighbor_ip}
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                      <span>AS {neighbor.remote_as}</span>
                      {neighbor.clientName && <span>From: {neighbor.clientName}</span>}
                    </div>
                  </div>
                  <div style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    backgroundColor: isEstablished ? 'var(--success-bg, rgba(76, 175, 80, 0.1))' : 'var(--error-bg, rgba(244, 67, 54, 0.1))',
                    color: isEstablished ? 'var(--success, #4CAF50)' : 'var(--error, #f44336)'
                  }}>
                    {stateText}
                  </div>
                </div>
              </div>
            );
          })}
          {neighbors.length > 10 && (
            <div style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Showing 10 of {neighbors.length} neighbors
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default BGPNeighborsSummaryPane;
