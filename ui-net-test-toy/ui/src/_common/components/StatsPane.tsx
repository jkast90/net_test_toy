import React from 'react';
import { DashboardPane } from './DashboardPane';
import { StatCard } from './Card';

export interface StatData {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: string;
}

interface StatsPaneProps {
  title: string;
  stats: StatData[];
  columns?: number;
  loading?: boolean;
  actions?: React.ReactNode;
  className?: string;
  width?: string;
}

export const StatsPane: React.FC<StatsPaneProps> = ({
  title,
  stats,
  columns = 2,
  loading = false,
  actions,
  className,
  width
}) => {
  return (
    <DashboardPane
      title={title}
      loading={loading}
      actions={actions}
      className={className}
      width={width}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: '1rem'
        }}
      >
        {stats.map((stat, index) => (
          <StatCard
            key={`${stat.label}-${index}`}
            label={stat.label}
            value={stat.value}
            subtitle={stat.subtitle}
            icon={stat.icon}
            trend={stat.trend}
            color={stat.color}
          />
        ))}
      </div>
    </DashboardPane>
  );
};

export default StatsPane;
