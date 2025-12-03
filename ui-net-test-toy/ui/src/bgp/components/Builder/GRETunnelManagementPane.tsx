import React from 'react';

interface GRETunnelManagementPaneProps {
  onAddTunnel: () => void;
}

const GRETunnelManagementPane: React.FC<GRETunnelManagementPaneProps> = ({
  onAddTunnel
}) => {
  return (
    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
      <p>Manage GRE tunnels across lab hosts</p>
      <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        Select hosts and create point-to-point tunnels for network connectivity
      </p>
    </div>
  );
};

export default GRETunnelManagementPane;
