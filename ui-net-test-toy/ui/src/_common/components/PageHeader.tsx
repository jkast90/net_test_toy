/**
 * Page Header Component
 * Reusable header for pages that don't use PageLayout
 */

import React from 'react';
import styles from './PageHeader.module.css';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  className = ''
}) => {
  return (
    <div className={`${styles.header} ${className}`}>
      <div className={styles.headerText}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.headerActions}>{actions}</div>}
    </div>
  );
};

export default PageHeader;
