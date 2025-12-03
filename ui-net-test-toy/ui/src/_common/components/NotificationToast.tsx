import { useEffect, useState } from 'react';
import styles from './NotificationToast.module.css';
import type { NotificationEvent } from '../hooks/useNotifications';
import { formatDecimal } from '../utils/networkUtils';

interface NotificationToastProps {
  notification: NotificationEvent;
  onClose: () => void;
  autoCloseDuration?: number;
}

export function NotificationToast({
  notification,
  onClose,
  autoCloseDuration = 8000
}: NotificationToastProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onClose, 300); // Wait for exit animation
    }, autoCloseDuration);

    return () => clearTimeout(timer);
  }, [autoCloseDuration, onClose]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300);
  };

  const severityClass = notification.severity === 'warning'
    ? styles.warning
    : notification.severity === 'error'
    ? styles.error
    : styles.info;

  return (
    <div
      className={`${styles.toast} ${severityClass} ${isExiting ? styles.exiting : ''}`}
      role="alert"
    >
      <div className={styles.header}>
        <div className={styles.title}>
          {notification.severity === 'warning' && '⚠️ '}
          {notification.severity === 'error' && '❌ '}
          {notification.severity === 'info' && 'ℹ️ '}
          {notification.trigger_name || 'Notification'}
        </div>
        <button
          className={styles.closeBtn}
          onClick={handleClose}
          aria-label="Close notification"
        >
          ✕
        </button>
      </div>

      <div className={styles.content}>
        <div className={styles.message}>{notification.message}</div>

        {notification.flow && (
          <div className={styles.flowInfo}>
            <div className={styles.flowDetail}>
              <strong>Flow:</strong> {notification.flow.src} → {notification.flow.dst}
            </div>
            <div className={styles.flowDetail}>
              <strong>Bandwidth:</strong> {formatDecimal(notification.flow.mbps, 2)} Mbps
            </div>
          </div>
        )}

        {notification.action_type && (
          <div className={styles.actionType}>
            <strong>Action:</strong> {notification.action_type}
          </div>
        )}
      </div>

      <div className={styles.timestamp}>
        {new Date(notification.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}

interface NotificationContainerProps {
  notifications: Array<NotificationEvent & { id: string }>;
  onDismiss: (id: string) => void;
}

export function NotificationContainer({ notifications, onDismiss }: NotificationContainerProps) {
  return (
    <div className={styles.container}>
      {notifications.map((notification) => (
        <NotificationToast
          key={notification.id}
          notification={notification}
          onClose={() => onDismiss(notification.id)}
        />
      ))}
    </div>
  );
}
