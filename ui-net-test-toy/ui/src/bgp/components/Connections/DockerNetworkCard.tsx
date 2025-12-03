import React from 'react';
import Card from '../../../_common/components/Card';
import { Button, ButtonGroup } from '../../../_common/components';
import buttonCss from '../../../_common/styles/Button.module.css';

interface Network {
  id: string;
  name: string;
  driver: string;
  scope: string;
  subnet: string | null;
  gateway: string | null;
  container_count?: number;
  created?: string;
}

interface DockerNetworkCardProps {
  network: Network;
  onDelete: () => void;
}

const DockerNetworkCard: React.FC<DockerNetworkCardProps> = ({ network, onDelete }) => {
  const isSystemNetwork = ['bridge', 'host', 'none'].includes(network.name);

  return (
    <Card>
      <div style={{ marginBottom: '0.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '0.875rem', marginBottom: '0.25rem' }}>
          {network.name}
        </h3>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
          {network.id}
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: '0.35rem',
        fontSize: '0.75rem',
        marginBottom: '0.75rem'
      }}>
        <span style={{ color: 'var(--text-muted)' }}>Driver:</span>
        <span>{network.driver}</span>

        <span style={{ color: 'var(--text-muted)' }}>Scope:</span>
        <span>{network.scope}</span>

        {network.subnet && (
          <>
            <span style={{ color: 'var(--text-muted)' }}>Subnet:</span>
            <span style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{network.subnet}</span>
          </>
        )}

        {network.gateway && (
          <>
            <span style={{ color: 'var(--text-muted)' }}>Gateway:</span>
            <span style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{network.gateway}</span>
          </>
        )}
      </div>

      <ButtonGroup>
        {!isSystemNetwork && (
          <Button className={buttonCss.buttonDelete} onClick={onDelete}>
            Delete
          </Button>
        )}
      </ButtonGroup>
    </Card>
  );
};

export default DockerNetworkCard;
