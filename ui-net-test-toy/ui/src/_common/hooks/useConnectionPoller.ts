import { useEffect, useRef, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setClientStatus } from '../store/connectionSlice';
import { selectAllClients } from '../store/connectionSelectors';
import { connectionService } from '../services/connection/connectionService';

/**
 * Hook to poll all enabled clients and update their connection status
 */
export function useConnectionPoller() {
  const dispatch = useAppDispatch();
  const clients = useAppSelector(selectAllClients);
  const pollTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Create a stable key based on client configuration (not status)
  const clientConfigKey = useMemo(() => {
    return clients
      .map(c => `${c.id}:${c.baseUrl}:${c.pollInterval}:${c.enabled}`)
      .join('|');
  }, [clients]);

  useEffect(() => {
    const pollClient = async (clientId: string, baseUrl: string) => {
      try {
        // Use connection service for health check with suppressLogs for polling
        await connectionService.checkHealth(baseUrl, 5000, true);

        dispatch(setClientStatus({
          id: clientId,
          status: 'connected'
        }));
      } catch (error) {
        const errorMessage = error instanceof Error
          ? error.message
          : 'Connection failed';

        dispatch(setClientStatus({
          id: clientId,
          status: 'error',
          error: errorMessage
        }));
      }
    };

    // Clear existing timers
    pollTimersRef.current.forEach(timer => clearInterval(timer));
    pollTimersRef.current.clear();

    // Set up polling for each enabled client
    clients.forEach(client => {
      if (client.enabled) {
        // Poll immediately on mount/change
        pollClient(client.id, client.baseUrl);

        // Set up recurring poll
        const intervalMs = client.pollInterval * 1000;
        const timer = setInterval(() => {
          pollClient(client.id, client.baseUrl);
        }, intervalMs);

        pollTimersRef.current.set(client.id, timer);
      }
    });

    // Cleanup on unmount
    return () => {
      pollTimersRef.current.forEach(timer => clearInterval(timer));
      pollTimersRef.current.clear();
    };
  }, [clientConfigKey, dispatch]);
}
