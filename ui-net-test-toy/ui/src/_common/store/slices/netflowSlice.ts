/**
 * NetFlow Redux Slice
 * State management for NetFlow data collection and analysis
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { netflowService } from '../../services/netflow/netflowService';
import {
  NetFlowData,
  NetFlowRecord,
  NetFlowStats,
  NetFlowExporter,
  NetFlowAlert,
  NetFlowCollectorConfig,
  NetFlowFilter,
  NetFlowAggregation,
  NetFlowAnalysis,
  NetFlowTimeSeriesData
} from '../../services/netflow/types';

interface NetFlowState {
  // Data
  records: NetFlowRecord[];
  stats: NetFlowStats | null;
  exporters: NetFlowExporter[];
  alerts: NetFlowAlert[];
  analysis: NetFlowAnalysis | null;
  timeSeries: NetFlowTimeSeriesData[];

  // Collector config
  collectorConfig: NetFlowCollectorConfig | null;
  collectorStatus: 'running' | 'stopped' | 'unknown';

  // Multi-client data
  clientData: Record<string, NetFlowData>;

  // UI state
  selectedExporter: string | null;
  filter: NetFlowFilter;
  aggregation: NetFlowAggregation | null;

  // Loading and error states
  loading: {
    records: boolean;
    stats: boolean;
    exporters: boolean;
    alerts: boolean;
    analysis: boolean;
    timeSeries: boolean;
    config: boolean;
  };
  errors: {
    records?: string;
    stats?: string;
    exporters?: string;
    alerts?: string;
    analysis?: string;
    timeSeries?: string;
    config?: string;
  };

  // WebSocket
  wsConnected: boolean;
  wsUrl: string | null;

  // Streaming
  streamingEnabled: boolean;
  streamBuffer: NetFlowRecord[];
  maxBufferSize: number;

  // Polling
  pollInterval: number;
  lastUpdate: string | null;
}

const initialState: NetFlowState = {
  records: [],
  stats: null,
  exporters: [],
  alerts: [],
  analysis: null,
  timeSeries: [],
  collectorConfig: null,
  collectorStatus: 'unknown',
  clientData: {},
  selectedExporter: null,
  filter: {},
  aggregation: null,
  loading: {
    records: false,
    stats: false,
    exporters: false,
    alerts: false,
    analysis: false,
    timeSeries: false,
    config: false
  },
  errors: {},
  wsConnected: false,
  wsUrl: null,
  streamingEnabled: false,
  streamBuffer: [],
  maxBufferSize: 1000,
  pollInterval: 5000,
  lastUpdate: null
};

// Async thunks
export const fetchNetFlowData = createAsyncThunk(
  'netflow/fetchData',
  async ({ clientUrl, filter }: { clientUrl?: string; filter?: NetFlowFilter }) => {
    return await netflowService.getNetFlowData(clientUrl, filter);
  }
);

export const fetchNetFlowRecords = createAsyncThunk(
  'netflow/fetchRecords',
  async ({ filter, clientUrl }: { filter?: NetFlowFilter; clientUrl?: string }) => {
    return await netflowService.getNetFlowRecords(filter, clientUrl);
  }
);

export const fetchNetFlowStats = createAsyncThunk(
  'netflow/fetchStats',
  async (clientUrl?: string) => {
    return await netflowService.getNetFlowStats(clientUrl);
  }
);

export const fetchNetFlowExporters = createAsyncThunk(
  'netflow/fetchExporters',
  async (clientUrl?: string) => {
    return await netflowService.getNetFlowExporters(clientUrl);
  }
);

export const fetchNetFlowAlerts = createAsyncThunk(
  'netflow/fetchAlerts',
  async (clientUrl?: string) => {
    return await netflowService.getNetFlowAlerts(clientUrl);
  }
);

export const fetchNetFlowAnalysis = createAsyncThunk(
  'netflow/fetchAnalysis',
  async ({
    aggregation,
    filter,
    clientUrl
  }: {
    aggregation?: NetFlowAggregation;
    filter?: NetFlowFilter;
    clientUrl?: string;
  }) => {
    return await netflowService.getNetFlowAnalysis(aggregation, filter, clientUrl);
  }
);

export const fetchNetFlowTimeSeries = createAsyncThunk(
  'netflow/fetchTimeSeries',
  async ({
    interval = '5m',
    duration = '1h',
    clientUrl
  }: {
    interval?: string;
    duration?: string;
    clientUrl?: string;
  }) => {
    return await netflowService.getNetFlowTimeSeries(interval, duration, clientUrl);
  }
);

export const fetchNetFlowCollectorConfig = createAsyncThunk(
  'netflow/fetchCollectorConfig',
  async (clientUrl?: string) => {
    return await netflowService.getNetFlowCollectorConfig(clientUrl);
  }
);

export const startNetFlowCollector = createAsyncThunk(
  'netflow/startCollector',
  async ({ config, clientUrl }: { config: Partial<NetFlowCollectorConfig>; clientUrl?: string }) => {
    return await netflowService.startNetFlowCollector(config, clientUrl);
  }
);

export const stopNetFlowCollector = createAsyncThunk(
  'netflow/stopCollector',
  async (clientUrl?: string) => {
    return await netflowService.stopNetFlowCollector(clientUrl);
  }
);

export const updateNetFlowCollectorConfig = createAsyncThunk(
  'netflow/updateCollectorConfig',
  async ({ config, clientUrl }: { config: Partial<NetFlowCollectorConfig>; clientUrl?: string }) => {
    return await netflowService.updateNetFlowCollectorConfig(config, clientUrl);
  }
);

export const clearNetFlowData = createAsyncThunk(
  'netflow/clearData',
  async (clientUrl?: string) => {
    return await netflowService.clearNetFlowData(clientUrl);
  }
);

export const createNetFlowAlert = createAsyncThunk(
  'netflow/createAlert',
  async ({
    alert,
    clientUrl
  }: {
    alert: Omit<NetFlowAlert, 'id' | 'created_at' | 'updated_at' | 'last_triggered' | 'trigger_count'>;
    clientUrl?: string;
  }) => {
    const result = await netflowService.createNetFlowAlert(alert, clientUrl);
    if (result.success && result.data) {
      return result.data;
    }
    throw new Error(result.error || 'Failed to create alert');
  }
);

export const updateNetFlowAlert = createAsyncThunk(
  'netflow/updateAlert',
  async ({
    alertId,
    updates,
    clientUrl
  }: {
    alertId: string;
    updates: Partial<NetFlowAlert>;
    clientUrl?: string;
  }) => {
    const result = await netflowService.updateNetFlowAlert(alertId, updates, clientUrl);
    if (result.success && result.data) {
      return result.data;
    }
    throw new Error(result.error || 'Failed to update alert');
  }
);

export const deleteNetFlowAlert = createAsyncThunk(
  'netflow/deleteAlert',
  async ({ alertId, clientUrl }: { alertId: string; clientUrl?: string }) => {
    const result = await netflowService.deleteNetFlowAlert(alertId, clientUrl);
    if (result.success) {
      return alertId;
    }
    throw new Error(result.error || 'Failed to delete alert');
  }
);

export const testNetFlowAlert = createAsyncThunk(
  'netflow/testAlert',
  async ({ alertId, clientUrl }: { alertId: string; clientUrl?: string }) => {
    const result = await netflowService.testNetFlowAlert(alertId, clientUrl);
    if (result.success) {
      return { alertId, tested: true };
    }
    throw new Error(result.error || 'Failed to test alert');
  }
);

export const exportNetFlowData = createAsyncThunk(
  'netflow/exportData',
  async ({
    format,
    filter,
    clientUrl
  }: {
    format: 'csv' | 'json' | 'pcap';
    filter?: NetFlowFilter;
    clientUrl?: string;
  }) => {
    const blob = await netflowService.exportNetFlowData(format, filter, clientUrl);
    return { format, blob };
  }
);

export const fetchMultiClientNetFlowData = createAsyncThunk(
  'netflow/fetchMultiClientData',
  async ({ clientUrls, filter }: { clientUrls: string[]; filter?: NetFlowFilter }) => {
    return await netflowService.getNetFlowDataFromMultipleClients(clientUrls, filter);
  }
);

export const fetchAggregatedNetFlowAnalysis = createAsyncThunk(
  'netflow/fetchAggregatedAnalysis',
  async ({
    clientUrls,
    aggregation,
    filter
  }: {
    clientUrls: string[];
    aggregation?: NetFlowAggregation;
    filter?: NetFlowFilter;
  }) => {
    return await netflowService.getAggregatedNetFlowAnalysis(clientUrls, aggregation, filter);
  }
);

// Slice
const netflowSlice = createSlice({
  name: 'netflow',
  initialState,
  reducers: {
    // Direct state updates
    setNetFlowRecords: (state, action: PayloadAction<NetFlowRecord[]>) => {
      state.records = action.payload;
      state.lastUpdate = new Date().toISOString();
    },

    addNetFlowRecord: (state, action: PayloadAction<NetFlowRecord>) => {
      // Add to stream buffer if streaming
      if (state.streamingEnabled) {
        state.streamBuffer.unshift(action.payload);
        // Trim buffer if too large
        if (state.streamBuffer.length > state.maxBufferSize) {
          state.streamBuffer = state.streamBuffer.slice(0, state.maxBufferSize);
        }
      }
      // Also add to main records
      state.records.unshift(action.payload);
      // Keep only last 10000 records
      if (state.records.length > 10000) {
        state.records = state.records.slice(0, 10000);
      }
      state.lastUpdate = new Date().toISOString();
    },

    updateNetFlowExporter: (state, action: PayloadAction<NetFlowExporter>) => {
      const index = state.exporters.findIndex(e => e.id === action.payload.id);
      if (index !== -1) {
        state.exporters[index] = action.payload;
      } else {
        state.exporters.push(action.payload);
      }
      state.lastUpdate = new Date().toISOString();
    },

    setSelectedExporter: (state, action: PayloadAction<string | null>) => {
      state.selectedExporter = action.payload;
    },

    setFilter: (state, action: PayloadAction<NetFlowFilter>) => {
      state.filter = action.payload;
    },

    setAggregation: (state, action: PayloadAction<NetFlowAggregation | null>) => {
      state.aggregation = action.payload;
    },

    setWebSocketConnected: (state, action: PayloadAction<{ connected: boolean; url?: string }>) => {
      state.wsConnected = action.payload.connected;
      if (action.payload.url) {
        state.wsUrl = action.payload.url;
      }
    },

    setStreamingEnabled: (state, action: PayloadAction<boolean>) => {
      state.streamingEnabled = action.payload;
      if (!action.payload) {
        state.streamBuffer = [];
      }
    },

    clearStreamBuffer: (state) => {
      state.streamBuffer = [];
    },

    setMaxBufferSize: (state, action: PayloadAction<number>) => {
      state.maxBufferSize = action.payload;
    },

    setPollInterval: (state, action: PayloadAction<number>) => {
      state.pollInterval = action.payload;
    },

    clearErrors: (state) => {
      state.errors = {};
    },

    resetNetFlowState: () => initialState
  },

  extraReducers: (builder) => {
    // fetchNetFlowData
    builder.addCase(fetchNetFlowData.pending, (state) => {
      state.loading.records = true;
      state.loading.stats = true;
      state.loading.exporters = true;
      state.loading.alerts = true;
    });
    builder.addCase(fetchNetFlowData.fulfilled, (state, action) => {
      const data = action.payload;
      state.records = data.records;
      state.stats = data.stats;
      state.exporters = data.exporters;
      state.alerts = data.alerts;
      state.collectorConfig = data.config;
      state.loading.records = false;
      state.loading.stats = false;
      state.loading.exporters = false;
      state.loading.alerts = false;
      state.lastUpdate = new Date().toISOString();
      state.errors = {};
    });
    builder.addCase(fetchNetFlowData.rejected, (state, action) => {
      state.loading.records = false;
      state.loading.stats = false;
      state.loading.exporters = false;
      state.loading.alerts = false;
      const error = action.error.message || 'Failed to fetch NetFlow data';
      state.errors.records = error;
      state.errors.stats = error;
      state.errors.exporters = error;
      state.errors.alerts = error;
    });

    // fetchNetFlowRecords
    builder.addCase(fetchNetFlowRecords.pending, (state) => {
      state.loading.records = true;
      delete state.errors.records;
    });
    builder.addCase(fetchNetFlowRecords.fulfilled, (state, action) => {
      state.records = action.payload;
      state.loading.records = false;
      state.lastUpdate = new Date().toISOString();
    });
    builder.addCase(fetchNetFlowRecords.rejected, (state, action) => {
      state.loading.records = false;
      state.errors.records = action.error.message || 'Failed to fetch NetFlow records';
    });

    // fetchNetFlowStats
    builder.addCase(fetchNetFlowStats.pending, (state) => {
      state.loading.stats = true;
      delete state.errors.stats;
    });
    builder.addCase(fetchNetFlowStats.fulfilled, (state, action) => {
      state.stats = action.payload;
      state.loading.stats = false;
      state.lastUpdate = new Date().toISOString();
    });
    builder.addCase(fetchNetFlowStats.rejected, (state, action) => {
      state.loading.stats = false;
      state.errors.stats = action.error.message || 'Failed to fetch NetFlow stats';
    });

    // fetchNetFlowExporters
    builder.addCase(fetchNetFlowExporters.pending, (state) => {
      state.loading.exporters = true;
      delete state.errors.exporters;
    });
    builder.addCase(fetchNetFlowExporters.fulfilled, (state, action) => {
      state.exporters = action.payload;
      state.loading.exporters = false;
      state.lastUpdate = new Date().toISOString();
    });
    builder.addCase(fetchNetFlowExporters.rejected, (state, action) => {
      state.loading.exporters = false;
      state.errors.exporters = action.error.message || 'Failed to fetch NetFlow exporters';
    });

    // fetchNetFlowAlerts
    builder.addCase(fetchNetFlowAlerts.pending, (state) => {
      state.loading.alerts = true;
      delete state.errors.alerts;
    });
    builder.addCase(fetchNetFlowAlerts.fulfilled, (state, action) => {
      state.alerts = action.payload;
      state.loading.alerts = false;
      state.lastUpdate = new Date().toISOString();
    });
    builder.addCase(fetchNetFlowAlerts.rejected, (state, action) => {
      state.loading.alerts = false;
      state.errors.alerts = action.error.message || 'Failed to fetch NetFlow alerts';
    });

    // fetchNetFlowAnalysis
    builder.addCase(fetchNetFlowAnalysis.pending, (state) => {
      state.loading.analysis = true;
      delete state.errors.analysis;
    });
    builder.addCase(fetchNetFlowAnalysis.fulfilled, (state, action) => {
      state.analysis = action.payload;
      state.loading.analysis = false;
      state.lastUpdate = new Date().toISOString();
    });
    builder.addCase(fetchNetFlowAnalysis.rejected, (state, action) => {
      state.loading.analysis = false;
      state.errors.analysis = action.error.message || 'Failed to fetch NetFlow analysis';
    });

    // fetchNetFlowTimeSeries
    builder.addCase(fetchNetFlowTimeSeries.pending, (state) => {
      state.loading.timeSeries = true;
      delete state.errors.timeSeries;
    });
    builder.addCase(fetchNetFlowTimeSeries.fulfilled, (state, action) => {
      state.timeSeries = action.payload;
      state.loading.timeSeries = false;
      state.lastUpdate = new Date().toISOString();
    });
    builder.addCase(fetchNetFlowTimeSeries.rejected, (state, action) => {
      state.loading.timeSeries = false;
      state.errors.timeSeries = action.error.message || 'Failed to fetch time series data';
    });

    // Collector config operations
    builder.addCase(fetchNetFlowCollectorConfig.pending, (state) => {
      state.loading.config = true;
      delete state.errors.config;
    });
    builder.addCase(fetchNetFlowCollectorConfig.fulfilled, (state, action) => {
      state.collectorConfig = action.payload;
      state.loading.config = false;
    });
    builder.addCase(fetchNetFlowCollectorConfig.rejected, (state, action) => {
      state.loading.config = false;
      state.errors.config = action.error.message || 'Failed to fetch collector config';
    });

    // Start/stop collector
    builder.addCase(startNetFlowCollector.fulfilled, (state) => {
      state.collectorStatus = 'running';
    });
    builder.addCase(stopNetFlowCollector.fulfilled, (state) => {
      state.collectorStatus = 'stopped';
      state.wsConnected = false;
      state.streamingEnabled = false;
    });

    // Update config
    builder.addCase(updateNetFlowCollectorConfig.fulfilled, (state, action) => {
      if (state.collectorConfig) {
        state.collectorConfig = { ...state.collectorConfig, ...action.meta.arg.config };
      }
    });

    // Clear data
    builder.addCase(clearNetFlowData.fulfilled, (state) => {
      state.records = [];
      state.stats = null;
      state.exporters = [];
      state.alerts = [];
      state.analysis = null;
      state.timeSeries = [];
      state.streamBuffer = [];
      state.lastUpdate = null;
    });

    // Alert operations
    builder.addCase(createNetFlowAlert.fulfilled, (state, action) => {
      state.alerts.push(action.payload);
    });
    builder.addCase(updateNetFlowAlert.fulfilled, (state, action) => {
      const index = state.alerts.findIndex(a => a.id === action.payload.id);
      if (index !== -1) {
        state.alerts[index] = action.payload;
      }
    });
    builder.addCase(deleteNetFlowAlert.fulfilled, (state, action) => {
      state.alerts = state.alerts.filter(alert => alert.id !== action.payload);
    });
    builder.addCase(testNetFlowAlert.fulfilled, (state, action) => {
      const alert = state.alerts.find(a => a.id === action.payload.alertId);
      if (alert) {
        alert.last_triggered = new Date().toISOString();
        alert.trigger_count++;
      }
    });

    // Export data
    builder.addCase(exportNetFlowData.fulfilled, (state, action) => {
      // Create download link
      const url = window.URL.createObjectURL(action.payload.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `netflow-data.${action.payload.format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    });

    // Multi-client data
    builder.addCase(fetchMultiClientNetFlowData.fulfilled, (state, action) => {
      Object.entries(action.payload).forEach(([clientUrl, data]) => {
        if (!(data instanceof Error)) {
          state.clientData[clientUrl] = data;
        }
      });
      state.lastUpdate = new Date().toISOString();
    });

    // Aggregated analysis
    builder.addCase(fetchAggregatedNetFlowAnalysis.fulfilled, (state, action) => {
      state.analysis = action.payload;
      state.lastUpdate = new Date().toISOString();
    });
  }
});

// Export actions
export const {
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
} = netflowSlice.actions;

// Export reducer
export default netflowSlice.reducer;