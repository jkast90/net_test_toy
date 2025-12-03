/**
 * GRE Tunnel Management Pane Component
 * Displays host selection for viewing GRE tunnels across lab hosts
 */

import React from 'react';
import { DashboardPane, Button, Alert } from '../../../_common/components';
import { LabHost } from '../../../_common/services/labManager/labManagerService';
import buttonCss from '../../../_common/styles/Button.module.css';

interface GreTunnelManagementPaneProps {
  enabledHosts: LabHost[];
  selectedHostIds: string[];
  onToggleHost: (hostId: string) => void;
  onCreateTunnel: () => void;
}

export const GreTunnelManagementPane: React.FC<GreTunnelManagementPaneProps> = ({
  enabledHosts,
  selectedHostIds,
  onToggleHost,
  onCreateTunnel
}) => {
  return (
    <DashboardPane
      title="GRE Tunnel Management"
      actions={
        <Button
          className={buttonCss.buttonPrimary}
          onClick={onCreateTunnel}
        >
          Create Tunnel
        </Button>
      }
    >
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
          Select Lab Manager Hosts:
        </label>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {enabledHosts.map(host => (
            <label key={host.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selectedHostIds.includes(host.id)}
                onChange={() => onToggleHost(host.id)}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.875rem' }}>{host.name}</span>
            </label>
          ))}
        </div>
      </div>

      {selectedHostIds.length === 0 && (
        <Alert type="info" message="Select at least one lab manager host to view GRE tunnels" />
      )}
    </DashboardPane>
  );
};
