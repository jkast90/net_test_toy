import React from 'react';
import Card, { StatCard } from '../../_common/components/Card';
import styles from './ConnectionStatsCard.module.css';

interface ConnectionStats {
  total: number;
  connected: number;
  disconnected: number;
  error: number;
  enabled: number;
}

interface ConnectionStatsCardProps {
  stats: ConnectionStats;
}

const ConnectionStatsCard: React.FC<ConnectionStatsCardProps> = ({ stats }) => {
  return (
    <Card>
      <div className={styles.statsGrid}>
        <StatCard label="Total Clients" value={stats.total} />
        <StatCard label="Connected" value={stats.connected} color="var(--success)" />
        <StatCard label="Disconnected" value={stats.disconnected} color="var(--warning)" />
        <StatCard label="Errors" value={stats.error} color="var(--error)" />
        <StatCard label="Enabled" value={stats.enabled} />
      </div>
    </Card>
  );
};

export default ConnectionStatsCard;
