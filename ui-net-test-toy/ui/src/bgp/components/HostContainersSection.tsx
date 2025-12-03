import React from 'react';
import { Button, EmptyState, StatusBadge } from '../../_common/components/ui';
import Card from '../../_common/components/Card';
import CardGrid from '../../_common/components/CardGrid';
import { ManagedHost } from '../../_common/store/labManagerSlice';
import buttonCss from '../../_common/styles/Button.module.css';
import styles from './HostContainersSection.module.css';

interface NetworkInfo {
  name: string;
  ips: string[];
}

interface Host {
  id: string;
  name: string;
  status: string;
  gateway_daemon: string;
  gateway_ip: string;
  loopback_ip: string;
  loopback_network: string;
  container_ip: string;
  networks?: (NetworkInfo | string)[];
}

interface HostContainersSectionProps {
  hosts: Record<string, Host[]>;
  managedHosts: ManagedHost[];
  selectedHostId: string;
  onSelectedHostChange: (hostId: string) => void;
  onCreateHost: () => void;
  onExecCommand: (hostId: string, hostName: string) => void;
  onAssociateNetwork: (hostId: string, hostName: string, mode: 'host') => void;
  onEditHost: (hostId: string, host: Host) => void;
  onDeleteHost: (hostId: string, hostName: string) => void;
}

const HostContainersSection: React.FC<HostContainersSectionProps> = ({
  hosts,
  managedHosts,
  selectedHostId,
  onSelectedHostChange,
  onCreateHost,
  onExecCommand,
  onAssociateNetwork,
  onEditHost,
  onDeleteHost
}) => {
  const hasHosts = Object.keys(hosts).some(
    hostId => hosts[hostId] && hosts[hostId].length > 0
  );

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h2>Host Containers</h2>
          <p>Simulated network hosts behind BGP daemons</p>
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
            className={buttonCss.buttonPrimary}
            onClick={onCreateHost}
          >
            Create Host
          </Button>
        </div>
      </div>

      {Object.entries(hosts).map(([hostId, hostList]) => {
        const managedHost = managedHosts.find(h => h.id === hostId);
        if (!managedHost || hostList.length === 0) return null;

        return (
          <div key={hostId} className={styles.hostGroup}>
            <h3 className={styles.hostGroupName}>{managedHost.name}</h3>
            <CardGrid columns={3}>
              {hostList.map((host) => (
                <Card key={host.id}>
                  <div className={styles.hostHeader}>
                    <h3 className={styles.hostName}>{host.name}</h3>
                    <StatusBadge status={host.status} />
                  </div>

                  <div className={styles.detailsGrid}>
                    <span className={styles.label}>Gateway:</span>
                    <span>{host.gateway_daemon}</span>
                    <span className={styles.label}>Gateway IP:</span>
                    <span className={styles.monospace}>{host.gateway_ip}</span>
                    <span className={styles.label}>Loopback:</span>
                    <span className={styles.monospace}>{host.loopback_ip}/{host.loopback_network}</span>
                    <span className={styles.label}>Container IP:</span>
                    <span className={styles.monospace}>{host.container_ip}</span>
                  </div>

                  {host.networks && host.networks.length > 0 && (
                    <div className={styles.networksSection}>
                      <div className={styles.networksLabel}>Networks:</div>
                      <div className={styles.networkTags}>
                        {host.networks.map((network, idx) => {
                          const networkName = typeof network === 'string' ? network : network.name;
                          const networkIps = typeof network === 'string' ? [] : (network.ips || []);
                          return (
                            <span key={`${host.id}-${networkName}-${idx}`} className={styles.networkTag}>
                              {networkName}{networkIps.length > 0 ? `: ${networkIps.join(', ')}` : ''}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className={buttonCss.buttonGroup}>
                    <Button
                      className={buttonCss.buttonPrimary}
                      onClick={() => onExecCommand(hostId, host.name)}
                    >
                      Run Command
                    </Button>
                    <Button
                      className={buttonCss.buttonSecondary}
                      onClick={() => onAssociateNetwork(hostId, host.name, 'host')}
                    >
                      Networks
                    </Button>
                    <Button
                      className={buttonCss.buttonSecondary}
                      onClick={() => onEditHost(hostId, host)}
                    >
                      Edit
                    </Button>
                    <Button className={buttonCss.buttonDelete} onClick={() => onDeleteHost(hostId, host.name)}>
                      Delete
                    </Button>
                  </div>
                </Card>
              ))}
            </CardGrid>
          </div>
        );
      })}

      {!hasHosts && (
        <EmptyState
          message="No host containers found. Create one to simulate networks behind daemons."
          icon="💻"
        />
      )}
    </section>
  );
};

export default HostContainersSection;
