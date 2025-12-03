import React from 'react';
import styles from './StatusBadge.module.css';

interface StatusBadgeProps {
  status: string;
  variant?: 'success' | 'error' | 'warning' | 'info' | 'default';
  className?: string;
}

// Auto-detect variant from common status strings
const getVariantFromStatus = (status: string): StatusBadgeProps['variant'] => {
  const lowerStatus = status.toLowerCase();

  if (['active', 'running', 'established', 'connected', 'online', 'success'].includes(lowerStatus)) {
    return 'success';
  }
  if (['error', 'failed', 'down', 'offline', 'disconnected'].includes(lowerStatus)) {
    return 'error';
  }
  if (['warning', 'idle', 'pending', 'connecting'].includes(lowerStatus)) {
    return 'warning';
  }
  if (['info', 'unknown'].includes(lowerStatus)) {
    return 'info';
  }

  return 'default';
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  variant,
  className = ''
}) => {
  const badgeVariant = variant || getVariantFromStatus(status);

  return (
    <span className={`${styles.badge} ${styles[badgeVariant]} ${className}`}>
      {status}
    </span>
  );
};

export default StatusBadge;
