import React from 'react';
import BaseDialog from '../../../_common/components/ui/BaseDialog';
import { Button, ButtonGroup } from '../../../_common/components/ui';
import { ManagedHost } from '../../../_common/store/labManagerSlice';
import { COLOR_PALETTE } from '../../utils/colorPalette';
import buttonCss from '../../../_common/styles/Button.module.css';

interface NetworkInterface {
  network: string;
  ipv4: string;
  gateway: string;
  mac?: string;
}

interface LocalDaemon {
  id: string;
  name: string;
  daemon_type: string;
  router_id: string;
  ip_address: string;
  interfaces?: NetworkInterface[];
}

interface CreateHostDialogProps {
  open: boolean;
  editingHostContainerId: string | null;
  newHostForm: {
    name: string;
    gateway_daemon: string;
    gateway_ip: string;
    container_ip: string;
    loopback_ip: string;
    loopback_network: string;
    network: string;
    color?: string;
  };
  selectedHostId?: string;
  managedHosts?: ManagedHost[];
  localDaemons?: Record<string, LocalDaemon[]>;
  onClose: () => void;
  onSave: () => void;
  onChange: (form: any) => void;
  onHostChange?: (hostId: string) => void;
  onFetchNextIp?: () => void;
}

export const CreateHostDialog: React.FC<CreateHostDialogProps> = ({
  open,
  editingHostContainerId,
  newHostForm,
  selectedHostId = '',
  managedHosts = [],
  localDaemons = {},
  onClose,
  onSave,
  onChange,
  onHostChange,
  onFetchNextIp
}) => {
  const currentColor = newHostForm.color || '#D7CCC8'; // Default host color

  return (
    <BaseDialog open={open} onClose={onClose} data-testid="create-host-dialog">
      <div style={{ padding: '1rem', maxWidth: '800px' }}>
        <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>{editingHostContainerId ? 'Edit Host Container' : 'Create Host Container'}</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
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
                      onChange({ ...newHostForm, color });
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
                  onClick={() => onChange({ ...newHostForm, color: '#D7CCC8' })}
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
                  title="Reset to default host color"
                >
                  Reset
                </button>
              </div>
            </div>
          )}

          {/* Row 1: Lab Manager Host, Hostname, Container IP */}
          {managedHosts.length > 0 && (
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500' }}>
                Lab Manager Host *
              </label>
              <select
                value={selectedHostId}
                onChange={(e) => {
                  onHostChange?.(e.target.value);
                  setTimeout(() => onFetchNextIp?.(), 0);
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
              Host Name *
            </label>
            <input
              type="text"
              value={newHostForm.name}
              onChange={(e) => onChange({ ...newHostForm, name: e.target.value })}
              placeholder="host-1"
              disabled={!!editingHostContainerId}
              style={{
                width: '100%',
                padding: '0.5rem',
                background: editingHostContainerId ? 'var(--surface-bg)' : 'var(--input-bg)',
                border: '1px solid var(--accent-dark)',
                borderRadius: '4px',
                color: editingHostContainerId ? 'var(--text-muted)' : 'var(--text)',
                cursor: editingHostContainerId ? 'not-allowed' : 'text'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500' }}>
              Container IP (auto-suggested with /32)
            </label>
            <input
              type="text"
              value={newHostForm.container_ip}
              onChange={(e) => onChange({ ...newHostForm, container_ip: e.target.value })}
              placeholder="192.168.70.11/32"
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

          {/* Row 2: Gateway Daemon, Gateway Interface, Interface IP */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500' }}>
              Gateway Daemon *
            </label>
            <select
              value={newHostForm.gateway_daemon}
              onChange={(e) => {
                onChange({
                  ...newHostForm,
                  gateway_daemon: e.target.value,
                  gateway_ip: '' // Clear gateway_ip when daemon changes, user will select interface
                });
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
              <option value="">Select a daemon...</option>
              {localDaemons[selectedHostId]?.map((daemon) => (
                <option key={daemon.id} value={daemon.name}>
                  {daemon.name} ({daemon.type?.toUpperCase() || 'UNKNOWN'}) - {daemon.ip_address}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500' }}>
              Gateway Interface *
            </label>
            <select
              value={newHostForm.gateway_ip}
              onChange={(e) => {
                const selectedIp = e.target.value;

                // Find the selected interface to get its network
                const selectedDaemon = localDaemons[selectedHostId]?.find(d => d.name === newHostForm.gateway_daemon);
                const selectedInterface = selectedDaemon?.interfaces?.find(iface => iface.ipv4 === selectedIp);

                // Extract first 3 octets for interface IP
                const ipParts = selectedIp.split('.');
                const interfaceIpPrefix = ipParts.length >= 3 ? `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.` : '';

                // Update gateway_ip, network, and interface_ip
                onChange({
                  ...newHostForm,
                  gateway_ip: selectedIp,
                  network: selectedInterface?.network || newHostForm.network,
                  loopback_ip: interfaceIpPrefix // Use loopback_ip field to store interface IP prefix
                });
              }}
              disabled={!newHostForm.gateway_daemon}
              style={{
                width: '100%',
                padding: '0.5rem',
                background: newHostForm.gateway_daemon ? 'var(--input-bg)' : 'var(--surface-bg)',
                border: '1px solid var(--accent-dark)',
                borderRadius: '4px',
                color: newHostForm.gateway_daemon ? 'var(--text)' : 'var(--text-muted)',
                cursor: newHostForm.gateway_daemon ? 'pointer' : 'not-allowed'
              }}
            >
              <option value="">Select a gateway interface...</option>
              {(() => {
                const selectedDaemon = localDaemons[selectedHostId]?.find(d => d.name === newHostForm.gateway_daemon);
                if (!selectedDaemon?.interfaces || selectedDaemon.interfaces.length === 0) {
                  return <option value="" disabled>No interfaces available</option>;
                }
                return selectedDaemon.interfaces.map((iface, idx) => (
                  <option key={idx} value={iface.ipv4}>
                    {iface.network} - {iface.ipv4}
                  </option>
                ));
              })()}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500' }}>
              Interface IP *
            </label>
            <input
              type="text"
              value={newHostForm.loopback_ip}
              onChange={(e) => onChange({ ...newHostForm, loopback_ip: e.target.value })}
              placeholder="192.168.70."
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
            {editingHostContainerId ? 'Update' : 'Create'}
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

export default CreateHostDialog;
