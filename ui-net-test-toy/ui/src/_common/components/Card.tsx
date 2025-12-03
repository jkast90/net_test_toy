import React from 'react';
import styles from './Card.module.css';

interface CardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  headerAction?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  children,
  className = '',
  headerAction,
}) => {
  return (
    <div className={`${styles.card} ${className}`}>
      {(title || subtitle || headerAction) && (
        <div className={styles.cardHeader}>
          <div>
            {title && <h3 className={styles.cardTitle}>{title}</h3>}
            {subtitle && <p className={styles.cardSubtitle}>{subtitle}</p>}
          </div>
          {headerAction && <div className={styles.headerAction}>{headerAction}</div>}
        </div>
      )}
      <div className={styles.cardBody}>{children}</div>
    </div>
  );
};

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: string;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtitle,
  icon,
  trend,
  color,
  className = '',
}) => {
  return (
    <div className={`${styles.statCard} ${className}`}>
      <div className={styles.statHeader}>
        <span className={styles.statLabel}>{label}</span>
        {icon && <span className={styles.statIcon}>{icon}</span>}
      </div>
      <div className={styles.statValue} style={color ? { color } : undefined}>{value}</div>
      {subtitle && (
        <div className={styles.statSubtitle}>{subtitle}</div>
      )}
      {trend && (
        <div className={`${styles.statTrend} ${trend.isPositive ? styles.positive : styles.negative}`}>
          {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
        </div>
      )}
    </div>
  );
};

export default Card;
