import React, { useEffect, useState } from 'react';
import styles from './Toast.module.css';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  text: string;
  duration?: number;
}

interface ToastProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const duration = toast.duration ?? 5000;
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onDismiss(toast.id), 300); // Wait for exit animation
    }, duration);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  return (
    <div
      className={`${styles.toast} ${styles[toast.type]} ${isExiting ? styles.exiting : ''}`}
      role="alert"
    >
      <div className={styles.content}>
        <span className={styles.icon}>
          {toast.type === 'success' && '✓'}
          {toast.type === 'error' && '✕'}
          {toast.type === 'warning' && '⚠'}
          {toast.type === 'info' && 'ℹ'}
        </span>
        <span className={styles.message}>{toast.text}</span>
      </div>
      <button
        className={styles.closeButton}
        onClick={handleClose}
        aria-label="Close notification"
      >
        ✕
      </button>
    </div>
  );
};

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className={styles.container}>
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};
