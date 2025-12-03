/**
 * BMP Statistics Pane
 * Displays BMP monitoring statistics
 */

import React from 'react';
import { DashboardPane, EmptyState } from '../../../_common/components';

interface BMPStatisticsPaneProps {
  stats: any; // TODO: type this properly based on BMPStats from the service
  loading?: boolean;
}

export const BMPStatisticsPane: React.FC<BMPStatisticsPaneProps> = ({
  stats,
  loading = false
}) => {
  if (!stats) {
    return (
      <DashboardPane title="BMP Statistics" loading={loading}>
        <EmptyState message="No BMP statistics available" />
      </DashboardPane>
    );
  }

  return (
    <DashboardPane title="BMP Statistics" loading={loading}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem'
      }}>
        {Object.entries(stats).map(([key, value]) => (
          <div
            key={key}
            style={{
              padding: '1rem',
              backgroundColor: 'var(--background-secondary)',
              borderRadius: '4px',
              border: '1px solid var(--border)'
            }}
          >
            <div style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              marginBottom: '0.5rem'
            }}>
              {key.replace(/_/g, ' ')}
            </div>
            <div style={{
              fontSize: '1.5rem',
              fontWeight: 600,
              color: 'var(--text-primary)'
            }}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </div>
          </div>
        ))}
      </div>
    </DashboardPane>
  );
};

export default BMPStatisticsPane;
