/**
 * System Overview Pane Component
 * Displays high-level system statistics with adaptive layouts
 */

import React from 'react';
import { StatsPane } from '../../../_common/components';

interface Client {
  status: string;
}

interface Neighbor {
  state: number | string;
}

interface SystemOverviewPaneProps {
  allClients: Client[];
  bgpDaemons: number;
  neighbors: Neighbor[];
  routes: number;
  flowspecRules: number;
  previewColumns: number;
}

export const SystemOverviewPane: React.FC<SystemOverviewPaneProps> = ({
  allClients,
  bgpDaemons,
  neighbors,
  routes,
  flowspecRules,
  previewColumns
}) => {
  // Compact view for 4-column layout
  if (previewColumns === 4) {
    return (
      <StatsPane
        title="System Overview"
        stats={[
          { label: "Connected Hosts", value: allClients.length },
          { label: "BGP Daemons", value: bgpDaemons },
          { label: "BGP Neighbors", value: neighbors.length }
        ]}
        columns={3}
      />
    );
  }

  // Medium detail view for 3-column layout
  if (previewColumns === 3) {
    return (
      <div style={{ padding: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--accent)' }}>{allClients.length}</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Connected Hosts</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--info)' }}>{bgpDaemons}</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>BGP Daemons</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          <div style={{ textAlign: 'center', padding: '0.5rem', backgroundColor: 'var(--background-secondary)', borderRadius: '4px' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{neighbors.length}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Neighbors</div>
          </div>
          <div style={{ textAlign: 'center', padding: '0.5rem', backgroundColor: 'var(--background-secondary)', borderRadius: '4px' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{routes}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Routes</div>
          </div>
          <div style={{ textAlign: 'center', padding: '0.5rem', backgroundColor: 'var(--background-secondary)', borderRadius: '4px' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{flowspecRules}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>FlowSpec</div>
          </div>
        </div>
      </div>
    );
  }

  // Detailed view for 2-column layout
  const connectedClients = allClients.filter(c => c.status === 'connected').length;
  const establishedNeighbors = neighbors.filter(n => n.state === 6 || n.state === 'Established').length;
  const connectedPercentage = allClients.length > 0 ? Math.round((connectedClients / allClients.length) * 100) : 0;
  const establishedPercentage = neighbors.length > 0 ? Math.round((establishedNeighbors / neighbors.length) * 100) : 0;

  return (
    <div style={{ padding: '1.5rem' }}>
      {/* Main Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--accent)' }}>{connectedClients}</span>
            <span style={{ fontSize: '1.5rem', color: 'var(--text-muted)' }}>/ {allClients.length}</span>
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Connected Hosts</div>
          {allClients.length > 0 && (
            <div style={{
              width: '100%',
              height: '4px',
              backgroundColor: 'var(--background-secondary)',
              borderRadius: '2px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${connectedPercentage}%`,
                height: '100%',
                backgroundColor: 'var(--success)',
                transition: 'width 0.3s ease'
              }} />
            </div>
          )}
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--info)' }}>{establishedNeighbors}</span>
            <span style={{ fontSize: '1.5rem', color: 'var(--text-muted)' }}>/ {neighbors.length}</span>
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>BGP Neighbors</div>
          {neighbors.length > 0 && (
            <div style={{
              width: '100%',
              height: '4px',
              backgroundColor: 'var(--background-secondary)',
              borderRadius: '2px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${establishedPercentage}%`,
                height: '100%',
                backgroundColor: 'var(--success)',
                transition: 'width 0.3s ease'
              }} />
            </div>
          )}
        </div>

        <div>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>{bgpDaemons}</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>BGP Daemons</div>
        </div>
      </div>

      {/* Secondary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
        <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: 'var(--background-secondary)', borderRadius: '4px' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 'bold' }}>{routes}</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Active Routes</div>
        </div>
        <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: 'var(--background-secondary)', borderRadius: '4px' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 'bold' }}>{flowspecRules}</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>FlowSpec Rules</div>
        </div>
      </div>
    </div>
  );
};
