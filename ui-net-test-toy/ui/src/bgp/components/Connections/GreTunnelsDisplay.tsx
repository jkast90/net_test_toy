/**
 * GRE Tunnels Display Component
 * Displays GRE tunnels grouped by host, each in its own pane
 */

import React from 'react';
import { DashboardPane, EmptyState } from '../../../_common/components';
import { GreTunnel } from '../../../_common/services/containerManager/containerManagerService';
import { LabHost } from '../../../_common/services/labManager/labManagerService';
import GreTunnelCard from './GreTunnelCard';

interface GreTunnelsDisplayProps {
  tunnelsByHost: Record<string, GreTunnel[]>;
  findHostById: (hostId: string) => LabHost | undefined;
}

export const GreTunnelsDisplay: React.FC<GreTunnelsDisplayProps> = ({
  tunnelsByHost,
  findHostById
}) => {
  return (
    <>
      {Object.entries(tunnelsByHost).map(([hostId, tunnels]) => {
        const host = findHostById(hostId);
        if (!host) return null;

        return (
          <DashboardPane
            key={`gre-${hostId}`}
            title={`${host.name} GRE Tunnels`}
          >
            {tunnels.length === 0 ? (
              <EmptyState message="No GRE tunnels configured" />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                {tunnels.map((tunnel) => (
                  <GreTunnelCard key={tunnel.id} tunnel={tunnel} />
                ))}
              </div>
            )}
          </DashboardPane>
        );
      })}
    </>
  );
};
