import React from 'react';
import { DashboardGrid } from './DashboardGrid';
import { PageHeader } from './PageHeader';
import styles from './PageLayout.module.css';

interface PageLayoutProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  useDashboardGrid?: boolean;
}

export const PageLayout: React.FC<PageLayoutProps> = ({
  title,
  subtitle,
  actions,
  children,
  className = '',
  useDashboardGrid = true
}) => {
  return (
    <div className={`${styles.container} ${className}`}>
      {title && (
        <PageHeader
          title={title}
          subtitle={subtitle}
          actions={actions}
        />
      )}

      {useDashboardGrid ? (
        <DashboardGrid>
          {children}
        </DashboardGrid>
      ) : (
        <div>
          {children}
        </div>
      )}
    </div>
  );
};

export default PageLayout;
