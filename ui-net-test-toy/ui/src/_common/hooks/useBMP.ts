/**
 * BMP React Hooks
 * Custom hooks for BMP (BGP Monitoring Protocol) operations
 */

import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  fetchBMPData,
  fetchBMPPeers,
  fetchBMPRoutes,
  fetchBMPFlowSpecRules,
  fetchBMPStats,
  fetchBMPMessages,
  fetchBMPServerConfig,
  startBMPServer,
  stopBMPServer,
  updateBMPServerConfig,
  clearBMPData,
  deleteBMPFlowSpecRule,
  addBMPFlowSpecRule,
  fetchMultiClientBMPData,
  setBMPPeers,
  addBMPMessage,
  updateBMPPeer,
  setSelectedPeer,
  setFilter,
  setWebSocketConnected,
  setPollInterval,
  clearErrors,
  resetBMPState
} from '../store/slices/bmpSlice';
import { bmpService } from '../services/bmp/bmpService';
import { flowspecService } from '../services/flowspecService';
import { RootState } from '../store/store';
import {
  BMPPeer,
  BMPRoute,
  BMPFlowSpecRule,
  BMPServerConfig,
  BMPFilter,
  BMPMessage
} from '../services/bmp/types';
import { selectAllEnabledDaemons } from '../store/connectionSelectors';
import type { EnabledDaemon } from '../store/connectionSelectors';

/**
 * Main BMP hook - provides access to BMP state and operations
 */
export const useBMP = () => {
  const dispatch = useAppDispatch();
  const bmpState = useAppSelector((state: RootState) => state.bmp);

  // Local state for configuration operations
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [configMessage, setConfigMessage] = useState<string | null>(null);
  const [isDeletingRule, setIsDeletingRule] = useState<string | null>(null);

  // Queries
  const loadBMPData = useCallback(
    (clientUrl?: string, filter?: BMPFilter) => {
      return dispatch(fetchBMPData({ clientUrl, filter }));
    },
    [dispatch]
  );

  const loadPeers = useCallback(
    (clientUrl?: string) => {
      return dispatch(fetchBMPPeers(clientUrl));
    },
    [dispatch]
  );

  const loadRoutes = useCallback(
    (peerAddress?: string, clientUrl?: string) => {
      return dispatch(fetchBMPRoutes({ peerAddress, clientUrl }));
    },
    [dispatch]
  );

  const loadFlowSpecRules = useCallback(
    (clientUrl?: string) => {
      return dispatch(fetchBMPFlowSpecRules(clientUrl));
    },
    [dispatch]
  );

  const loadStats = useCallback(
    (clientUrl?: string) => {
      return dispatch(fetchBMPStats(clientUrl));
    },
    [dispatch]
  );

  const loadMessages = useCallback(
    (limit?: number, clientUrl?: string) => {
      return dispatch(fetchBMPMessages({ limit, clientUrl }));
    },
    [dispatch]
  );

  const loadServerConfig = useCallback(
    (clientUrl?: string) => {
      return dispatch(fetchBMPServerConfig(clientUrl));
    },
    [dispatch]
  );

  const loadMultiClientData = useCallback(
    (clientUrls: string[], filter?: BMPFilter) => {
      return dispatch(fetchMultiClientBMPData({ clientUrls, filter }));
    },
    [dispatch]
  );

  // Mutations
  const startServer = useCallback(
    (config: Partial<BMPServerConfig>, clientUrl?: string) => {
      return dispatch(startBMPServer({ config, clientUrl }));
    },
    [dispatch]
  );

  const stopServer = useCallback(
    (clientUrl?: string) => {
      return dispatch(stopBMPServer(clientUrl));
    },
    [dispatch]
  );

  const updateConfig = useCallback(
    (config: Partial<BMPServerConfig>, clientUrl?: string) => {
      return dispatch(updateBMPServerConfig({ config, clientUrl }));
    },
    [dispatch]
  );

  const clearData = useCallback(
    (clientUrl?: string) => {
      return dispatch(clearBMPData(clientUrl));
    },
    [dispatch]
  );

  const deleteFlowSpecRule = useCallback(
    (ruleId: string, clientUrl?: string) => {
      return dispatch(deleteBMPFlowSpecRule({ ruleId, clientUrl }));
    },
    [dispatch]
  );

  const addFlowSpecRule = useCallback(
    (rule: Omit<BMPFlowSpecRule, 'id' | 'timestamp'>, clientUrl?: string) => {
      return dispatch(addBMPFlowSpecRule({ rule, clientUrl }));
    },
    [dispatch]
  );

  // Enhanced Operations
  const deleteFlowSpecRuleWithService = useCallback(
    async (rule: any, targets: EnabledDaemon[]) => {
      if (!rule.id) {
        return { success: false, error: 'Cannot delete rule without ID' };
      }

      setIsDeletingRule(rule.id);

      try {
        // Find a GoBGP daemon to delete the FlowSpec rule
        const gobgpDaemon = targets.find(t => t.daemon.type === 'gobgp');
        if (!gobgpDaemon) {
          setIsDeletingRule(null);
          return { success: false, error: 'No GoBGP daemon available to delete FlowSpec rule' };
        }

        // Use the FlowSpec service to delete the rule
        await flowspecService.deleteRule(
          gobgpDaemon.client.baseUrl,
          {
            family: 'ipv4',
            match: rule.match,
            actions: rule.actions
          } as any,
          'gobgp'
        );

        // Delete from BMP store
        await dispatch(deleteBMPFlowSpecRule({ ruleId: rule.id }));

        // Refresh FlowSpec rules
        await dispatch(fetchBMPFlowSpecRules(undefined));

        setIsDeletingRule(null);
        return { success: true };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setIsDeletingRule(null);
        return { success: false, error: errorMessage };
      }
    },
    [dispatch]
  );

  const configureBMPOnTargets = useCallback(
    async (targets: EnabledDaemon[], monitoringUrl?: string, config: { listen_port?: number } = {
      listen_port: 11019
    }) => {
      setIsConfiguring(true);
      setConfigMessage(null);

      if (targets.length === 0) {
        setIsConfiguring(false);
        setConfigMessage('No daemons selected');
        setTimeout(() => setConfigMessage(null), 5000);
        return { success: false, error: 'No daemons selected', successCount: 0, failedCount: 0 };
      }

      // Configure each daemon to send BMP data to the monitoring service
      // The container API will auto-discover the BMP address on the shared management network
      let successCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      const containerManagerUrl = 'http://localhost:5010';

      // Fetch config to get actual daemon names (not display names with " (Local)" suffix)
      const configResponse = await fetch(`${containerManagerUrl}/config`);
      if (!configResponse.ok) {
        setIsConfiguring(false);
        const errorMessage = 'Failed to fetch daemon configuration';
        setConfigMessage(errorMessage);
        setTimeout(() => setConfigMessage(null), 5000);
        return {
          success: false,
          error: errorMessage,
          successCount: 0,
          failedCount: targets.length
        };
      }

      const configData = await configResponse.json();
      const daemonConfigs = configData.daemons || [];

      // Configure BMP on all daemons (since the user selected to enable BMP monitoring)
      // The container API will auto-discover the monitoring service's IP on the shared network
      for (const daemonConfig of daemonConfigs) {
        try {
          const response = await fetch(
            `${containerManagerUrl}/daemons/${daemonConfig.name}/configure-bmp`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                bmp_port: config.listen_port || 11019
              })
            }
          );

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `HTTP ${response.status}`);
          }

          successCount++;
        } catch (err) {
          failedCount++;
          errors.push(`${daemonConfig.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      setIsConfiguring(false);

      let resultMessage: string;
      if (failedCount > 0) {
        resultMessage = `Configured ${successCount}, failed ${failedCount}: ${errors.join(', ')}`;
        setConfigMessage(resultMessage);
        setTimeout(() => setConfigMessage(null), 5000);
        return {
          success: false,
          error: resultMessage,
          successCount,
          failedCount
        };
      }

      resultMessage = `Successfully configured BMP on ${successCount} daemon(s)`;
      setConfigMessage(resultMessage);
      setTimeout(() => setConfigMessage(null), 5000);

      return {
        success: true,
        message: resultMessage,
        successCount,
        failedCount: 0
      };
    },
    [dispatch]
  );

  // UI Actions
  const selectPeer = useCallback(
    (peerId: string | null) => {
      dispatch(setSelectedPeer(peerId));
    },
    [dispatch]
  );

  const updateFilter = useCallback(
    (filter: BMPFilter) => {
      dispatch(setFilter(filter));
    },
    [dispatch]
  );

  const updatePollInterval = useCallback(
    (interval: number) => {
      dispatch(setPollInterval(interval));
    },
    [dispatch]
  );

  const clearAllErrors = useCallback(() => {
    dispatch(clearErrors());
  }, [dispatch]);

  const reset = useCallback(() => {
    dispatch(resetBMPState());
  }, [dispatch]);

  return {
    // State
    ...bmpState,

    // Operation State
    isConfiguring,
    configMessage,
    isDeletingRule,

    // Queries
    loadBMPData,
    loadPeers,
    loadRoutes,
    loadFlowSpecRules,
    loadStats,
    loadMessages,
    loadServerConfig,
    loadMultiClientData,

    // Mutations
    startServer,
    stopServer,
    updateConfig,
    clearData,
    deleteFlowSpecRule,
    addFlowSpecRule,

    // Enhanced Operations
    deleteFlowSpecRuleWithService,
    configureBMPOnTargets,

    // UI Actions
    selectPeer,
    updateFilter,
    updatePollInterval,
    clearAllErrors,
    reset
  };
};

/**
 * Hook for BMP polling - automatically fetches BMP data at regular intervals
 */
export const useBMPPolling = (
  enabled: boolean = true,
  clientUrl?: string,
  customInterval?: number
) => {
  const dispatch = useAppDispatch();
  const { pollInterval } = useAppSelector((state: RootState) => state.bmp);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const interval = customInterval || pollInterval;

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Initial fetch
    dispatch(fetchBMPData({ clientUrl }));

    // Setup polling
    intervalRef.current = setInterval(() => {
      dispatch(fetchBMPData({ clientUrl }));
    }, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, clientUrl, interval, dispatch]);
};

/**
 * Hook for BMP WebSocket connection
 */
export const useBMPWebSocket = (
  enabled: boolean = true,
  clientUrl?: string
) => {
  const dispatch = useAppDispatch();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMessage = useCallback(
    (message: BMPMessage) => {
      dispatch(addBMPMessage(message));

      // Update peer state based on message
      if (message.type === 'peer_up' || message.type === 'peer_down') {
        const peer = message.data as BMPPeer;
        dispatch(updateBMPPeer(peer));
      }
    },
    [dispatch]
  );

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    wsRef.current = bmpService.connectWebSocket(clientUrl, handleMessage);

    if (wsRef.current) {
      wsRef.current.onopen = () => {
        dispatch(setWebSocketConnected({ connected: true, url: clientUrl }));
      };

      wsRef.current.onclose = () => {
        dispatch(setWebSocketConnected({ connected: false }));

        // Attempt to reconnect after 5 seconds
        if (enabled) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 5000);
        }
      };
    }
  }, [clientUrl, enabled, handleMessage, dispatch]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    dispatch(setWebSocketConnected({ connected: false }));
  }, [dispatch]);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    connect,
    disconnect,
    isConnected: wsRef.current?.readyState === WebSocket.OPEN
  };
};

/**
 * Hook for filtered BMP data
 */
export const useFilteredBMPData = () => {
  const { peers, routes, filter } = useAppSelector((state: RootState) => state.bmp);

  const filteredPeers = useMemo(() => {
    if (!filter || Object.keys(filter).length === 0) {
      return peers;
    }

    return peers.filter(peer => {
      if (filter.peer_address && peer.address !== filter.peer_address) {
        return false;
      }
      if (filter.as_number && peer.as !== filter.as_number) {
        return false;
      }
      if (filter.state && peer.state !== filter.state) {
        return false;
      }
      return true;
    });
  }, [peers, filter]);

  const filteredRoutes = useMemo(() => {
    if (!filter || Object.keys(filter).length === 0) {
      return routes;
    }

    const filtered: typeof routes = {};

    Object.entries(routes).forEach(([peerAddress, peerRoutes]) => {
      if (filter.peer_address && peerAddress !== filter.peer_address) {
        return;
      }

      const filterRouteList = (routeList: BMPRoute[]) => {
        return routeList.filter(route => {
          if (filter.prefix && !route.prefix.startsWith(filter.prefix)) {
            return false;
          }
          return true;
        });
      };

      filtered[peerAddress] = {
        advertised: filter.route_type === 'received' ? [] : filterRouteList(peerRoutes.advertised),
        received: filter.route_type === 'advertised' ? [] : filterRouteList(peerRoutes.received)
      };
    });

    return filtered;
  }, [routes, filter]);

  return {
    filteredPeers,
    filteredRoutes
  };
};

/**
 * Hook for BMP peer details
 */
export const useBMPPeerDetails = (peerId: string | null) => {
  const dispatch = useAppDispatch();
  const { peers, routes, selectedPeer } = useAppSelector((state: RootState) => state.bmp);

  const peer = useMemo(() => {
    if (!peerId) return null;
    return peers.find(p => p.id === peerId) || null;
  }, [peers, peerId]);

  const peerRoutes = useMemo(() => {
    if (!peer) return null;
    return routes[peer.address] || { advertised: [], received: [] };
  }, [peer, routes]);

  const loadPeerRoutes = useCallback(
    (clientUrl?: string) => {
      if (peer) {
        return dispatch(fetchBMPRoutes({ peerAddress: peer.address, clientUrl }));
      }
    },
    [peer, dispatch]
  );

  return {
    peer,
    peerRoutes,
    isSelected: selectedPeer === peerId,
    loadPeerRoutes
  };
};

// Export all hooks
export default {
  useBMP,
  useBMPPolling,
  useBMPWebSocket,
  useFilteredBMPData,
  useBMPPeerDetails
};