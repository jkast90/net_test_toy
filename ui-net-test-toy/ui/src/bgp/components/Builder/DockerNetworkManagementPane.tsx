/**
 * Docker Network Management Pane
 * Provides interface for creating and managing Docker networks across lab hosts
 */

import React from 'react';

interface DockerNetworkManagementPaneProps {
  onAddNetwork: () => void;
}

const DockerNetworkManagementPane: React.FC<DockerNetworkManagementPaneProps> = ({
  onAddNetwork
}) => {
  return (
    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
      <p>Create and manage Docker networks for container connectivity across lab hosts.</p>
      <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        System networks (bridge, host, none) are hidden from the display.
      </p>
    </div>
  );
};

export default DockerNetworkManagementPane;
