import React from 'react';
import styles from './EmptyState.module.css';
import Button from './Button';

interface EmptyStateProps {
  // New API
  title?: string;
  description?: string;
  // Legacy API
  message?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode | { label: string; onClick: () => void };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  message,
  icon,
  action,
  className = ''
}) => {
  // Support both legacy and new API
  const displayMessage = message || description;
  const displayTitle = title;

  return (
    <div className={`${styles.emptyState} ${className}`}>
      {icon && <div className={styles.icon}>{icon}</div>}
      {displayTitle && <h3 className={styles.title}>{displayTitle}</h3>}
      {displayMessage && <p className={styles.message}>{displayMessage}</p>}
      {action && (
        <div className={styles.action}>
          {typeof action === 'object' && 'label' in action && 'onClick' in action ? (
            <Button onClick={action.onClick}>{action.label}</Button>
          ) : (
            action
          )}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
