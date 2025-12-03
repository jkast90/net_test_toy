import React from 'react';
import BaseDialog from '../../../_common/components/ui/BaseDialog';
import { Button, ButtonGroup } from '../../../_common/components/ui';
import { ManagedHost } from '../../../_common/store/labManagerSlice';
import { COLOR_PALETTE, getDaemonColor } from '../../utils/colorPalette';
import buttonCss from '../../../_common/styles/Button.module.css';

interface CreateDaemonDialogProps {
  open: boolean;
  editingDaemonId?: string | null;
  isEditing?: boolean;
  daemonData?: any;
  newDaemon?: {
    daemon_type: string;
    name: string;
    asn: string;
    router_id: string;
    ip_address: string;
    network: string;
  };
  selectedHostId?: string;
  managedHosts?: ManagedHost[];
  onClose: () => void;
  onSave: () => void;
  onChange: (daemon: any) => void;
  onHostChange?: (hostId: string) => void;
  onFetchSuggestedConfig?: () => void;
}

export const CreateDaemonDialog: React.FC<CreateDaemonDialogProps> = ({
  open,
  editingDaemonId,
  isEditing,
  daemonData,
  newDaemon,
  selectedHostId,
  managedHosts = [],
  onClose,
  onSave,
  onChange,
  onHostChange,
  onFetchSuggestedConfig
}) => {
  // Use daemonData if provided (topology context), otherwise use newDaemon (lab manager context)
  const daemon = daemonData || newDaemon || {
    daemon_type: 'gobgp',
    name: '',
    asn: '',
    router_id: '',
    ip_address: '',
    network: 'netstream_lab_builder_network',
    color: getDaemonColor('gobgp')
  };
  const editing = isEditing !== undefined ? isEditing : !!editingDaemonId;

  // Ensure daemon has a color (use default if not set)
  const currentColor = daemon.color || getDaemonColor(daemon.daemon_type);

  return (
    <BaseDialog open={open} onClose={onClose} data-testid="create-daemon-dialog">
      <div style={{ padding: '1rem', maxWidth: '800px' }}>
        <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>{editing ? 'Edit BGP Daemon' : 'Create BGP Daemon'}</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          {/* Only show Lab Manager Host selector if managedHosts are provided */}
          {managedHosts.length > 0 && (
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500' }}>
                Lab Manager Host *
              </label>
              <select
                value={selectedHostId}
                onChange={(e) => {
                  onHostChange?.(e.target.value);
                  setTimeout(() => onFetchSuggestedConfig?.(), 0);
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: 'var(--input-bg)',
                  border: '1px solid var(--accent-dark)',
                  borderRadius: '4px',
                  color: 'var(--text)'
                }}
              >
                {managedHosts.filter(h => h.enabled).map(host => (
                  <option key={host.id} value={host.id}>
                    {host.name} ({host.status === 'connected' ? '✓' : host.status === 'error' ? '✗' : '○'})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500' }}>
              Daemon Type
            </label>
            <select
              value={daemon.daemon_type || 'gobgp'}
              onChange={(e) => onChange({ ...daemon, daemon_type: e.target.value })}
              style={{
                width: '100%',
                padding: '0.5rem',
                background: 'var(--input-bg)',
                border: '1px solid var(--accent-dark)',
                borderRadius: '4px',
                color: 'var(--text)'
              }}
            >
              <option value="gobgp">GoBGP</option>
              <option value="frr">FRR</option>
              <option value="exabgp">ExaBGP</option>
            </select>
          </div>

          {/* Color Picker - only show when not using Lab Manager hosts */}
          {managedHosts.length === 0 && (
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500' }}>
                Color
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {COLOR_PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => {
                      onChange({ ...daemon, color });
                    }}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '6px',
                      backgroundColor: color,
                      border: currentColor === color ? '3px solid #fff' : '1px solid var(--accent-dark)',
                      cursor: 'pointer',
                      padding: 0,
                      boxShadow: currentColor === color ? '0 0 0 3px var(--accent), 0 4px 8px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.2)',
                      transform: currentColor === color ? 'scale(1.1)' : 'scale(1)',
                      transition: 'all 0.2s ease',
                      outline: currentColor === color ? '2px solid var(--accent)' : 'none',
                      outlineOffset: '2px'
                    }}
                    title={color}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => onChange({ ...daemon, color: getDaemonColor(daemon.daemon_type) })}
                  style={{
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.75rem',
                    background: 'var(--surface-bg)',
                    border: '1px solid var(--accent-dark)',
                    borderRadius: '4px',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  title="Reset to default color for daemon type"
                >
                  Reset
                </button>
              </div>
            </div>
          )}

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500' }}>
              Container Name *
            </label>
            <input
              type="text"
              value={daemon.name || ''}
              onChange={(e) => onChange({ ...daemon, name: e.target.value })}
              placeholder="my-gobgp-1"
              disabled={editing}
              style={{
                width: '100%',
                padding: '0.5rem',
                background: editing ? 'var(--surface-bg)' : 'var(--input-bg)',
                border: '1px solid var(--accent-dark)',
                borderRadius: '4px',
                color: editing ? 'var(--text-muted)' : 'var(--text)',
                cursor: editing ? 'not-allowed' : 'text'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500' }}>
              ASN (auto-suggested)
            </label>
            <input
              type="number"
              value={daemon.asn || ''}
              onChange={(e) => onChange({ ...daemon, asn: e.target.value })}
              placeholder="65001"
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
              Router ID / IP Address (auto-suggested)
            </label>
            <input
              type="text"
              value={daemon.router_id || ''}
              onChange={(e) => onChange({
                ...daemon,
                router_id: e.target.value,
                ip_address: e.target.value
              })}
              placeholder="192.168.70.1"
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
        </div>

        <ButtonGroup>
          <Button
            className={buttonCss.buttonPrimary}
            onClick={onSave}
          >
            {editing ? 'Update' : 'Create'}
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

export default CreateDaemonDialog;
