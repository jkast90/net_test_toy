import React from 'react';
import { Button, EmptyState, StatusBadge } from '../../_common/components/ui';
import Card from '../../_common/components/Card';
import CardGrid from '../../_common/components/CardGrid';
import { ManagedHost } from '../../_common/store/labManagerSlice';
import buttonCss from '../../_common/styles/Button.module.css';
import styles from './BGPDaemonsSection.module.css';

interface NetworkInfo {
  name: string;
  ips: string[];
}

interface LocalDaemon {
  id: string;
  name: string;
  status: string;
  daemon_type: string;
  asn: string;
  router_id: string;
  ip_address: string;
  api_port: string;
  networks?: (NetworkInfo | string)[];
}

interface BGPDaemonsSectionProps {
  localDaemons: Record<string, LocalDaemon[]>;
  managedHosts: ManagedHost[];
  selectedHostId: string;
  showTopology: boolean;
  onSelectedHostChange: (hostId: string) => void;
  onToggleTopology: () => void;
  onRestoreLab: () => void;
  onCreateDaemon: () => void;
  onToggleDaemonStatus: (hostId: string, daemonName: string, action: 'start' | 'stop') => void;
  onAssociateNetwork: (hostId: string, daemonName: string, mode: 'daemon') => void;
  onEditDaemon: (hostId: string, daemon: LocalDaemon) => void;
  onDeleteDaemon: (hostId: string, daemonName: string) => void;
}

const getDaemonTypeColor = (type: string) => {
  switch (type) {
    case 'gobgp': return '#4CAF50';
    case 'frr': return '#2196F3';
    case 'exabgp': return '#FF9800';
    default: return 'var(--accent)';
  }
};

const BGPDaemonsSection: React.FC<BGPDaemonsSectionProps> = ({
  localDaemons,
  managedHosts,
  selectedHostId,
  showTopology,
  onSelectedHostChange,
  onToggleTopology,
  onRestoreLab,
  onCreateDaemon,
  onToggleDaemonStatus,
  onAssociateNetwork,
  onEditDaemon,
  onDeleteDaemon
}) => {
  const hasDaemons = Object.keys(localDaemons).some(
    hostId => localDaemons[hostId] && localDaemons[hostId].length > 0
  );

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h2>BGP Daemons</h2>
          <p>Manage BGP daemon containers</p>
        </div>
        <div className={styles.actions}>
          <select
            value={selectedHostId}
            onChange={(e) => onSelectedHostChange(e.target.value)}
            className={styles.select}
          >
            {managedHosts.filter(h => h.enabled).map(host => (
              <option key={host.id} value={host.id}>{host.name}</option>
            ))}
          </select>
          <Button
            className={buttonCss.buttonSecondary}
            onClick={onToggleTopology}
            disabled={!selectedHostId}
          >
            {showTopology ? 'Hide' : 'View'} Topology
          </Button>
          <Button
            className={buttonCss.buttonSecondary}
            onClick={onRestoreLab}
            disabled={!selectedHostId}
          >
            Restore Lab
          </Button>
          <Button
            className={buttonCss.buttonPrimary}
            onClick={onCreateDaemon}
            disabled={!selectedHostId}
          >
            Create Daemon
          </Button>
        </div>
      </div>

      {Object.entries(localDaemons).map(([hostId, daemons]) => {
        const host = managedHosts.find(h => h.id === hostId);
        if (!host || !host.enabled || daemons.length === 0) return null;

        return (
          <div key={hostId} className={styles.hostGroup}>
            <h3 className={styles.hostName}>{host.name}</h3>
            <CardGrid columns={3}>
              {daemons.map((daemon) => (
                <Card key={daemon.id}>
                  <div className={styles.daemonHeader}>
                    <h3 className={styles.daemonName}>{daemon.name}</h3>
                    <span
                      className={styles.daemonTypeBadge}
                      style={{ background: getDaemonTypeColor(daemon.daemon_type) }}
                    >
                      {daemon.daemon_type.toUpperCase()}
                    </span>
                  </div>

                  <div className={styles.statusRow}>
                    <StatusBadge status={daemon.status} />
                  </div>

                  <div className={styles.detailsGrid}>
                    <span className={styles.label}>ASN:</span>
                    <span>{daemon.asn}</span>
                    <span className={styles.label}>Router ID:</span>
                    <span>{daemon.router_id}</span>
                    <span className={styles.label}>IP Address:</span>
                    <span>{daemon.ip_address}</span>
                    <span className={styles.label}>API Port:</span>
                    <span>{daemon.api_port}</span>
                  </div>

                  {daemon.networks && daemon.networks.length > 0 && (
                    <div className={styles.networksSection}>
                      <div className={styles.networksLabel}>Networks:</div>
                      <div className={styles.networkTags}>
                        {daemon.networks.map((network, idx) => {
                          const networkName = typeof network === 'string' ? network : network.name;
                          const networkIps = typeof network === 'string' ? [] : (network.ips || []);
                          return (
                            <span key={`${daemon.id}-${networkName}-${idx}`} className={styles.networkTag}>
                              {networkName}{networkIps.length > 0 ? `: ${networkIps.join(', ')}` : ''}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className={buttonCss.buttonGroup}>
                    {daemon.status === 'running' ? (
                      <Button
                        className={buttonCss.buttonSecondary}
                        onClick={() => onToggleDaemonStatus(hostId, daemon.name, 'stop')}
                      >
                        Stop
                      </Button>
                    ) : (
                      <Button
                        className={buttonCss.buttonSecondary}
                        onClick={() => onToggleDaemonStatus(hostId, daemon.name, 'start')}
                      >
                        Start
                      </Button>
                    )}
                    <Button
                      className={buttonCss.buttonSecondary}
                      onClick={() => onAssociateNetwork(hostId, daemon.name, 'daemon')}
                    >
                      Networks
                    </Button>
                    <Button
                      className={buttonCss.buttonSecondary}
                      onClick={() => onEditDaemon(hostId, daemon)}
                    >
                      Edit
                    </Button>
                    <Button className={buttonCss.buttonDelete} onClick={() => onDeleteDaemon(hostId, daemon.name)}>
                      Delete
                    </Button>
                  </div>
                </Card>
              ))}
            </CardGrid>
          </div>
        );
      })}

      {!hasDaemons && (
        <EmptyState
          message="No daemons found. Create one to start testing BGP."
          icon="🔧"
        />
      )}
    </section>
  );
};

export default BGPDaemonsSection;
