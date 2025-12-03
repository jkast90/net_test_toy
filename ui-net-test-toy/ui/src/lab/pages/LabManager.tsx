import React, { useState, useEffect } from 'react';
import { Button } from '../../_common/components/ui';
import BaseDialog from '../../_common/components/ui/BaseDialog';
import buttonCss from '../../_common/styles/Button.module.css';
import styles from './LabManager.module.css';
import { containerManagerService } from '../../_common/services/containerManager';
import { LabDaemon, LabHost } from '../../_common/services/labManager/labManagerService';
import { useLabManager as useLabManagerHook } from '../../_common/hooks/useLabManager';

const LabManager: React.FC = () => {
  const { managedHosts, selectedHostId } = useLabManagerHook();
  const currentHostUrl = managedHosts.find(h => h.id === selectedHostId)?.url || '';

  const [daemons, setDaemons] = useState<LabDaemon[]>([]);
  const [hosts, setHosts] = useState<LabHost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dialogs
  const [showCreateDaemon, setShowCreateDaemon] = useState(false);
  const [showCreateHost, setShowCreateHost] = useState(false);
  const [editingDaemon, setEditingDaemon] = useState<string | null>(null); // Daemon name being edited
  const [editingHost, setEditingHost] = useState<string | null>(null); // Host name being edited

  // Form states for creating/editing daemon
  const [newDaemon, setNewDaemon] = useState({
    daemon_type: 'gobgp',
    name: '',
    asn: '',
    router_id: '',
    ip_address: '',
    api_port: ''
  });

  // Form states for creating/editing host
  const [newHost, setNewHost] = useState({
    name: '',
    gateway_daemon: '',
    gateway_ip: '',
    container_ip: '',
    loopback_ip: '',
    loopback_network: '24'
  });

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  // Fetch suggested config when opening create daemon dialog
  useEffect(() => {
    if (showCreateDaemon) {
      fetchSuggestedConfig();
    }
  }, [showCreateDaemon]);

  // Fetch next available IP when opening create host dialog
  useEffect(() => {
    if (showCreateHost) {
      fetchNextHostIp();
    }
  }, [showCreateHost]);

  const fetchData = async () => {
    if (!currentHostUrl) return;
    setLoading(true);
    try {
      const [daemonsData, hostsData] = await Promise.all([
        containerManagerService.getDaemons(currentHostUrl),
        containerManagerService.getHosts(currentHostUrl)
      ]);

      setDaemons(daemonsData || []);
      setHosts(hostsData || []);
      setError(null);
    } catch (err) {
      setError('Failed to fetch lab data. Is the container API running on port 5010?');
    } finally {
      setLoading(false);
    }
  };

  const fetchSuggestedConfig = async () => {
    if (!currentHostUrl) return;
    try {
      const config = await containerManagerService.getSuggestedDaemonConfig(currentHostUrl);
      setNewDaemon(prev => ({
        ...prev,
        asn: config.asn.toString(),
        router_id: config.router_id,
        ip_address: config.ip_address,
        api_port: config.api_port.toString()
      }));
    } catch (err) {
      console.error('Failed to fetch suggested config:', err);
    }
  };

  const fetchNextHostIp = async () => {
    if (!currentHostUrl) return;
    try {
      const data = await containerManagerService.getNextHostIp(currentHostUrl);
      setNewHost(prev => ({
        ...prev,
        container_ip: data.ip
      }));
    } catch (err) {
      console.error('Failed to fetch next IP:', err);
    }
  };

  const createDaemon = async () => {
    if (!currentHostUrl) return;
    try {
      await containerManagerService.createDaemon(currentHostUrl, {
        ...newDaemon,
        asn: parseInt(newDaemon.asn),
        ip_address: newDaemon.ip_address || undefined,
        api_port: newDaemon.api_port ? parseInt(newDaemon.api_port) : undefined
      });

      setShowCreateDaemon(false);
      setNewDaemon({
        daemon_type: 'gobgp',
        name: '',
        asn: '',
        router_id: '',
        ip_address: '',
        api_port: ''
      });
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create daemon');
    }
  };

  const deleteDaemon = async (name: string) => {
    if (!confirm(`Are you sure you want to delete daemon ${name}?`)) return;

    if (!currentHostUrl) return;
    try {
      await containerManagerService.deleteDaemon(currentHostUrl, name);

      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete daemon');
    }
  };

  const openEditDaemon = (daemon: LabDaemon) => {
    setEditingDaemon(daemon.name);
    setNewDaemon({
      daemon_type: daemon.daemon_type,
      name: daemon.name,
      asn: daemon.asn.toString(),
      router_id: daemon.router_id,
      ip_address: daemon.ip_address,
      api_port: daemon.api_port ? daemon.api_port.toString() : ''
    });
    setShowCreateDaemon(true);
  };

  const updateDaemon = async () => {
    if (!currentHostUrl || !editingDaemon) return;

    try {
      await containerManagerService.updateDaemon(currentHostUrl, editingDaemon, {
        asn: parseInt(newDaemon.asn),
        router_id: newDaemon.router_id,
        ip_address: newDaemon.ip_address || undefined
      });

      setShowCreateDaemon(false);
      setEditingDaemon(null);
      setNewDaemon({
        daemon_type: 'gobgp',
        name: '',
        asn: '',
        router_id: '',
        ip_address: '',
        api_port: ''
      });
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update daemon');
    }
  };

  const toggleDaemon = async (name: string, action: 'start' | 'stop') => {
    if (!currentHostUrl) return;
    try {
      await containerManagerService.controlDaemon(currentHostUrl, name, action);

      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : `Failed to ${action} daemon`);
    }
  };

  const createHost = async () => {
    if (!currentHostUrl) return;
    try {
      await containerManagerService.createHost(currentHostUrl, {
        ...newHost,
        container_ip: newHost.container_ip || undefined
      });

      setShowCreateHost(false);
      setNewHost({
        name: '',
        gateway_daemon: '',
        gateway_ip: '',
        container_ip: '',
        loopback_ip: '',
        loopback_network: '24'
      });
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create host');
    }
  };

  const deleteHost = async (name: string) => {
    if (!confirm(`Are you sure you want to delete host ${name}?`)) return;

    if (!currentHostUrl) return;
    try {
      await containerManagerService.deleteHost(currentHostUrl, name);

      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete host');
    }
  };

  const openEditHost = (host: LabHost) => {
    setEditingHost(host.name);
    setNewHost({
      name: host.name,
      gateway_daemon: host.gateway_daemon,
      gateway_ip: host.gateway_ip,
      container_ip: host.container_ip || '',
      loopback_ip: host.loopback_ip,
      loopback_network: host.loopback_network
    });
    setShowCreateHost(true);
  };

  const updateHost = async () => {
    if (!currentHostUrl || !editingHost) return;

    try {
      await containerManagerService.updateHost(currentHostUrl, editingHost, {
        gateway_daemon: newHost.gateway_daemon,
        gateway_ip: newHost.gateway_ip,
        loopback_ip: newHost.loopback_ip,
        loopback_network: newHost.loopback_network,
        container_ip: newHost.container_ip || undefined
      });

      setShowCreateHost(false);
      setEditingHost(null);
      setNewHost({
        name: '',
        gateway_daemon: '',
        gateway_ip: '',
        container_ip: '',
        loopback_ip: '',
        loopback_network: '24'
      });
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update host');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return styles.statusRunning;
      case 'exited':
        return styles.statusStopped;
      case 'created':
        return styles.statusCreated;
      default:
        return '';
    }
  };

  const getDaemonTypeColor = (type: string) => {
    switch (type) {
      case 'gobgp':
        return styles.typeGoBGP;
      case 'frr':
        return styles.typeFRR;
      case 'exabgp':
        return styles.typeExaBGP;
      default:
        return '';
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Lab Manager</h1>
        <p>Manage BGP daemons and host containers</p>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* Daemons Section */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>BGP Daemons</h2>
          <Button
            className={buttonCss.buttonPrimary}
            onClick={() => setShowCreateDaemon(true)}
          >
            Create Daemon
          </Button>
        </div>

        {loading && daemons.length === 0 ? (
          <div className={styles.loading}>Loading daemons...</div>
        ) : daemons.length === 0 ? (
          <div className={styles.empty}>No daemons found. Create one to get started!</div>
        ) : (
          <div className={styles.grid}>
            {daemons.map((daemon) => (
              <div key={daemon.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <h3>{daemon.name}</h3>
                    <span className={`${styles.badge} ${getDaemonTypeColor(daemon.daemon_type)}`}>
                      {daemon.daemon_type.toUpperCase()}
                    </span>
                  </div>
                  <span className={`${styles.status} ${getStatusColor(daemon.status)}`}>
                    {daemon.status}
                  </span>
                </div>

                <div className={styles.cardBody}>
                  <div className={styles.infoGrid}>
                    <span className={styles.label}>ASN:</span>
                    <span>{daemon.asn}</span>
                    <span className={styles.label}>Router ID:</span>
                    <span>{daemon.router_id}</span>
                    <span className={styles.label}>IP Address:</span>
                    <span>{daemon.ip_address}</span>
                    <span className={styles.label}>API Port:</span>
                    <span>{daemon.api_port}</span>
                  </div>
                </div>

                <div className={styles.cardFooter}>
                  <div className={buttonCss.buttonGroup}>
                    {daemon.status === 'running' ? (
                      <Button
                        className={buttonCss.buttonSecondary}
                        onClick={() => toggleDaemon(daemon.name, 'stop')}
                      >
                        Stop
                      </Button>
                    ) : (
                      <Button
                        className={buttonCss.buttonSecondary}
                        onClick={() => toggleDaemon(daemon.name, 'start')}
                      >
                        Start
                      </Button>
                    )}
                    <Button
                      className={buttonCss.buttonSecondary}
                      onClick={() => openEditDaemon(daemon)}
                      disabled={daemon.status === 'running'}
                      title={daemon.status === 'running' ? 'Stop daemon before editing' : 'Edit daemon'}
                    >
                      Edit
                    </Button>
                    <Button
                      className={buttonCss.buttonDanger}
                      onClick={() => deleteDaemon(daemon.name)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Hosts Section */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Host Containers</h2>
          <Button
            className={buttonCss.buttonPrimary}
            onClick={() => setShowCreateHost(true)}
          >
            Create Host
          </Button>
        </div>

        {hosts.length === 0 ? (
          <div className={styles.empty}>No hosts found. Create one to simulate networks behind daemons!</div>
        ) : (
          <div className={styles.grid}>
            {hosts.map((host) => (
              <div key={host.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3>{host.name}</h3>
                  <span className={`${styles.status} ${getStatusColor(host.status)}`}>
                    {host.status}
                  </span>
                </div>

                <div className={styles.cardBody}>
                  <div className={styles.infoGrid}>
                    <span className={styles.label}>Gateway:</span>
                    <span>{host.gateway_daemon}</span>
                    <span className={styles.label}>Gateway IP:</span>
                    <span>{host.gateway_ip}</span>
                    <span className={styles.label}>Loopback:</span>
                    <span>{host.loopback_ip}/{host.loopback_network}</span>
                    <span className={styles.label}>Container IP:</span>
                    <span>{host.container_ip}</span>
                  </div>
                </div>

                <div className={styles.cardFooter}>
                  <div className={buttonCss.buttonGroup}>
                    <Button
                      className={buttonCss.buttonSecondary}
                      onClick={() => openEditHost(host)}
                    >
                      Edit
                    </Button>
                    <Button
                      className={buttonCss.buttonDanger}
                      onClick={() => deleteHost(host.name)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Create/Edit Daemon Dialog */}
      <BaseDialog open={showCreateDaemon} onClose={() => {
        setShowCreateDaemon(false);
        setEditingDaemon(null);
        setNewDaemon({
          daemon_type: 'gobgp',
          name: '',
          asn: '',
          router_id: '',
          ip_address: '',
          api_port: ''
        });
      }}>
        <div className={styles.dialogContent}>
          <h2>{editingDaemon ? 'Edit BGP Daemon' : 'Create BGP Daemon'}</h2>

          <div className={styles.formGroup}>
            <label>Daemon Type</label>
            <select
              value={newDaemon.daemon_type}
              onChange={(e) => setNewDaemon({ ...newDaemon, daemon_type: e.target.value })}
              disabled={!!editingDaemon}
            >
              <option value="gobgp">GoBGP</option>
              <option value="frr">FRR</option>
              <option value="exabgp">ExaBGP</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Container Name *</label>
            <input
              type="text"
              value={newDaemon.name}
              onChange={(e) => setNewDaemon({ ...newDaemon, name: e.target.value })}
              placeholder="my-gobgp-1"
              readOnly={!!editingDaemon}
              style={editingDaemon ? { backgroundColor: 'var(--background)', cursor: 'not-allowed' } : {}}
            />
          </div>

          <div className={styles.formGroup}>
            <label>ASN {editingDaemon ? '' : '(auto-generated)'}</label>
            <input
              type="number"
              value={newDaemon.asn}
              onChange={(e) => setNewDaemon({ ...newDaemon, asn: e.target.value })}
              readOnly={!editingDaemon}
              placeholder={editingDaemon ? '' : 'Loading...'}
              style={!editingDaemon ? { backgroundColor: 'var(--background)', cursor: 'not-allowed' } : {}}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Router ID {editingDaemon ? '' : '(auto-generated)'}</label>
            <input
              type="text"
              value={newDaemon.router_id}
              onChange={(e) => setNewDaemon({ ...newDaemon, router_id: e.target.value })}
              readOnly={!editingDaemon}
              placeholder={editingDaemon ? '' : 'Loading...'}
              style={!editingDaemon ? { backgroundColor: 'var(--background)', cursor: 'not-allowed' } : {}}
            />
          </div>

          <div className={styles.formGroup}>
            <label>IP Address {editingDaemon ? '' : '(auto-generated)'}</label>
            <input
              type="text"
              value={newDaemon.ip_address}
              onChange={(e) => setNewDaemon({ ...newDaemon, ip_address: e.target.value })}
              readOnly={!editingDaemon}
              placeholder={editingDaemon ? '' : 'Loading...'}
              style={!editingDaemon ? { backgroundColor: 'var(--background)', cursor: 'not-allowed' } : {}}
            />
          </div>

          <div className={styles.formGroup}>
            <label>API Port (auto-generated)</label>
            <input
              type="number"
              value={newDaemon.api_port}
              readOnly
              placeholder="Loading..."
              style={{ backgroundColor: 'var(--background)', cursor: 'not-allowed' }}
            />
          </div>

          <div className={buttonCss.buttonGroup}>
            <Button
              className={buttonCss.buttonPrimary}
              onClick={editingDaemon ? updateDaemon : createDaemon}
            >
              {editingDaemon ? 'Update' : 'Create'}
            </Button>
            <Button
              className={buttonCss.buttonSecondary}
              onClick={() => {
                setShowCreateDaemon(false);
                setEditingDaemon(null);
                setNewDaemon({
                  daemon_type: 'gobgp',
                  name: '',
                  asn: '',
                  router_id: '',
                  ip_address: '',
                  api_port: ''
                });
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </BaseDialog>

      {/* Create/Edit Host Dialog */}
      <BaseDialog open={showCreateHost} onClose={() => {
        setShowCreateHost(false);
        setEditingHost(null);
        setNewHost({
          name: '',
          gateway_daemon: '',
          gateway_ip: '',
          container_ip: '',
          loopback_ip: '',
          loopback_network: '24'
        });
      }}>
        <div className={styles.dialogContent}>
          <h2>{editingHost ? 'Edit Host Container' : 'Create Host Container'}</h2>

          <div className={styles.formGroup}>
            <label>Host Name *</label>
            <input
              type="text"
              value={newHost.name}
              onChange={(e) => setNewHost({ ...newHost, name: e.target.value })}
              placeholder="host-1"
              readOnly={!!editingHost}
              style={editingHost ? { backgroundColor: 'var(--background)', cursor: 'not-allowed' } : {}}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Gateway Daemon *</label>
            <select
              value={newHost.gateway_daemon}
              onChange={(e) => {
                const selectedDaemon = daemons.find(d => d.name === e.target.value);
                setNewHost({
                  ...newHost,
                  gateway_daemon: e.target.value,
                  gateway_ip: selectedDaemon?.ip_address || ''
                });
              }}
            >
              <option value="">Select a daemon...</option>
              {daemons.map((daemon) => (
                <option key={daemon.id} value={daemon.name}>
                  {daemon.name} ({daemon.daemon_type.toUpperCase()}) - {daemon.ip_address}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Gateway IP (auto-filled)</label>
            <input
              type="text"
              value={newHost.gateway_ip}
              readOnly
              placeholder="Select daemon first"
              style={{ backgroundColor: 'var(--background)', cursor: 'not-allowed' }}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Loopback IP *</label>
            <input
              type="text"
              value={newHost.loopback_ip}
              onChange={(e) => setNewHost({ ...newHost, loopback_ip: e.target.value })}
              placeholder="10.1.0.1"
            />
          </div>

          <div className={styles.formGroup}>
            <label>Loopback Network (CIDR)</label>
            <input
              type="text"
              value={newHost.loopback_network}
              onChange={(e) => setNewHost({ ...newHost, loopback_network: e.target.value })}
              placeholder="24"
            />
          </div>

          <div className={styles.formGroup}>
            <label>Container IP (auto-assigned if empty)</label>
            <input
              type="text"
              value={newHost.container_ip}
              onChange={(e) => setNewHost({ ...newHost, container_ip: e.target.value })}
              placeholder="192.168.70.100"
            />
          </div>

          <div className={buttonCss.buttonGroup}>
            <Button
              className={buttonCss.buttonPrimary}
              onClick={editingHost ? updateHost : createHost}
            >
              {editingHost ? 'Update' : 'Create'}
            </Button>
            <Button
              className={buttonCss.buttonSecondary}
              onClick={() => {
                setShowCreateHost(false);
                setEditingHost(null);
                setNewHost({
                  name: '',
                  gateway_daemon: '',
                  gateway_ip: '',
                  container_ip: '',
                  loopback_ip: '',
                  loopback_network: '24'
                });
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </BaseDialog>
    </div>
  );
};

export default LabManager;
