import { useState, useCallback, useEffect } from 'react';
import { useNotifications, NotificationEvent } from '../hooks/useNotifications';
import { useTriggerEvaluation } from '../hooks/useTriggerEvaluation';
import { useContainerManager } from '../contexts/ConfigContext';
import { NotificationContainer } from './NotificationToast';
import type { Trigger } from '../types/netflow';

/**
 * Global notification component that connects to WebSocket and displays
 * notifications on all pages throughout the application.
 *
 * Also performs client-side trigger evaluation against aggregated flow data
 * (same calculation as Top Talkers pane).
 */
export function GlobalNotifications() {
  const [notifications, setNotifications] = useState<Array<NotificationEvent & { id: string }>>([]);
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const containerManager = useContainerManager();

  // Fetch triggers from active topology
  useEffect(() => {
    if (!containerManager?.url) return;

    const fetchTriggers = async () => {
      try {
        // Get active topology
        const activeRes = await fetch(`${containerManager.url}/topologies/active`);
        if (!activeRes.ok) return;

        const activeData = await activeRes.json();
        const topologyName = activeData.active?.name;
        if (!topologyName) return;

        // Get triggers for this topology
        const triggersRes = await fetch(`${containerManager.url}/topologies/${topologyName}/triggers`);
        if (!triggersRes.ok) return;

        const triggersData = await triggersRes.json();
        const dbTriggers = triggersData.triggers || [];

        // Convert DB format to Trigger format
        const formattedTriggers: Trigger[] = dbTriggers.map((t: any) => ({
          id: String(t.id),
          name: t.name,
          enabled: Boolean(t.enabled),
          conditions: {
            min_kbps: t.min_kbps ? parseFloat(t.min_kbps) : undefined,
            min_mbps: t.min_mbps ? parseFloat(t.min_mbps) : undefined,
            min_pps: t.min_pps ? parseFloat(t.min_pps) : undefined,
            min_bytes: t.min_bytes ? parseInt(t.min_bytes) : undefined,
            src_addr: t.src_addr || undefined,
            dst_addr: t.dst_addr || undefined,
            src_or_dst_addr: t.src_or_dst_addr || undefined,
            protocol: t.protocol ? parseInt(t.protocol) : undefined
          },
          action: {
            type: t.action_type || 'log',
            message: t.action_message || undefined,
            rate_limit_kbps: t.rate_limit_kbps ? parseFloat(t.rate_limit_kbps) : undefined
          }
        }));

        setTriggers(formattedTriggers);
        console.log('[GlobalNotifications] Loaded triggers:', formattedTriggers.length);
      } catch (err) {
        console.error('[GlobalNotifications] Failed to fetch triggers:', err);
      }
    };

    fetchTriggers();
    // Refresh triggers periodically
    const interval = setInterval(fetchTriggers, 30000);
    return () => clearInterval(interval);
  }, [containerManager?.url]);

  // Handle incoming notifications (from WebSocket or client-side evaluation)
  const handleNotification = useCallback((notification: NotificationEvent) => {
    const notificationWithId = {
      ...notification,
      id: `${Date.now()}-${Math.random()}`
    };
    console.log('[GlobalNotifications] Received notification:', notification);
    setNotifications(prev => [notificationWithId, ...prev].slice(0, 5)); // Keep max 5 notifications
  }, []);

  // Connect to WebSocket notifications (backend triggers)
  useNotifications({
    onNotification: handleNotification,
    autoConnect: true
  });

  // Client-side trigger evaluation using aggregated flow data (same as Top Talkers)
  useTriggerEvaluation({
    triggers,
    onTriggerFired: handleNotification,
    evaluationInterval: 5000,
    cooldownPeriod: 60000,
    enabled: triggers.length > 0
  });

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  return (
    <NotificationContainer
      notifications={notifications}
      onDismiss={dismissNotification}
    />
  );
}
