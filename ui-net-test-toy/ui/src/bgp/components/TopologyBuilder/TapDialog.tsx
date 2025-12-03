/**
 * Tap Dialog Component
 * Create NetFlow taps on container interfaces
 */

import React, { useState, useEffect } from 'react';
import { Button } from '../../../_common/components';
import BaseDialog from '../../../_common/components/ui/BaseDialog';
import buttonCss from '../../../_common/styles/Button.module.css';
import formCss from '../../../_common/styles/forms.module.css';
import { tapService, TapInfo } from '../../services/tapService';

interface TapDialogProps {
  isOpen: boolean;
  onClose: () => void;
  containerManagerUrl: string;
  appConfig: any;
  topologyDetails?: any;
  topologyName?: string | null;
  onTapCreated?: () => void;
  preselectedContainer?: string | null;
}

export const TapDialog: React.FC<TapDialogProps> = ({
  isOpen,
  onClose,
  containerManagerUrl,
  appConfig,
  topologyDetails,
  topologyName,
  onTapCreated,
  preselectedContainer
}) => {
  const [containerName, setContainerName] = useState('');
  const [interface_, setInterface] = useState('');
  const [netflowVersion, setNetflowVersion] = useState(5);
  const [existingTaps, setExistingTaps] = useState<TapInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [availableInterfaces, setAvailableInterfaces] = useState<Array<{ containerInterface: string; displayName: string }>>([]);

  // Get list of all running containers (daemons + hosts)
  const allContainers = [
    ...(appConfig?.daemons || []).filter((d: any) => d.status === 'running'),
    ...(appConfig?.hosts || []).filter((h: any) => h.status === 'running')
  ];

  // Load existing taps and set preselected container
  useEffect(() => {
    if (isOpen) {
      loadTaps();
      // Set preselected container if provided
      if (preselectedContainer) {
        setContainerName(preselectedContainer);
      }
    }
  }, [isOpen, preselectedContainer]);

  // Update available interfaces when container changes
  useEffect(() => {
    if (containerName) {
      loadInterfaces(containerName);
    } else {
      setAvailableInterfaces([]);
      setInterface('');
    }
  }, [containerName]);

  const loadTaps = async () => {
    const result = await tapService.listTaps(containerManagerUrl);
    if (result.success && result.taps) {
      setExistingTaps(result.taps);
    }
  };

  const loadInterfaces = async (container: string) => {
    // Get interfaces from topology data first (preferred source)
    let interfaces: Array<{ containerInterface: string; displayName: string }> = [];

    if (topologyDetails) {
      // Check if it's a daemon
      const daemon = topologyDetails.daemons?.find((d: any) => d.name === container);
      if (daemon && daemon.interfaces && Array.isArray(daemon.interfaces)) {
        interfaces = daemon.interfaces
          .map((iface: any, index: number) => ({
            containerInterface: iface.name || `eth${index}`,
            displayName: iface.network || iface.name || `eth${index}`
          }))
          .filter((iface) => iface.containerInterface && iface.containerInterface.trim() !== '');
      }

      // If not found in daemons, check hosts
      if (interfaces.length === 0) {
        const host = topologyDetails.hosts?.find((h: any) => h.name === container);
        if (host && host.interfaces && Array.isArray(host.interfaces)) {
          interfaces = host.interfaces
            .map((iface: any, index: number) => ({
              containerInterface: iface.name || `eth${index}`,
              displayName: iface.network || iface.name || `eth${index}`
            }))
            .filter((iface) => iface.containerInterface && iface.containerInterface.trim() !== '');
        }
      }
    }

    // Fallback to appConfig if topology data doesn't have interfaces
    if (interfaces.length === 0) {
      const containerInfo = allContainers.find((c: any) => c.name === container);
      if (containerInfo) {
        if (containerInfo.interfaces && Array.isArray(containerInfo.interfaces)) {
          interfaces = containerInfo.interfaces
            .map((iface: any, index: number) => ({
              containerInterface: iface.name || `eth${index}`,
              displayName: iface.network || iface.name || `eth${index}`
            }))
            .filter((iface) => iface.containerInterface && iface.containerInterface.trim() !== '');
        }

        // Final fallback: infer from networks array
        if (interfaces.length === 0 && containerInfo.networks && Array.isArray(containerInfo.networks)) {
          interfaces = containerInfo.networks.map((network: any, index: number) => ({
            containerInterface: `eth${index}`,
            displayName: typeof network === 'string' ? network : network.name || `eth${index}`
          }));
        }
      }
    }

    setAvailableInterfaces(interfaces);

    // Auto-select first interface if available
    if (interfaces.length > 0 && !interface_) {
      setInterface(interfaces[0].containerInterface);
    }
  };

  const handleCreate = async () => {
    if (!containerName || !interface_) {
      alert('Please select a container and interface');
      return;
    }

    setIsLoading(true);

    try {
      const result = await tapService.createTap(containerManagerUrl, {
        container_name: containerName,
        interface: interface_,
        netflow_version: netflowVersion,
        topology_name: topologyName || undefined
      });

      if (result.success) {
        alert(`Tap created successfully: ${result.data?.tap_name}`);
        setContainerName('');
        setInterface('');
        setNetflowVersion(5);
        await loadTaps();
        onTapCreated?.();
      } else {
        alert(`Failed to create tap: ${result.error}`);
      }
    } catch (error) {
      alert(`Error creating tap: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (tap: TapInfo) => {
    if (!confirm(`Delete tap ${tap.tap_name}?`)) {
      return;
    }

    try {
      const result = await tapService.deleteTap(
        containerManagerUrl,
        tap.target_container,
        tap.target_interface
      );

      if (result.success) {
        alert('Tap deleted successfully');
        await loadTaps();
        onTapCreated?.();
      } else {
        alert(`Failed to delete tap: ${result.error}`);
      }
    } catch (error) {
      alert(`Error deleting tap: ${error}`);
    }
  };

  return (
    <BaseDialog
      open={isOpen}
      onClose={onClose}
    >
      <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>NetFlow Tap Manager</h2>

        {/* Create Tap Section */}
        <div>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1rem' }}>
            Create New Tap
          </h3>
          <div className={formCss.formGrid}>
            <div className={formCss.formGroup}>
              <label className={formCss.label}>Container</label>
              <select
                className={formCss.input}
                value={containerName}
                onChange={(e) => setContainerName(e.target.value)}
                disabled={isLoading}
              >
                <option value="">Select container...</option>
                {allContainers.map((container: any) => (
                  <option key={container.name} value={container.name}>
                    {container.name} ({container.type || 'host'})
                  </option>
                ))}
              </select>
            </div>

            <div className={formCss.formGroup}>
              <label className={formCss.label}>Interface</label>
              <select
                className={formCss.input}
                value={interface_}
                onChange={(e) => setInterface(e.target.value)}
                disabled={isLoading || !containerName || availableInterfaces.length === 0}
              >
                <option value="">Select interface...</option>
                {availableInterfaces.map((iface) => (
                  <option key={iface.containerInterface} value={iface.containerInterface}>
                    {iface.displayName} ({iface.containerInterface})
                  </option>
                ))}
              </select>
              {containerName && availableInterfaces.length === 0 && (
                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  No interfaces found for this container
                </small>
              )}
            </div>

            <div className={formCss.formGroup}>
              <label className={formCss.label}>NetFlow Version</label>
              <select
                className={formCss.input}
                value={netflowVersion}
                onChange={(e) => setNetflowVersion(parseInt(e.target.value))}
                disabled={isLoading}
              >
                <option value={5}>NetFlow v5</option>
                <option value={9}>NetFlow v9 (IPFIX)</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <Button
              onClick={handleCreate}
              disabled={isLoading || !containerName || !interface_}
              className={buttonCss.buttonPrimary}
            >
              {isLoading ? 'Creating...' : 'Create Tap'}
            </Button>
          </div>
        </div>

        {/* Existing Taps Section */}
        <div>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1rem' }}>
            Existing Taps ({existingTaps.length})
          </h3>
          {existingTaps.length === 0 ? (
            <div
              style={{
                padding: '2rem',
                textAlign: 'center',
                color: 'var(--text-muted)',
                backgroundColor: 'var(--background-secondary)',
                borderRadius: '4px'
              }}
            >
              No taps created yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {existingTaps.map((tap) => (
                <div
                  key={tap.tap_name}
                  style={{
                    padding: '0.75rem',
                    backgroundColor: 'var(--background-secondary)',
                    borderRadius: '4px',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                      📡 {tap.tap_name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      {tap.target_container} → {tap.target_interface}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Status: {tap.status}
                    </div>
                  </div>
                  <Button
                    onClick={() => handleDelete(tap)}
                    className={buttonCss.buttonDelete}
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </BaseDialog>
  );
};
