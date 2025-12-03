import React from 'react';
import styles from './DashboardPane.module.css';

interface DashboardPaneProps {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  loading?: boolean;
  className?: string;
  width?: string;
  style?: React.CSSProperties;
  bodyStyle?: React.CSSProperties;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  dragOpacity?: number;
}

export const DashboardPane: React.FC<DashboardPaneProps> = ({
  title,
  children,
  actions,
  loading = false,
  className = '',
  width,
  style,
  bodyStyle,
  draggable = false,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  dragOpacity = 1,
}) => {
  return (
    <div
      className={`${styles.pane} ${className}`}
      style={{
        width: width || undefined,
        opacity: dragOpacity,
        transition: 'opacity 0.2s',
        ...style
      }}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div
        className={styles.paneHeader}
        draggable={draggable}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        style={draggable ? { cursor: 'grab' } : undefined}
      >
        <h3 className={styles.paneTitle}>{title}</h3>
        {actions && <div className={styles.paneActions}>{actions}</div>}
      </div>
      <div className={styles.paneBody} style={bodyStyle}>
        {loading ? (
          <div className={styles.loading}>Loading...</div>
        ) : (
          children
        )}
      </div>
    </div>
  );
};

export default DashboardPane;
