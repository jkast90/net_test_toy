/**
 * Monitoring Unavailable State Component
 * Displays a user-friendly message when the monitoring service is not available
 */

import React from 'react';
import PageLayout from './PageLayout';
import { NavBarPageHeader } from './layout';
import { Alert } from './ui';

export interface MonitoringUnavailableStateProps {
  title: string;
  subtitle: string;
  configMessage?: string | null;
}

export const MonitoringUnavailableState: React.FC<MonitoringUnavailableStateProps> = ({
  title,
  subtitle,
  configMessage
}) => {
  return (
    <PageLayout>
      <NavBarPageHeader
        title={title}
        subtitle={subtitle}
      />
      <div style={{
        padding: '3rem',
        textAlign: 'center',
        backgroundColor: 'var(--background-secondary)',
        borderRadius: '8px',
        margin: '2rem 0'
      }}>
        <h3 style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Monitoring Service Not Available
        </h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
          The monitoring service is not running. Please ensure the monitoring container is started.
        </p>
        {configMessage && (
          <div style={{ marginTop: '1rem' }}>
            <Alert
              type={configMessage.includes('failed') ? 'error' : 'success'}
              message={configMessage}
            />
          </div>
        )}
      </div>
    </PageLayout>
  );
};
