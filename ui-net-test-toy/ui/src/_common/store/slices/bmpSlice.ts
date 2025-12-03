/**
 * BMP Redux Slice
 * State management for BGP Monitoring Protocol data
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { bmpService } from '../../services/bmp/bmpService';
import {
  BMPData,
  BMPPeer,
  BMPRoute,
  BMPFlowSpecRule,
  BMPServerConfig,
  BMPFilter,
  BMPStats,
  BMPMessage
} from '../../services/bmp/types';

interface BMPState {
  // Data
  peers: BMPPeer[];
  routes: Record<string, { advertised: BMPRoute[]; received: BMPRoute[] }>;
  flowSpecRules: BMPFlowSpecRule[];
  messages: BMPMessage[];
  stats: BMPStats | null;

  // Server config
  serverConfig: BMPServerConfig | null;
  serverStatus: 'running' | 'stopped' | 'unknown';

  // Multi-client data
  clientData: Record<string, BMPData>;

  // UI state
  selectedPeer: string | null;
  filter: BMPFilter;

  // Loading and error states
  loading: {
    peers: boolean;
    routes: boolean;
    flowSpec: boolean;
    messages: boolean;
    stats: boolean;
    config: boolean;
  };
  errors: {
    peers?: string;
    routes?: string;
    flowSpec?: string;
    messages?: string;
    stats?: string;
    config?: string;
  };

  // WebSocket
  wsConnected: boolean;
  wsUrl: string | null;

  // Polling
  pollInterval: number;
  lastUpdate: string | null;
}

const initialState: BMPState = {
  peers: [],
  routes: {},
  flowSpecRules: [],
  messages: [],
  stats: null,
  serverConfig: null,
  serverStatus: 'unknown',
  clientData: {},
  selectedPeer: null,
  filter: {},
  loading: {
    peers: false,
    routes: false,
    flowSpec: false,
    messages: false,
    stats: false,
    config: false
  },
  errors: {},
  wsConnected: false,
  wsUrl: null,
  pollInterval: 15000, // Increased from 5s to 15s to reduce server load
  lastUpdate: null
};

// Async thunks
export const fetchBMPData = createAsyncThunk(
  'bmp/fetchData',
  async ({ clientUrl, filter }: { clientUrl?: string; filter?: BMPFilter }) => {
    return await bmpService.getBMPData(clientUrl, filter);
  }
);

export const fetchBMPPeers = createAsyncThunk(
  'bmp/fetchPeers',
  async (clientUrl?: string) => {
    return await bmpService.getBMPPeers(clientUrl);
  }
);

export const fetchBMPRoutes = createAsyncThunk(
  'bmp/fetchRoutes',
  async ({ peerAddress, clientUrl }: { peerAddress?: string; clientUrl?: string }) => {
    if (peerAddress) {
      // If specific peer requested, get routes for that peer
      const routes = await bmpService.getBMPRoutes(peerAddress, clientUrl);
      return { peerAddress, routes };
    } else {
      // Get all routes as a map
      const routesMap = await bmpService.getBMPRoutesMap(clientUrl);
      return { peerAddress, routes: routesMap };
    }
  }
);

export const fetchBMPFlowSpecRules = createAsyncThunk(
  'bmp/fetchFlowSpecRules',
  async (clientUrl?: string) => {
    return await bmpService.getBMPFlowSpecRules(clientUrl);
  }
);

export const fetchBMPStats = createAsyncThunk(
  'bmp/fetchStats',
  async (clientUrl?: string) => {
    return await bmpService.getBMPStats(clientUrl);
  }
);

export const fetchBMPMessages = createAsyncThunk(
  'bmp/fetchMessages',
  async ({ limit = 100, clientUrl }: { limit?: number; clientUrl?: string }) => {
    return await bmpService.getBMPMessages(limit, clientUrl);
  }
);

export const fetchBMPServerConfig = createAsyncThunk(
  'bmp/fetchServerConfig',
  async (clientUrl?: string) => {
    return await bmpService.getBMPServerConfig(clientUrl);
  }
);

export const startBMPServer = createAsyncThunk(
  'bmp/startServer',
  async ({ config, clientUrl }: { config: Partial<BMPServerConfig>; clientUrl?: string }) => {
    return await bmpService.startBMPServer(config, clientUrl);
  }
);

export const stopBMPServer = createAsyncThunk(
  'bmp/stopServer',
  async (clientUrl?: string) => {
    return await bmpService.stopBMPServer(clientUrl);
  }
);

export const updateBMPServerConfig = createAsyncThunk(
  'bmp/updateServerConfig',
  async ({ config, clientUrl }: { config: Partial<BMPServerConfig>; clientUrl?: string }) => {
    return await bmpService.updateBMPServerConfig(config, clientUrl);
  }
);

export const clearBMPData = createAsyncThunk(
  'bmp/clearData',
  async (clientUrl?: string) => {
    return await bmpService.clearBMPData(clientUrl);
  }
);

export const deleteBMPFlowSpecRule = createAsyncThunk(
  'bmp/deleteFlowSpecRule',
  async ({ ruleId, clientUrl }: { ruleId: string; clientUrl?: string }) => {
    const result = await bmpService.deleteBMPFlowSpecRule(ruleId, clientUrl);
    if (result.success) {
      return ruleId;
    }
    throw new Error(result.error || 'Failed to delete FlowSpec rule');
  }
);

export const addBMPFlowSpecRule = createAsyncThunk(
  'bmp/addFlowSpecRule',
  async ({ rule, clientUrl }: { rule: Omit<BMPFlowSpecRule, 'id' | 'timestamp'>; clientUrl?: string }) => {
    const result = await bmpService.addBMPFlowSpecRule(rule, clientUrl);
    if (result.success && result.data) {
      return result.data;
    }
    throw new Error(result.error || 'Failed to add FlowSpec rule');
  }
);

export const fetchMultiClientBMPData = createAsyncThunk(
  'bmp/fetchMultiClientData',
  async ({ clientUrls, filter }: { clientUrls: string[]; filter?: BMPFilter }) => {
    return await bmpService.getBMPDataFromMultipleClients(clientUrls, filter);
  }
);

// Slice
const bmpSlice = createSlice({
  name: 'bmp',
  initialState,
  reducers: {
    // Direct state updates
    setBMPPeers: (state, action: PayloadAction<BMPPeer[]>) => {
      state.peers = action.payload;
      state.lastUpdate = new Date().toISOString();
    },

    addBMPMessage: (state, action: PayloadAction<BMPMessage>) => {
      state.messages.unshift(action.payload);
      // Keep only last 1000 messages
      if (state.messages.length > 1000) {
        state.messages = state.messages.slice(0, 1000);
      }
      state.lastUpdate = new Date().toISOString();
    },

    updateBMPPeer: (state, action: PayloadAction<BMPPeer>) => {
      const index = state.peers.findIndex(p => p.id === action.payload.id);
      if (index !== -1) {
        state.peers[index] = action.payload;
      } else {
        state.peers.push(action.payload);
      }
      state.lastUpdate = new Date().toISOString();
    },

    setSelectedPeer: (state, action: PayloadAction<string | null>) => {
      state.selectedPeer = action.payload;
    },

    setFilter: (state, action: PayloadAction<BMPFilter>) => {
      state.filter = action.payload;
    },

    setWebSocketConnected: (state, action: PayloadAction<{ connected: boolean; url?: string }>) => {
      state.wsConnected = action.payload.connected;
      if (action.payload.url) {
        state.wsUrl = action.payload.url;
      }
    },

    setPollInterval: (state, action: PayloadAction<number>) => {
      state.pollInterval = action.payload;
    },

    clearErrors: (state) => {
      state.errors = {};
    },

    resetBMPState: () => initialState
  },

  extraReducers: (builder) => {
    // fetchBMPData
    builder.addCase(fetchBMPData.pending, (state) => {
      state.loading.peers = true;
      state.loading.routes = true;
      state.loading.flowSpec = true;
      state.loading.stats = true;
    });
    builder.addCase(fetchBMPData.fulfilled, (state, action) => {
      const data = action.payload;
      state.peers = data.peers;
      state.routes = data.routes;
      state.flowSpecRules = data.flowspec.rules;
      state.stats = data.stats;
      state.messages = data.messages;
      state.loading.peers = false;
      state.loading.routes = false;
      state.loading.flowSpec = false;
      state.loading.stats = false;
      state.lastUpdate = new Date().toISOString();
      state.errors = {};
    });
    builder.addCase(fetchBMPData.rejected, (state, action) => {
      state.loading.peers = false;
      state.loading.routes = false;
      state.loading.flowSpec = false;
      state.loading.stats = false;
      const error = action.error.message || 'Failed to fetch BMP data';
      state.errors.peers = error;
      state.errors.routes = error;
      state.errors.flowSpec = error;
      state.errors.stats = error;
    });

    // fetchBMPPeers
    builder.addCase(fetchBMPPeers.pending, (state) => {
      state.loading.peers = true;
      delete state.errors.peers;
    });
    builder.addCase(fetchBMPPeers.fulfilled, (state, action) => {
      state.peers = action.payload;
      state.loading.peers = false;
      state.lastUpdate = new Date().toISOString();
    });
    builder.addCase(fetchBMPPeers.rejected, (state, action) => {
      state.loading.peers = false;
      state.errors.peers = action.error.message || 'Failed to fetch BMP peers';
    });

    // fetchBMPRoutes
    builder.addCase(fetchBMPRoutes.pending, (state) => {
      state.loading.routes = true;
      delete state.errors.routes;
    });
    builder.addCase(fetchBMPRoutes.fulfilled, (state, action) => {
      const { peerAddress, routes } = action.payload;
      if (peerAddress && Array.isArray(routes)) {
        // Specific peer requested - routes is an array
        const advertised = routes.filter(r => r.route_type === 'advertised');
        const received = routes.filter(r => r.route_type === 'received');
        state.routes[peerAddress] = { advertised, received };
      } else if (!peerAddress && typeof routes === 'object') {
        // All routes requested - routes is a map
        state.routes = routes as Record<string, { advertised: BMPRoute[]; received: BMPRoute[] }>;
      }
      state.loading.routes = false;
      state.lastUpdate = new Date().toISOString();
    });
    builder.addCase(fetchBMPRoutes.rejected, (state, action) => {
      state.loading.routes = false;
      state.errors.routes = action.error.message || 'Failed to fetch BMP routes';
    });

    // fetchBMPFlowSpecRules
    builder.addCase(fetchBMPFlowSpecRules.pending, (state) => {
      state.loading.flowSpec = true;
      delete state.errors.flowSpec;
    });
    builder.addCase(fetchBMPFlowSpecRules.fulfilled, (state, action) => {
      state.flowSpecRules = action.payload;
      state.loading.flowSpec = false;
      state.lastUpdate = new Date().toISOString();
    });
    builder.addCase(fetchBMPFlowSpecRules.rejected, (state, action) => {
      state.loading.flowSpec = false;
      state.errors.flowSpec = action.error.message || 'Failed to fetch FlowSpec rules';
    });

    // fetchBMPStats
    builder.addCase(fetchBMPStats.pending, (state) => {
      state.loading.stats = true;
      delete state.errors.stats;
    });
    builder.addCase(fetchBMPStats.fulfilled, (state, action) => {
      state.stats = action.payload;
      state.loading.stats = false;
      state.lastUpdate = new Date().toISOString();
    });
    builder.addCase(fetchBMPStats.rejected, (state, action) => {
      state.loading.stats = false;
      state.errors.stats = action.error.message || 'Failed to fetch BMP stats';
    });

    // fetchBMPMessages
    builder.addCase(fetchBMPMessages.pending, (state) => {
      state.loading.messages = true;
      delete state.errors.messages;
    });
    builder.addCase(fetchBMPMessages.fulfilled, (state, action) => {
      state.messages = action.payload;
      state.loading.messages = false;
      state.lastUpdate = new Date().toISOString();
    });
    builder.addCase(fetchBMPMessages.rejected, (state, action) => {
      state.loading.messages = false;
      state.errors.messages = action.error.message || 'Failed to fetch BMP messages';
    });

    // Server config operations
    builder.addCase(fetchBMPServerConfig.pending, (state) => {
      state.loading.config = true;
      delete state.errors.config;
    });
    builder.addCase(fetchBMPServerConfig.fulfilled, (state, action) => {
      state.serverConfig = action.payload;
      state.loading.config = false;
    });
    builder.addCase(fetchBMPServerConfig.rejected, (state, action) => {
      state.loading.config = false;
      state.errors.config = action.error.message || 'Failed to fetch server config';
    });

    // Start/stop server
    builder.addCase(startBMPServer.fulfilled, (state) => {
      state.serverStatus = 'running';
    });
    builder.addCase(stopBMPServer.fulfilled, (state) => {
      state.serverStatus = 'stopped';
      state.wsConnected = false;
    });

    // Update config
    builder.addCase(updateBMPServerConfig.fulfilled, (state, action) => {
      if (state.serverConfig) {
        state.serverConfig = { ...state.serverConfig, ...action.meta.arg.config };
      }
    });

    // Clear data
    builder.addCase(clearBMPData.fulfilled, (state) => {
      state.peers = [];
      state.routes = {};
      state.flowSpecRules = [];
      state.messages = [];
      state.stats = null;
      state.lastUpdate = null;
    });

    // FlowSpec rule operations
    builder.addCase(deleteBMPFlowSpecRule.fulfilled, (state, action) => {
      state.flowSpecRules = state.flowSpecRules.filter(rule => rule.id !== action.payload);
    });
    builder.addCase(addBMPFlowSpecRule.fulfilled, (state, action) => {
      state.flowSpecRules.push(action.payload);
    });

    // Multi-client data
    builder.addCase(fetchMultiClientBMPData.fulfilled, (state, action) => {
      Object.entries(action.payload).forEach(([clientUrl, data]) => {
        if (!(data instanceof Error)) {
          state.clientData[clientUrl] = data;
        }
      });
      state.lastUpdate = new Date().toISOString();
    });
  }
});

// Export actions
export const {
  setBMPPeers,
  addBMPMessage,
  updateBMPPeer,
  setSelectedPeer,
  setFilter,
  setWebSocketConnected,
  setPollInterval,
  clearErrors,
  resetBMPState
} = bmpSlice.actions;

// Export reducer
export default bmpSlice.reducer;