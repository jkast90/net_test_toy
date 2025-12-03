/**
 * Protocol Distribution Pane
 */

import React from 'react';
import { DashboardPane } from '../../../_common/components';
import { PROTOCOL_NAMES } from '../../../_common/utils/networkUtils';

interface ProtocolDistribution {
  protocol: number;
  count: number;
  percentage: number;
}

interface ProtocolDistributionPaneProps {
  distribution: ProtocolDistribution[];
  maxItems?: number;
}

const getProtocolIcon = (protocol: number): string => {
  switch (protocol) {
    case 6: // TCP
      return '🔒';
    case 17: // UDP
      return '📨';
    default:
      return '🔄';
  }
};

export const ProtocolDistributionPane: React.FC<ProtocolDistributionPaneProps> = ({
  distribution,
  maxItems = 6
}) => {
  const displayData = distribution.slice(0, maxItems);

  return (
    <DashboardPane title="Protocol Distribution">
      {displayData.length === 0 ? (
        <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No protocol data available
        </div>
      ) : (
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {displayData.map((proto) => (
            <div
              key={proto.protocol}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem',
                backgroundColor: 'var(--background-secondary)',
                borderRadius: '4px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem' }}>{getProtocolIcon(proto.protocol)}</span>
                <span style={{ fontWeight: 500 }}>
                  {PROTOCOL_NAMES[proto.protocol] || `Proto ${proto.protocol}`}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ fontWeight: 500 }}>{proto.count.toLocaleString()} flows</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {proto.percentage.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardPane>
  );
};
