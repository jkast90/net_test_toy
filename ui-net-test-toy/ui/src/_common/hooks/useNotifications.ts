import { useEffect, useState, useCallback, useRef } from 'react';
import { useContainerManager } from '../contexts/ConfigContext';

export interface NotificationEvent {
  type: string;
  timestamp: string;
  trigger_name?: string;
  action_type?: string;
  flow?: {
    src: string;
    dst: string;
    kbps: number;
    mbps: number;
  };
  message: string;
  severity?: 'info' | 'warning' | 'error';
}

export interface UseNotificationsOptions {
  onNotification?: (notification: NotificationEvent) => void;
  autoConnect?: boolean;
  reconnectInterval?: number;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const {
    onNotification,
    autoConnect = true,
    reconnectInterval = 5000
  } = options;

  const containerManager = useContainerManager();
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shouldConnectRef = useRef(autoConnect);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    if (!containerManager?.url) {
      console.log('Container Manager URL not yet available, waiting...');
      return;
    }

    try {
      // Clear any existing reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Connect to Container Manager's NetFlow WebSocket proxy
      const wsUrl = containerManager.url.replace(/^http/, 'ws') + '/ws/netflow';

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setError(null);
        console.log('[useNotifications] WebSocket connected to NetFlow notifications via Container Manager');
      };

      ws.onmessage = (event) => {
        try {
          const notification: NotificationEvent = JSON.parse(event.data);

          // Only call onNotification for actual trigger events
          if (notification.type === 'trigger_event' && onNotification) {
            onNotification(notification);
          }
        } catch (err) {
          console.error('Failed to parse notification:', err);
        }
      };

      ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        setError('WebSocket connection error');
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;

        // Attempt to reconnect if we should be connected
        if (shouldConnectRef.current) {
          console.log(`WebSocket disconnected. Reconnecting in ${reconnectInterval}ms...`);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      };
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      setError('Failed to create WebSocket connection');

      // Retry connection
      if (shouldConnectRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, reconnectInterval);
      }
    }
  }, [containerManager, onNotification, reconnectInterval]);

  const disconnect = useCallback(() => {
    shouldConnectRef.current = false;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnected(false);
  }, []);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    connected,
    error,
    connect,
    disconnect
  };
}
