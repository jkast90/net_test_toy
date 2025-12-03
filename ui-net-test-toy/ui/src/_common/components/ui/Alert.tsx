import React from 'react';
import styles from './Alert.module.css';

interface AlertProps {
  type: 'error' | 'success' | 'info' | 'warning';
  message: string;
  onClose?: () => void;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  type,
  message,
  onClose,
  className = ''
}) => {
  return (
    <div className={`${styles.alert} ${styles[type]} ${className}`}>
      <span className={styles.message}>{message}</span>
      {onClose && (
        <button
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close alert"
        >
          ×
        </button>
      )}
    </div>
  );
};

export default Alert;
