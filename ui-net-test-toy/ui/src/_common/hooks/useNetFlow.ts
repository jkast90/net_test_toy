/**
 * NetFlow React Hooks
 * Custom hooks for NetFlow data collection and analysis operations
 */

import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { useAsyncMutation } from './useAsyncMutation';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  fetchNetFlowData,
  fetchNetFlowRecords,
  fetchNetFlowStats,
  fetchNetFlowExporters,
  fetchNetFlowAlerts,
  fetchNetFlowAnalysis,
  fetchNetFlowTimeSeries,
  fetchNetFlowCollectorConfig,
  startNetFlowCollector,
  stopNetFlowCollector,
  updateNetFlowCollectorConfig,
  clearNetFlowData,
  createNetFlowAlert,
  updateNetFlowAlert,
  deleteNetFlowAlert,
  testNetFlowAlert,
  exportNetFlowData,
  fetchMultiClientNetFlowData,
  fetchAggregatedNetFlowAnalysis,
  setNetFlowRecords,
  addNetFlowRecord,
  updateNetFlowExporter,
  setSelectedExporter,
  setFilter,
  setAggregation,
  setWebSocketConnected,
  setStreamingEnabled,
  clearStreamBuffer,
  setMaxBufferSize,
  setPollInterval,
  clearErrors,
  resetNetFlowState
} from '../store/slices/netflowSlice';
import { netflowService } from '../services/netflow/netflowService';
import { RootState } from '../store/store';
import {
  NetFlowRecord,
  NetFlowAlert,
  NetFlowCollectorConfig,
  NetFlowFilter,
  NetFlowAggregation
} from '../services/netflow/types';

/**
 * Main NetFlow hook - provides access to NetFlow state and operations
 */
export const useNetFlow = () => {
  const dispatch = useAppDispatch();
  const netflowState = useAppSelector((state: RootState) => state.netflow);

  // Queries
  const loadNetFlowData = useCallback(
    (clientUrl?: string, filter?: NetFlowFilter) => {
      return dispatch(fetchNetFlowData({ clientUrl, filter }));
    },
    [dispatch]
  );

  const loadRecords = useCallback(
    (filter?: NetFlowFilter, clientUrl?: string) => {
      return dispatch(fetchNetFlowRecords({ filter, clientUrl }));
    },
    [dispatch]
  );

  const loadStats = useCallback(
    (clientUrl?: string) => {
      return dispatch(fetchNetFlowStats(clientUrl));
    },
    [dispatch]
  );

  const loadExporters = useCallback(
    (clientUrl?: string) => {
      return dispatch(fetchNetFlowExporters(clientUrl));
    },
    [dispatch]
  );

  const loadAlerts = useCallback(
    (clientUrl?: string) => {
      return dispatch(fetchNetFlowAlerts(clientUrl));
    },
    [dispatch]
  );

  const loadAnalysis = useCallback(
    (aggregation?: NetFlowAggregation, filter?: NetFlowFilter, clientUrl?: string) => {
      return dispatch(fetchNetFlowAnalysis({ aggregation, filter, clientUrl }));
    },
    [dispatch]
  );

  const loadTimeSeries = useCallback(
    (interval?: string, duration?: string, clientUrl?: string) => {
      return dispatch(fetchNetFlowTimeSeries({ interval, duration, clientUrl }));
    },
    [dispatch]
  );

  const loadCollectorConfig = useCallback(
    (clientUrl?: string) => {
      return dispatch(fetchNetFlowCollectorConfig(clientUrl));
    },
    [dispatch]
  );

  const loadMultiClientData = useCallback(
    (clientUrls: string[], filter?: NetFlowFilter) => {
      return dispatch(fetchMultiClientNetFlowData({ clientUrls, filter }));
    },
    [dispatch]
  );

  const loadAggregatedAnalysis = useCallback(
    (clientUrls: string[], aggregation?: NetFlowAggregation, filter?: NetFlowFilter) => {
      return dispatch(fetchAggregatedNetFlowAnalysis({ clientUrls, aggregation, filter }));
    },
    [dispatch]
  );

  // Mutations
  const startCollector = useCallback(
    (config: Partial<NetFlowCollectorConfig>, clientUrl?: string) => {
      return dispatch(startNetFlowCollector({ config, clientUrl }));
    },
    [dispatch]
  );

  const stopCollector = useCallback(
    (clientUrl?: string) => {
      return dispatch(stopNetFlowCollector(clientUrl));
    },
    [dispatch]
  );

  const updateConfig = useCallback(
    (config: Partial<NetFlowCollectorConfig>, clientUrl?: string) => {
      return dispatch(updateNetFlowCollectorConfig({ config, clientUrl }));
    },
    [dispatch]
  );

  const clearData = useCallback(
    (clientUrl?: string) => {
      return dispatch(clearNetFlowData(clientUrl));
    },
    [dispatch]
  );

  const createAlert = useCallback(
    (alert: Omit<NetFlowAlert, 'id' | 'created_at' | 'updated_at' | 'last_triggered' | 'trigger_count'>, clientUrl?: string) => {
      return dispatch(createNetFlowAlert({ alert, clientUrl }));
    },
    [dispatch]
  );

  const updateAlert = useCallback(
    (alertId: string, updates: Partial<NetFlowAlert>, clientUrl?: string) => {
      return dispatch(updateNetFlowAlert({ alertId, updates, clientUrl }));
    },
    [dispatch]
  );

  const deleteAlert = useCallback(
    (alertId: string, clientUrl?: string) => {
      return dispatch(deleteNetFlowAlert({ alertId, clientUrl }));
    },
    [dispatch]
  );

  const testAlert = useCallback(
    (alertId: string, clientUrl?: string) => {
      return dispatch(testNetFlowAlert({ alertId, clientUrl }));
    },
    [dispatch]
  );

  const exportData = useCallback(
    (format: 'csv' | 'json' | 'pcap', filter?: NetFlowFilter, clientUrl?: string) => {
      return dispatch(exportNetFlowData({ format, filter, clientUrl }));
    },
    [dispatch]
  );

  // UI Actions
  const selectExporter = useCallback(
    (exporterId: string | null) => {
      dispatch(setSelectedExporter(exporterId));
    },
    [dispatch]
  );

  const updateFilter = useCallback(
    (filter: NetFlowFilter) => {
      dispatch(setFilter(filter));
    },
    [dispatch]
  );

  const updateAggregation = useCallback(
    (aggregation: NetFlowAggregation | null) => {
      dispatch(setAggregation(aggregation));
    },
    [dispatch]
  );

  const enableStreaming = useCallback(
    (enabled: boolean) => {
      dispatch(setStreamingEnabled(enabled));
    },
    [dispatch]
  );

  const clearBuffer = useCallback(() => {
    dispatch(clearStreamBuffer());
  }, [dispatch]);

  const updateBufferSize = useCallback(
    (size: number) => {
      dispatch(setMaxBufferSize(size));
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
    dispatch(resetNetFlowState());
  }, [dispatch]);

  return {
    // State
    ...netflowState,

    // Queries
    loadNetFlowData,
    loadRecords,
    loadStats,
    loadExporters,
    loadAlerts,
    loadAnalysis,
    loadTimeSeries,
    loadCollectorConfig,
    loadMultiClientData,
    loadAggregatedAnalysis,

    // Mutations
    startCollector,
    stopCollector,
    updateConfig,
    clearData,
    createAlert,
    updateAlert,
    deleteAlert,
    testAlert,
    exportData,

    // UI Actions
    selectExporter,
    updateFilter,
    updateAggregation,
    enableStreaming,
    clearBuffer,
    updateBufferSize,
    updatePollInterval,
    clearAllErrors,
    reset
  };
};

/**
 * Hook for NetFlow polling - automatically fetches NetFlow data at regular intervals
 */
export const useNetFlowPolling = (
  enabled: boolean = true,
  clientUrl?: string,
  customInterval?: number
) => {
  const dispatch = useAppDispatch();
  const { pollInterval } = useAppSelector((state: RootState) => state.netflow);
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
    dispatch(fetchNetFlowStats());
    dispatch(fetchNetFlowRecords({ filter: { limit: 100 } }));

    // Setup polling
    intervalRef.current = setInterval(() => {
      dispatch(fetchNetFlowStats());
      dispatch(fetchNetFlowRecords({ filter: { limit: 100 } }));
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
 * Hook for NetFlow WebSocket streaming
 */
export const useNetFlowStream = (
  enabled: boolean = true,
  filter?: NetFlowFilter,
  clientUrl?: string
) => {
  const dispatch = useAppDispatch();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMessage = useCallback(
    (record: NetFlowRecord) => {
      dispatch(addNetFlowRecord(record));
    },
    [dispatch]
  );

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    wsRef.current = netflowService.connectWebSocket(clientUrl, handleMessage, filter);

    if (wsRef.current) {
      wsRef.current.onopen = () => {
        dispatch(setWebSocketConnected({ connected: true, url: clientUrl }));
        dispatch(setStreamingEnabled(true));
      };

      wsRef.current.onclose = () => {
        dispatch(setWebSocketConnected({ connected: false }));
        dispatch(setStreamingEnabled(false));

        // Attempt to reconnect after 5 seconds
        if (enabled) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 5000);
        }
      };
    }
  }, [clientUrl, enabled, filter, handleMessage, dispatch]);

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
    dispatch(setStreamingEnabled(false));
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
 * Hook for filtered NetFlow data
 */
export const useFilteredNetFlowData = () => {
  const { records, exporters, filter } = useAppSelector((state: RootState) => state.netflow);

  const filteredRecords = useMemo(() => {
    if (!filter || Object.keys(filter).length === 0) {
      return records;
    }

    return records.filter(record => {
      if (filter.source_ip && !record.source_ip.includes(filter.source_ip)) {
        return false;
      }
      if (filter.destination_ip && !record.destination_ip.includes(filter.destination_ip)) {
        return false;
      }
      if (filter.port && record.source_port !== filter.port && record.destination_port !== filter.port) {
        return false;
      }
      if (filter.protocol && record.protocol !== filter.protocol) {
        return false;
      }
      if (filter.min_bytes && record.bytes < filter.min_bytes) {
        return false;
      }
      if (filter.max_bytes && record.bytes > filter.max_bytes) {
        return false;
      }
      if (filter.start_time && new Date(record.timestamp) < new Date(filter.start_time)) {
        return false;
      }
      if (filter.end_time && new Date(record.timestamp) > new Date(filter.end_time)) {
        return false;
      }
      return true;
    });
  }, [records, filter]);

  const filteredExporters = useMemo(() => {
    if (!filter || !filter.source_ip) {
      return exporters;
    }

    return exporters.filter(exporter => exporter.ip_address.includes(filter.source_ip!));
  }, [exporters, filter]);

  return {
    filteredRecords,
    filteredExporters
  };
};

/**
 * Hook for NetFlow analysis
 */
export const useNetFlowAnalysis = (
  aggregationType: NetFlowAggregation['type'] = 'source',
  interval: NetFlowAggregation['interval'] = '5m',
  topN: number = 10
) => {
  const dispatch = useAppDispatch();
  const { analysis, loading, errors } = useAppSelector((state: RootState) => state.netflow);

  const loadAnalysis = useCallback(
    (filter?: NetFlowFilter, clientUrl?: string) => {
      const aggregation: NetFlowAggregation = {
        type: aggregationType,
        interval,
        top_n: topN
      };
      return dispatch(fetchNetFlowAnalysis({ aggregation, filter, clientUrl }));
    },
    [dispatch, aggregationType, interval, topN]
  );

  const topTalkers = useMemo(() => {
    if (!analysis || !analysis.top_conversations) {
      return [];
    }

    return analysis.top_conversations
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, topN);
  }, [analysis, topN]);

  const protocolBreakdown = useMemo(() => {
    if (!analysis || !analysis.protocol_distribution) {
      return [];
    }

    return analysis.protocol_distribution
      .sort((a, b) => b.percentage - a.percentage);
  }, [analysis]);

  return {
    analysis,
    topTalkers,
    protocolBreakdown,
    loading: loading.analysis,
    error: errors.analysis,
    loadAnalysis
  };
};

/**
 * Hook for NetFlow configuration operations
 * Handles configuration and automatic data refresh
 */
export const useNetFlowConfig = (clientUrl?: string) => {
  const dispatch = useAppDispatch();
  const [configMessage, setConfigMessage] = useState<string | null>(null);
  const messageTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Configure NetFlow on targets using useAsyncMutation for proper state management
  const {
    mutate: configureInternal,
    isLoading: isConfiguring,
    error: configError,
    data: configData,
    reset: resetConfig
  } = useAsyncMutation(
    async (params: { targets: any[]; config: { address: string; port: number } }) => {
      const { targets, config } = params;

      if (targets.length === 0) {
        throw new Error('No daemons selected');
      }

      // Import the service dynamically to avoid circular deps
      const { netflowConfigService } = await import('../services/netflowConfigService');

      const results = await netflowConfigService.configureNetFlowOnTargets(targets, config);
      const message = netflowConfigService.buildConfigurationMessage(results);

      return { results, message };
    },
    {
      onSuccess: (result) => {
        setConfigMessage(result.message);

        // Automatically refresh data after successful configuration
        dispatch(fetchNetFlowData({ clientUrl }));

        // Clear message after 5 seconds
        if (messageTimeoutRef.current) {
          clearTimeout(messageTimeoutRef.current);
        }
        messageTimeoutRef.current = setTimeout(() => {
          setConfigMessage(null);
        }, 5000);
      },
      onError: (error) => {
        setConfigMessage(`Configuration failed: ${error.message}`);

        // Clear message after 5 seconds
        if (messageTimeoutRef.current) {
          clearTimeout(messageTimeoutRef.current);
        }
        messageTimeoutRef.current = setTimeout(() => {
          setConfigMessage(null);
        }, 5000);
      }
    }
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
      }
    };
  }, []);

  const clearMessage = useCallback(() => {
    setConfigMessage(null);
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
      messageTimeoutRef.current = null;
    }
  }, []);

  // Manual refresh method for other use cases (initial load, polling, etc.)
  const refreshData = useCallback(
    (url?: string) => {
      return dispatch(fetchNetFlowData({ clientUrl: url || clientUrl }));
    },
    [dispatch, clientUrl]
  );

  return {
    configure: configureInternal,
    isConfiguring,
    configError,
    configMessage,
    clearMessage,
    resetConfig,
    refreshData
  };
};

/**
 * Hook for NetFlow alerts management
 */
export const useNetFlowAlerts = () => {
  const dispatch = useAppDispatch();
  const { alerts } = useAppSelector((state: RootState) => state.netflow);

  const activeAlerts = useMemo(() => {
    return alerts.filter(alert => alert.enabled);
  }, [alerts]);

  const triggeredAlerts = useMemo(() => {
    return alerts.filter(alert => alert.last_triggered);
  }, [alerts]);

  const alertsByType = useMemo(() => {
    const grouped: Record<string, typeof alerts> = {};
    alerts.forEach(alert => {
      const type = alert.condition.type;
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(alert);
    });
    return grouped;
  }, [alerts]);

  return {
    alerts,
    activeAlerts,
    triggeredAlerts,
    alertsByType
  };
};

// Export all hooks
export default {
  useNetFlow,
  useNetFlowPolling,
  useNetFlowStream,
  useFilteredNetFlowData,
  useNetFlowAnalysis,
  useNetFlowAlerts,
  useNetFlowConfig
};