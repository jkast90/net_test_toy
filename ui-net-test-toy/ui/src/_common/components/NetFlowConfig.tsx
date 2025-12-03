import React, { useState, useEffect } from 'react';
import { Button, Alert, ButtonGroup } from './ui';
import buttonCss from '../styles/Button.module.css';
import { useAppSelector } from '../store/hooks';
import { selectEnabledDaemonsForSelectedClients } from '../store/connectionSelectors';
import { netflowConfigService } from '../services/netflowConfigService';
import { useLabManager } from '../hooks/useLabManager';

interface NetFlowConfigProps {
  collectorAddress?: string;
  collectorPort?: number;
  onSuccess?: () => void;
}

interface NetFlowStatus {
  daemon: string;
  netflow: {
    enabled: boolean;
    running?: boolean;
    collector?: string;
    version?: number;
    method?: string;
  };
}

const NetFlowConfigRefactored: React.FC<NetFlowConfigProps> = ({
  collectorAddress = 'localhost',
  collectorPort = 2055,
  onSuccess
}) => {
  const { managedHosts, selectedHostId } = useLabManager();
  const currentHostUrl = managedHosts.find(h => h.id === selectedHostId)?.url || '';
  const targets = useAppSelector(selectEnabledDaemonsForSelectedClients);
  const [configuring, setConfiguring] = useState(false);
  const [status, setStatus] = useState<Record<string, NetFlowStatus>>({});
  const [message, setMessage] = useState<{ type: 'error' | 'success' | 'info'; text: string } | null>(null);

  // Advanced config options
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [config, setConfig] = useState({
    collector_address: collectorAddress,
    collector_port: collectorPort,
    version: 9,
    sampling_rate: 1,
    active_timeout: 60,
    inactive_timeout: 15,
    template_refresh_interval: 600
  });

  // Check NetFlow status for all targets using the service
  const checkStatus = async () => {
    if (!currentHostUrl) return;
    const statusMap: Record<string, NetFlowStatus> = {};

    for (const target of targets) {
      try {
        const netflowConfig = await netflowConfigService.getNetFlowConfig(currentHostUrl, target.daemon.name);
        if (netflowConfig) {
          statusMap[target.daemon.name] = {
            daemon: target.daemon.name,
            netflow: {
              enabled: true,
              collector: `${netflowConfig.address}:${netflowConfig.port}`,
              version: netflowConfig.version || 9
            }
          };
        } else {
          statusMap[target.daemon.name] = {
            daemon: target.daemon.name,
            netflow: { enabled: false }
          };
        }
      } catch (error) {
        console.error(`Failed to check NetFlow status for ${target.daemon.name}:`, error);
      }
    }

    setStatus(statusMap);
  };

  useEffect(() => {
    if (targets.length > 0) {
      checkStatus();
    }
  }, [targets]);

  const configureNetFlow = async (enable: boolean) => {
    if (targets.length === 0) {
      setMessage({ type: 'error', text: 'No daemons selected' });
      return;
    }

    if (!currentHostUrl) {
      setMessage({ type: 'error', text: 'No host URL configured' });
      return;
    }

    setConfiguring(true);
    setMessage(null);

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const target of targets) {
      try {
        if (enable) {
          // Enable NetFlow using the service
          await netflowConfigService.enableNetFlow(
            currentHostUrl,
            target.daemon.name,
            {
              address: config.collector_address,
              port: config.collector_port,
              version: config.version,
              enabled: true
            }
          );
          success++;
        } else {
          // Disable NetFlow using the service
          await netflowConfigService.disableNetFlow(currentHostUrl, target.daemon.name);
          success++;
        }
      } catch (err) {
        failed++;
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`${target.daemon.name}: ${errorMessage}`);
      }
    }

    setConfiguring(false);

    if (failed > 0) {
      setMessage({
        type: 'error',
        text: `Configured ${success}, failed ${failed}: ${errors.join(', ')}`
      });
    } else {
      setMessage({
        type: 'success',
        text: `Successfully ${enable ? 'enabled' : 'disabled'} NetFlow on ${success} daemon(s)`
      });
      if (onSuccess) {
        onSuccess();
      }
    }

    // Refresh status
    setTimeout(checkStatus, 1000);

    // Clear message after 5 seconds
    setTimeout(() => setMessage(null), 5000);
  };

  const enabledCount = Object.values(status).filter(s => s.netflow.enabled).length;

  return (
    <div style={{ padding: '1rem' }}>
      <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>NetFlow Configuration</h3>

      {message && (
        <Alert
          type={message.type}
          message={message.text}
          onClose={() => setMessage(null)}
          className="mb-4"
        />
      )}

      {targets.length === 0 ? (
        <Alert
          type="info"
          message="No daemons selected. Please select daemons to configure NetFlow."
        />
      ) : (
        <>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                {enabledCount} of {targets.length} daemons have NetFlow enabled
              </span>
              <ButtonGroup>
                <Button
                  onClick={() => configureNetFlow(true)}
                  disabled={configuring}
                  className={buttonCss.buttonPrimary}
                  style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                >
                  {configuring ? 'Configuring...' : 'Enable NetFlow'}
                </Button>
                <Button
                  onClick={() => configureNetFlow(false)}
                  disabled={configuring}
                  className={buttonCss.buttonDelete}
                  style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                >
                  Disable NetFlow
                </Button>
              </ButtonGroup>
            </div>

            {/* Basic Configuration */}
            <div style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '4px',
              padding: '1rem',
              marginBottom: '0.5rem'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Collector Address
                  </label>
                  <input
                    type="text"
                    value={config.collector_address}
                    onChange={(e) => setConfig({ ...config, collector_address: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.375rem 0.5rem',
                      fontSize: '0.875rem',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      backgroundColor: 'var(--card-bg)',
                      color: 'var(--text)'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Collector Port
                  </label>
                  <input
                    type="number"
                    value={config.collector_port}
                    onChange={(e) => setConfig({ ...config, collector_port: parseInt(e.target.value) })}
                    style={{
                      width: '100%',
                      padding: '0.375rem 0.5rem',
                      fontSize: '0.875rem',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      backgroundColor: 'var(--card-bg)',
                      color: 'var(--text)'
                    }}
                  />
                </div>
              </div>

              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                  padding: 0,
                  textDecoration: 'underline'
                }}
              >
                {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
              </button>

              {showAdvanced && (
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                        NetFlow Version
                      </label>
                      <select
                        value={config.version}
                        onChange={(e) => setConfig({ ...config, version: parseInt(e.target.value) })}
                        style={{
                          width: '100%',
                          padding: '0.375rem 0.5rem',
                          fontSize: '0.875rem',
                          border: '1px solid var(--border)',
                          borderRadius: '4px',
                          backgroundColor: 'var(--card-bg)',
                          color: 'var(--text)'
                        }}
                      >
                        <option value={5}>NetFlow v5</option>
                        <option value={9}>NetFlow v9</option>
                        <option value={10}>IPFIX (v10)</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                        Sampling Rate (1 = no sampling)
                      </label>
                      <input
                        type="number"
                        value={config.sampling_rate}
                        onChange={(e) => setConfig({ ...config, sampling_rate: parseInt(e.target.value) })}
                        min={1}
                        style={{
                          width: '100%',
                          padding: '0.375rem 0.5rem',
                          fontSize: '0.875rem',
                          border: '1px solid var(--border)',
                          borderRadius: '4px',
                          backgroundColor: 'var(--card-bg)',
                          color: 'var(--text)'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                        Active Timeout (seconds)
                      </label>
                      <input
                        type="number"
                        value={config.active_timeout}
                        onChange={(e) => setConfig({ ...config, active_timeout: parseInt(e.target.value) })}
                        min={1}
                        style={{
                          width: '100%',
                          padding: '0.375rem 0.5rem',
                          fontSize: '0.875rem',
                          border: '1px solid var(--border)',
                          borderRadius: '4px',
                          backgroundColor: 'var(--card-bg)',
                          color: 'var(--text)'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                        Inactive Timeout (seconds)
                      </label>
                      <input
                        type="number"
                        value={config.inactive_timeout}
                        onChange={(e) => setConfig({ ...config, inactive_timeout: parseInt(e.target.value) })}
                        min={1}
                        style={{
                          width: '100%',
                          padding: '0.375rem 0.5rem',
                          fontSize: '0.875rem',
                          border: '1px solid var(--border)',
                          borderRadius: '4px',
                          backgroundColor: 'var(--card-bg)',
                          color: 'var(--text)'
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Status Display */}
            {Object.keys(status).length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <h4 style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Daemon Status</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {targets.map((target) => {
                    const daemonStatus = status[target.daemon.name];
                    if (!daemonStatus) return null;

                    return (
                      <div
                        key={target.daemon.name}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.5rem',
                          backgroundColor: 'var(--color-surface)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '4px',
                          fontSize: '0.8125rem'
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: 600 }}>{target.daemon.name}</span>
                          <span style={{ marginLeft: '0.5rem', color: 'var(--text-muted)' }}>
                            ({target.daemon.type})
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {daemonStatus.netflow.enabled && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {daemonStatus.netflow.collector} (v{daemonStatus.netflow.version})
                            </span>
                          )}
                          <span
                            style={{
                              padding: '0.25rem 0.5rem',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              backgroundColor: daemonStatus.netflow.enabled
                                ? 'var(--success-bg, rgba(76, 175, 80, 0.1))'
                                : 'var(--error-bg, rgba(244, 67, 54, 0.1))',
                              color: daemonStatus.netflow.enabled
                                ? 'var(--success, #4CAF50)'
                                : 'var(--error, #f44336)'
                            }}
                          >
                            {daemonStatus.netflow.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default NetFlowConfigRefactored;