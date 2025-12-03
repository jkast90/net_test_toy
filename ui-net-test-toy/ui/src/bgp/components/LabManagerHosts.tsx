import React from 'react';
import { Button } from '../../_common/components/ui';
import ToggleSwitch from '../../_common/components/ui/ToggleSwitch';
import Card from '../../_common/components/Card';
import CardGrid from '../../_common/components/CardGrid';
import { ManagedHost } from '../../_common/store/labManagerSlice';
import buttonCss from '../../_common/styles/Button.module.css';
import styles from './LabManagerHosts.module.css';

interface LabManagerHostsProps {
  managedHosts: ManagedHost[];
  daemonCounts?: Record<string, number>; // Optional daemon counts per host
  onAddHost: () => void;
  onEditHost: (hostId: string) => void;
  onDeleteHost: (hostId: string) => void;
  onToggleEnabled: (hostId: string) => void;
}

const LabManagerHosts: React.FC<LabManagerHostsProps> = ({
  managedHosts,
  daemonCounts,
  onAddHost,
  onEditHost,
  onDeleteHost,
  onToggleEnabled
}) => {
  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h2>Lab Manager Hosts</h2>
          <p>Manage connection to Lab Manager API instances</p>
        </div>
        <Button
          className={buttonCss.buttonPrimary}
          onClick={onAddHost}
        >
          Add Host
        </Button>
      </div>

      <CardGrid columns={3} style={{ marginBottom: '2rem' }}>
        {managedHosts.map((host) => (
          <Card key={host.id}>
            <div className={styles.cardHeader}>
              <h3>{host.name}</h3>
              <ToggleSwitch
                id={`host-enabled-${host.id}`}
                checked={host.enabled}
                onChange={() => onToggleEnabled(host.id)}
                labelLeft=""
                labelRight=""
              />
            </div>
            <div className={styles.statusRow}>
              <span className={`${styles.statusIndicator} ${styles[host.status]}`} />
              <span className={styles.statusText}>
                {host.status === 'connected' ? 'Connected' :
                 host.status === 'error' ? 'Error' : 'Disconnected'}
              </span>
            </div>
            <div className={styles.url}>
              {host.url}
            </div>
            {host.error && (
              <div className={styles.errorText}>
                {host.error}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              {daemonCounts && (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {daemonCounts[host.id] || 0} daemons
                </span>
              )}
            </div>
            <div className={buttonCss.buttonGroup}>
              <Button
                className={buttonCss.buttonSecondary}
                onClick={() => onEditHost(host.id)}
              >
                Edit
              </Button>
              {host.id !== 'localhost' && (
                <Button className={buttonCss.buttonDelete} onClick={() => onDeleteHost(host.id)}>
                  Remove
                </Button>
              )}
            </div>
          </Card>
        ))}
      </CardGrid>
    </section>
  );
};

export default LabManagerHosts;
