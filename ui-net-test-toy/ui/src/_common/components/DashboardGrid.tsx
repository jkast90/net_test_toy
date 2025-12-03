import React from 'react';
import Masonry from 'react-masonry-css';
import styles from './DashboardGrid.module.css';

interface DashboardGridProps {
  children: React.ReactNode;
  className?: string;
  columns?: number;
}

export const DashboardGrid: React.FC<DashboardGridProps> = ({
  children,
  className = '',
  columns = 3,
}) => {
  const breakpointColumnsObj = {
    default: columns
  };

  return (
    <Masonry
      breakpointCols={breakpointColumnsObj}
      className={`${styles.grid} ${className}`}
      columnClassName={styles.gridColumn}
    >
      {children}
    </Masonry>
  );
};

export default DashboardGrid;
