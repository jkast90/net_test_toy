/**
 * BMP Configuration Pane
 * Allows configuring BMP monitoring on BGP daemons
 */

import React from 'react';
import { DashboardPane, Button, Alert, EmptyState } from '../../../_common/components';
import buttonCss from '../../../_common/styles/Button.module.css';

interface BMPConfigurationPaneProps {
  targetsCount: number;
  monitoringConfigured: boolean;
  isConfiguring: boolean;
  configMessage: string | null;
  onConfigure: () => void;
}

export const BMPConfigurationPane: React.FC<BMPConfigurationPaneProps> = ({
  targetsCount,
  monitoringConfigured,
  isConfiguring,
  configMessage,
  onConfigure
}) => {
  return (
    <DashboardPane
      title="BMP Configuration"
      actions={
        <Button
          onClick={onConfigure}
          disabled={isConfiguring || targetsCount === 0}
          className={buttonCss.buttonPrimary}
        >
          {isConfiguring ? 'Configuring...' : 'Configure BMP'}
        </Button>
      }
    >
      {configMessage && (
        <div style={{ marginBottom: '1rem' }}>
          <Alert
            type={configMessage.includes('failed') ? 'error' : 'success'}
            message={configMessage}
          />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <strong>Status:</strong>{' '}
          <span style={{ color: monitoringConfigured ? 'var(--success)' : 'var(--text-muted)' }}>
            {monitoringConfigured ? 'Configured' : 'Not Configured'}
          </span>
        </div>

        <div>
          <strong>Selected Daemons:</strong> {targetsCount}
        </div>

        {!monitoringConfigured && (
          <EmptyState message="BMP monitoring is not configured. Click 'Configure BMP' to enable monitoring on selected daemons." />
        )}

        {monitoringConfigured && (
          <div style={{
            padding: '1rem',
            backgroundColor: 'var(--background-secondary)',
            borderRadius: '4px',
            fontSize: '0.875rem'
          }}>
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
              BMP monitoring is active. Peers and routes are being monitored in real-time.
            </p>
          </div>
        )}
      </div>
    </DashboardPane>
  );
};

export default BMPConfigurationPane;
