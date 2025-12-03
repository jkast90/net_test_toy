import React from 'react';
import { Button } from '../../_common/components/ui';
import BaseDialog from '../../_common/components/ui/BaseDialog';
import buttonCss from '../../_common/styles/Button.module.css';

interface CreateNetworkDialogProps {
  open: boolean;
  newNetwork: {
    name: string;
    subnet: string;
    gateway: string;
    driver: string;
  };
  onClose: () => void;
  onChange: (field: string, value: string) => void;
  onCreate: () => void;
}

const CreateNetworkDialog: React.FC<CreateNetworkDialogProps> = ({
  open,
  newNetwork,
  onClose,
  onChange,
  onCreate
}) => {
  return (
    <BaseDialog open={open} onClose={onClose}>
      <div style={{ padding: '1rem', maxWidth: '600px' }}>
        <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Create Docker Network</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500' }}>
              Network Name *
            </label>
            <input
              type="text"
              value={newNetwork.name}
              onChange={(e) => onChange('name', e.target.value)}
              placeholder="my-network"
              style={{
                width: '100%',
                padding: '0.5rem',
                background: 'var(--input-bg)',
                border: '1px solid var(--accent-dark)',
                borderRadius: '4px',
                color: 'var(--text)'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500' }}>
              Subnet (CIDR) *
            </label>
            <input
              type="text"
              value={newNetwork.subnet}
              onChange={(e) => onChange('subnet', e.target.value)}
              placeholder="192.168.100.0/24"
              style={{
                width: '100%',
                padding: '0.5rem',
                background: 'var(--input-bg)',
                border: '1px solid var(--accent-dark)',
                borderRadius: '4px',
                color: 'var(--text)',
                fontFamily: 'monospace'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500' }}>
              Gateway IP *
            </label>
            <input
              type="text"
              value={newNetwork.gateway}
              onChange={(e) => onChange('gateway', e.target.value)}
              placeholder="192.168.100.1"
              style={{
                width: '100%',
                padding: '0.5rem',
                background: 'var(--input-bg)',
                border: '1px solid var(--accent-dark)',
                borderRadius: '4px',
                color: 'var(--text)',
                fontFamily: 'monospace'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500' }}>
              Driver
            </label>
            <select
              value={newNetwork.driver}
              onChange={(e) => onChange('driver', e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                background: 'var(--input-bg)',
                border: '1px solid var(--accent-dark)',
                borderRadius: '4px',
                color: 'var(--text)'
              }}
            >
              <option value="bridge">bridge</option>
              <option value="overlay">overlay</option>
              <option value="macvlan">macvlan</option>
            </select>
          </div>
        </div>

        <div className={buttonCss.buttonGroup}>
          <Button
            className={buttonCss.buttonPrimary}
            onClick={onCreate}
          >
            Create
          </Button>
          <Button
            className={buttonCss.buttonSecondary}
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </div>
    </BaseDialog>
  );
};

export default CreateNetworkDialog;
