import React from 'react';
import BaseDialog from '../../../_common/components/ui/BaseDialog';
import { Button, ButtonGroup } from '../../../_common/components/ui';
import buttonCss from '../../../_common/styles/Button.module.css';

interface Network {
  id: string;
  name: string;
  driver: string;
  subnet?: string;
}

interface NetworkAssociationDialogProps {
  open: boolean;
  associationContainerName: string;
  associationMode: string;
  associationHostId: string;
  networks: Record<string, Network[]>;
  containerNetworks: string[];
  networkIpAddresses: Record<string, string>;
  onClose: () => void;
  onConnectNetwork: (networkName: string) => void;
  onDisconnectNetwork: (networkName: string) => void;
  onAddIpToInterface: (networkName: string) => void;
  onNetworkIpChange: (addresses: Record<string, string>) => void;
}

export const NetworkAssociationDialog: React.FC<NetworkAssociationDialogProps> = ({
  open,
  associationContainerName,
  associationMode,
  associationHostId,
  networks,
  containerNetworks,
  networkIpAddresses,
  onClose,
  onConnectNetwork,
  onDisconnectNetwork,
  onAddIpToInterface,
  onNetworkIpChange
}) => {
  return (
    <BaseDialog
      open={open}
      onClose={onClose}
    >
      <div style={{ padding: '1rem', maxWidth: '600px' }}>
        <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>
          Manage Networks for {associationContainerName}
        </h2>

        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          Connect or disconnect this {associationMode} from Docker networks
        </p>

        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Available Networks</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {(networks[associationHostId] || []).map((network) => {
              const isConnected = containerNetworks.includes(network.name);
              return (
                <div
                  key={network.id}
                  style={{
                    padding: '0.75rem',
                    background: 'var(--card-bg)',
                    border: `1px solid ${isConnected ? 'var(--success)' : 'var(--accent-dark)'}`,
                    borderRadius: '4px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: '500' }}>{network.name}</span>
                        {isConnected && (
                          <span style={{
                            padding: '0.125rem 0.5rem',
                            background: 'rgba(16, 185, 129, 0.2)',
                            border: '1px solid var(--success)',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            color: 'var(--success)',
                            fontWeight: '600'
                          }}>
                            CONNECTED
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {network.subnet && `${network.subnet} - `}
                        {network.driver}
                      </div>
                    </div>
                    <ButtonGroup>
                      {isConnected ? (
                        <Button
                          className={buttonCss.buttonSecondary}
                          onClick={() => onDisconnectNetwork(network.name)}
                          style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}
                        >
                          Disconnect
                        </Button>
                      ) : (
                        <Button
                          className={buttonCss.buttonPrimary}
                          onClick={() => onConnectNetwork(network.name)}
                          style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}
                        >
                          Connect
                        </Button>
                      )}
                    </ButtonGroup>
                  </div>
                  <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={networkIpAddresses[network.name] || ''}
                      onChange={(e) => onNetworkIpChange({ ...networkIpAddresses, [network.name]: e.target.value })}
                      onFocus={(e) => {
                        // Auto-fill network prefix if field is empty
                        if (!networkIpAddresses[network.name] && network.subnet) {
                          const parts = network.subnet.split('/')[0].split('.');
                          if (parts.length === 4) {
                            const prefix = `${parts[0]}.${parts[1]}.${parts[2]}.`;
                            onNetworkIpChange({ ...networkIpAddresses, [network.name]: prefix });
                          }
                        }
                      }}
                      placeholder={`IP address ${isConnected ? '(add to interface)' : '(optional)'}`}
                      style={{
                        flex: 1,
                        padding: '0.4rem',
                        background: 'var(--input-bg)',
                        border: '1px solid var(--accent-dark)',
                        borderRadius: '4px',
                        color: 'var(--text)',
                        fontSize: '0.85rem'
                      }}
                    />
                    {isConnected && (
                      <Button
                        className={buttonCss.buttonPrimary}
                        onClick={() => onAddIpToInterface(network.name)}
                        style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem', whiteSpace: 'nowrap' }}
                      >
                        Add IP
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {(!networks[associationHostId] || networks[associationHostId].length === 0) && (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              No networks available. Create a network first.
            </p>
          )}
        </div>

        <ButtonGroup>
          <Button
            className={buttonCss.buttonSecondary}
            onClick={onClose}
          >
            Close
          </Button>
        </ButtonGroup>
      </div>
    </BaseDialog>
  );
};

export default NetworkAssociationDialog;
