/**
 * Docker Networks Display Component
 * Displays Docker networks grouped by host, each in its own pane
 */

import React from 'react';
import { DashboardPane, EmptyState } from '../../../_common/components';
import { Network } from '../../../_common/services/containerManager/containerManagerService';
import { LabHost } from '../../../_common/services/labManager/labManagerService';
import DockerNetworkCard from './DockerNetworkCard';

interface DockerNetworksDisplayProps {
  networksByHost: Record<string, Network[]>;
  findHostById: (hostId: string) => LabHost | undefined;
  onDeleteNetwork: (hostId: string, networkName: string) => void;
}

export const DockerNetworksDisplay: React.FC<DockerNetworksDisplayProps> = ({
  networksByHost,
  findHostById,
  onDeleteNetwork
}) => {
  return (
    <>
      {Object.entries(networksByHost).map(([hostId, hostNetworks]) => {
        const host = findHostById(hostId);
        if (!host || !hostNetworks || hostNetworks.length === 0) return null;

        return (
          <DashboardPane
            key={`net-${hostId}`}
            title={`${host.name} Docker Networks`}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {hostNetworks.map((network) => (
                <DockerNetworkCard
                  key={network.id}
                  network={network}
                  onDelete={() => onDeleteNetwork(hostId, network.name)}
                />
              ))}
            </div>
          </DashboardPane>
        );
      })}
    </>
  );
};
