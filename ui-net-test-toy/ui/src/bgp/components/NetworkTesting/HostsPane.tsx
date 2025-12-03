/**
 * Hosts Pane Component
 * Displays list of available lab hosts with status
 */

import React from 'react';
import Card from '../../../_common/components/Card';

interface HostsPaneProps {
  hosts: any[]; // Using any to accept LabHost type from parent
}

export const HostsPane: React.FC<HostsPaneProps> = ({ hosts }) => {
  return (
    <Card>
      <h2 style={{ marginTop: 0 }}>Available Hosts</h2>
      <div style={{ fontSize: '0.875rem' }}>
        {hosts.map(host => (
          <div
            key={host.name}
            style={{
              padding: '0.75rem',
              marginBottom: '0.5rem',
              borderRadius: '4px',
              border: '1px solid var(--border)',
              backgroundColor: host.status === 'running' ? 'var(--card-bg)' : 'var(--error-bg)'
            }}
          >
            <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>
              {host.name}
              <span style={{
                marginLeft: '0.5rem',
                padding: '0.125rem 0.5rem',
                borderRadius: '4px',
                backgroundColor: host.status === 'running' ? 'var(--success)' : 'var(--error)',
                fontSize: '0.75rem'
              }}>
                {host.status}
              </span>
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
              Loopback: {host.loopback_ip} | API: localhost:{host.api_port}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
