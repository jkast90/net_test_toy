import React from 'react';
import { Button } from '../../_common/components/ui';
import Card from '../../_common/components/Card';
import CardGrid from '../../_common/components/CardGrid';
import buttonCss from '../../_common/styles/Button.module.css';

interface Network {
  id: string;
  name: string;
  driver: string;
  scope: string;
  subnet: string | null;
  gateway: string | null;
}

interface DockerNetworksProps {
  networks: Record<string, Network[]>;
  onCreateNetwork: () => void;
  onDeleteNetwork: (hostId: string, networkName: string) => void;
}

const DockerNetworks: React.FC<DockerNetworksProps> = ({
  networks,
  onCreateNetwork,
  onDeleteNetwork
}) => {
  const hasNetworks = Object.keys(networks).some(hostId => networks[hostId]?.length > 0);

  return (
    <section style={{ marginBottom: '3rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, marginBottom: '0.25rem' }}>Docker Networks</h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Manage Docker networks for container connectivity
          </p>
        </div>
        <Button
          className={buttonCss.buttonPrimary}
          onClick={onCreateNetwork}
        >
          Create Network
        </Button>
      </div>

      {Object.entries(networks).map(([hostId, hostNetworks]) => {
        if (!hostNetworks || hostNetworks.length === 0) return null;

        return (
          <div key={hostId} style={{ marginBottom: '2rem' }}>
            <CardGrid columns={5}>
              {hostNetworks.map((network) => (
                <Card key={network.id}>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', marginBottom: '0.25rem' }}>
                      {network.name}
                    </h3>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {network.id}
                    </div>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr',
                    gap: '0.5rem',
                    fontSize: '0.875rem',
                    marginBottom: '1rem'
                  }}>
                    <span style={{ color: 'var(--text-muted)' }}>Driver:</span>
                    <span>{network.driver}</span>

                    <span style={{ color: 'var(--text-muted)' }}>Scope:</span>
                    <span>{network.scope}</span>

                    {network.subnet && (
                      <>
                        <span style={{ color: 'var(--text-muted)' }}>Subnet:</span>
                        <span style={{ fontFamily: 'monospace' }}>{network.subnet}</span>
                      </>
                    )}

                    {network.gateway && (
                      <>
                        <span style={{ color: 'var(--text-muted)' }}>Gateway:</span>
                        <span style={{ fontFamily: 'monospace' }}>{network.gateway}</span>
                      </>
                    )}
                  </div>

                  <div className={buttonCss.buttonGroup}>
                    {!['bridge', 'host', 'none'].includes(network.name) && (
                      <Button className={buttonCss.buttonDelete} onClick={() => onDeleteNetwork(hostId, network.name)}>
                        Delete
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </CardGrid>
          </div>
        );
      })}

      {!hasNetworks && (
        <Card>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            No custom Docker networks found. System networks (bridge, host, none) are hidden.
          </p>
        </Card>
      )}
    </section>
  );
};

export default DockerNetworks;
