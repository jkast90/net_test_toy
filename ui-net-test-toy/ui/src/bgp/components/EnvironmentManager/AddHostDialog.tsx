import React from 'react';
import BaseDialog from '../../../_common/components/ui/BaseDialog';
import { Button, ButtonGroup } from '../../../_common/components/ui';
import buttonCss from '../../../_common/styles/Button.module.css';

interface AddHostDialogProps {
  open: boolean;
  editingHostId: string | null;
  newHost: {
    name: string;
    hostname: string;
    port: string;
    url: string;
  };
  onClose: () => void;
  onSave: () => void;
  onChange: (host: { name: string; hostname: string; port: string; url: string }) => void;
}

export const AddHostDialog: React.FC<AddHostDialogProps> = ({
  open,
  editingHostId,
  newHost,
  onClose,
  onSave,
  onChange
}) => {
  return (
    <BaseDialog open={open} onClose={onClose}>
      <div style={{ padding: '1rem' }}>
        <h2 style={{ marginTop: 0 }}>{editingHostId ? 'Edit Lab Manager Host' : 'Add Lab Manager Host'}</h2>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500' }}>
            Host Name *
          </label>
          <input
            type="text"
            value={newHost.name}
            onChange={(e) => onChange({ ...newHost, name: e.target.value })}
            placeholder="Production Server"
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

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500' }}>
            Hostname *
          </label>
          <input
            type="text"
            value={newHost.hostname}
            onChange={(e) => onChange({ ...newHost, hostname: e.target.value })}
            placeholder="mini-pc.kast-dev.net"
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

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500' }}>
            Port *
          </label>
          <input
            type="text"
            value={newHost.port}
            onChange={(e) => onChange({ ...newHost, port: e.target.value })}
            placeholder="5010"
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

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500' }}>
            URL (auto-generated)
          </label>
          <input
            type="text"
            value={newHost.hostname && newHost.port ? `http://${newHost.hostname}:${newHost.port}` : ''}
            readOnly
            placeholder="Fill hostname and port"
            style={{
              width: '100%',
              padding: '0.5rem',
              background: 'var(--background)',
              border: '1px solid var(--accent-dark)',
              borderRadius: '4px',
              color: 'var(--text)',
              cursor: 'not-allowed',
              fontFamily: 'monospace'
            }}
          />
        </div>

        <ButtonGroup>
          <Button
            className={buttonCss.buttonPrimary}
            onClick={onSave}
          >
            {editingHostId ? 'Update Host' : 'Add Host'}
          </Button>
          <Button
            className={buttonCss.buttonSecondary}
            onClick={onClose}
          >
            Cancel
          </Button>
        </ButtonGroup>
      </div>
    </BaseDialog>
  );
};

export default AddHostDialog;
