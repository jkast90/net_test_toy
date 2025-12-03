/**
 * Topology Redux Slice
 * State management for topology operations
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { topologyService } from '../../services/topology/topologyService';
import {
  TopologyDefinition,
  TopologyDiscovery,
  TopologyValidation,
  TopologyVisualization,
  TopologySnapshot,
  TopologyDiff,
  TopologyFilter,
  TopologyStats,
  TopologyExportOptions,
  TopologyLayout,
  TopologySimulation,
  TopologyMutationResult
} from '../../services/topology/types';

// State interface
interface TopologyState {
  // Current topology
  currentTopology: TopologyDefinition | null;

  // Discovery
  discoveries: TopologyDiscovery[];
  activeDiscovery: TopologyDiscovery | null;

  // Validation
  validations: TopologyValidation[];
  lastValidation: TopologyValidation | null;

  // Visualization
  visualization: TopologyVisualization | null;
  layout: TopologyLayout;

  // Snapshots
  snapshots: TopologySnapshot[];

  // Simulations
  simulations: TopologySimulation[];
  activeSimulation: TopologySimulation | null;

  // Stats and analysis
  stats: TopologyStats | null;
  diff: TopologyDiff | null;

  // UI state
  selectedNodes: string[];
  selectedEdges: string[];
  filter: TopologyFilter | null;

  // Loading states
  loading: {
    topology: boolean;
    discovery: boolean;
    validation: boolean;
    visualization: boolean;
    simulation: boolean;
    export: boolean;
  };

  // Errors
  errors: {
    topology?: string;
    discovery?: string;
    validation?: string;
    visualization?: string;
    simulation?: string;
  };

  // WebSocket
  wsConnected: boolean;
  wsAutoReconnect: boolean;

  // Multi-client state
  clientTopologies: Record<string, TopologyDefinition>;
  clientDiscoveries: Record<string, TopologyDiscovery[]>;
}

// Initial state
const initialState: TopologyState = {
  currentTopology: null,
  discoveries: [],
  activeDiscovery: null,
  validations: [],
  lastValidation: null,
  visualization: null,
  layout: 'force-directed',
  snapshots: [],
  simulations: [],
  activeSimulation: null,
  stats: null,
  diff: null,
  selectedNodes: [],
  selectedEdges: [],
  filter: null,
  loading: {
    topology: false,
    discovery: false,
    validation: false,
    visualization: false,
    simulation: false,
    export: false
  },
  errors: {},
  wsConnected: false,
  wsAutoReconnect: true,
  clientTopologies: {},
  clientDiscoveries: {}
};

// Async thunks

// Topology operations
export const fetchTopology = createAsyncThunk(
  'topology/fetchTopology',
  async ({ topologyId, clientUrl }: { topologyId?: string; clientUrl?: string }) => {
    if (topologyId) {
      return await topologyService.getTopology(topologyId, clientUrl);
    }
    return await topologyService.getCurrentTopology(clientUrl);
  }
);

export const createTopology = createAsyncThunk(
  'topology/createTopology',
  async ({ topology, clientUrl }: { topology: Partial<TopologyDefinition>; clientUrl?: string }) => {
    const result = await topologyService.createTopology(topology, clientUrl);
    if (!result.success) throw new Error(result.error);
    return result.data;
  }
);

export const updateTopology = createAsyncThunk(
  'topology/updateTopology',
  async ({ topologyId, updates, clientUrl }: {
    topologyId: string;
    updates: Partial<TopologyDefinition>;
    clientUrl?: string
  }) => {
    const result = await topologyService.updateTopology(topologyId, updates, clientUrl);
    if (!result.success) throw new Error(result.error);
    return result.data;
  }
);

export const deleteTopology = createAsyncThunk(
  'topology/deleteTopology',
  async ({ topologyId, clientUrl }: { topologyId: string; clientUrl?: string }) => {
    const result = await topologyService.deleteTopology(topologyId, clientUrl);
    if (!result.success) throw new Error(result.error);
    return topologyId;
  }
);

// Discovery operations
export const runDiscovery = createAsyncThunk(
  'topology/runDiscovery',
  async ({ method, options, clientUrl }: {
    method: TopologyDiscovery['method'];
    options?: any;
    clientUrl?: string
  }) => {
    const result = await topologyService.runDiscovery(method, options, clientUrl);
    if (!result.success) throw new Error(result.error);
    return result.data;
  }
);

export const getDiscoveryHistory = createAsyncThunk(
  'topology/getDiscoveryHistory',
  async ({ limit, clientUrl }: { limit?: number; clientUrl?: string }) => {
    return await topologyService.getDiscoveryHistory(limit, clientUrl);
  }
);

// Validation operations
export const validateTopology = createAsyncThunk(
  'topology/validateTopology',
  async ({ topologyId, clientUrl }: { topologyId?: string; clientUrl?: string }) => {
    const result = await topologyService.validateTopology(topologyId, clientUrl);
    if (!result.success) throw new Error(result.error);
    return result.data;
  }
);

export const getValidationHistory = createAsyncThunk(
  'topology/getValidationHistory',
  async ({ topologyId, clientUrl }: { topologyId: string; clientUrl?: string }) => {
    return await topologyService.getValidationHistory(topologyId, clientUrl);
  }
);

// Visualization operations
export const generateVisualization = createAsyncThunk(
  'topology/generateVisualization',
  async ({ topologyId, layout, options, clientUrl }: {
    topologyId?: string;
    layout?: TopologyLayout;
    options?: any;
    clientUrl?: string
  }) => {
    const result = await topologyService.generateVisualization(topologyId, layout, options, clientUrl);
    if (!result.success) throw new Error(result.error);
    return result.data;
  }
);

// Snapshot operations
export const createSnapshot = createAsyncThunk(
  'topology/createSnapshot',
  async ({ name, description, clientUrl }: {
    name: string;
    description?: string;
    clientUrl?: string
  }) => {
    const result = await topologyService.createSnapshot(name, description, clientUrl);
    if (!result.success) throw new Error(result.error);
    return result.data;
  }
);

export const getSnapshots = createAsyncThunk(
  'topology/getSnapshots',
  async ({ clientUrl }: { clientUrl?: string }) => {
    return await topologyService.getSnapshots(clientUrl);
  }
);

export const restoreSnapshot = createAsyncThunk(
  'topology/restoreSnapshot',
  async ({ snapshotId, clientUrl }: { snapshotId: string; clientUrl?: string }) => {
    const result = await topologyService.restoreSnapshot(snapshotId, clientUrl);
    if (!result.success) throw new Error(result.error);
    return result.data;
  }
);

// Diff operations
export const compareTopologies = createAsyncThunk(
  'topology/compareTopologies',
  async ({ topologyId1, topologyId2, clientUrl }: {
    topologyId1: string;
    topologyId2: string;
    clientUrl?: string
  }) => {
    return await topologyService.compareTopologies(topologyId1, topologyId2, clientUrl);
  }
);

// Simulation operations
export const startSimulation = createAsyncThunk(
  'topology/startSimulation',
  async ({ type, parameters, clientUrl }: {
    type: TopologySimulation['type'];
    parameters?: any;
    clientUrl?: string
  }) => {
    const result = await topologyService.startSimulation(type, parameters, clientUrl);
    if (!result.success) throw new Error(result.error);
    return result.data;
  }
);

export const stopSimulation = createAsyncThunk(
  'topology/stopSimulation',
  async ({ simulationId, clientUrl }: { simulationId: string; clientUrl?: string }) => {
    const result = await topologyService.stopSimulation(simulationId, clientUrl);
    if (!result.success) throw new Error(result.error);
    return simulationId;
  }
);

// Export operations
export const exportTopology = createAsyncThunk(
  'topology/exportTopology',
  async ({ format, options, clientUrl }: {
    format: 'json' | 'graphml' | 'dot' | 'gml';
    options?: TopologyExportOptions;
    clientUrl?: string
  }) => {
    return await topologyService.exportTopology(format, options, clientUrl);
  }
);

// Import operations
export const importTopology = createAsyncThunk(
  'topology/importTopology',
  async ({ format, data, clientUrl }: {
    format: 'json' | 'graphml' | 'dot' | 'gml';
    data: string;
    clientUrl?: string
  }) => {
    const result = await topologyService.importTopology(format, data, clientUrl);
    if (!result.success) throw new Error(result.error);
    return result.data;
  }
);

// Multi-client operations
export const fetchMultiClientTopologies = createAsyncThunk(
  'topology/fetchMultiClientTopologies',
  async ({ clientUrls }: { clientUrls: string[] }) => {
    const results: Record<string, TopologyDefinition> = {};
    await Promise.all(
      clientUrls.map(async (url) => {
        try {
          const topology = await topologyService.getCurrentTopology(url);
          if (topology) {
            results[url] = topology;
          }
        } catch (error) {
          console.error(`Failed to fetch topology from ${url}:`, error);
        }
      })
    );
    return results;
  }
);

// Slice
const topologySlice = createSlice({
  name: 'topology',
  initialState,
  reducers: {
    // UI state
    setSelectedNodes(state, action: PayloadAction<string[]>) {
      state.selectedNodes = action.payload;
    },

    addSelectedNode(state, action: PayloadAction<string>) {
      if (!state.selectedNodes.includes(action.payload)) {
        state.selectedNodes.push(action.payload);
      }
    },

    removeSelectedNode(state, action: PayloadAction<string>) {
      state.selectedNodes = state.selectedNodes.filter(id => id !== action.payload);
    },

    setSelectedEdges(state, action: PayloadAction<string[]>) {
      state.selectedEdges = action.payload;
    },

    addSelectedEdge(state, action: PayloadAction<string>) {
      if (!state.selectedEdges.includes(action.payload)) {
        state.selectedEdges.push(action.payload);
      }
    },

    removeSelectedEdge(state, action: PayloadAction<string>) {
      state.selectedEdges = state.selectedEdges.filter(id => id !== action.payload);
    },

    setFilter(state, action: PayloadAction<TopologyFilter | null>) {
      state.filter = action.payload;
    },

    setLayout(state, action: PayloadAction<TopologyLayout>) {
      state.layout = action.payload;
    },

    // WebSocket
    setWsConnected(state, action: PayloadAction<boolean>) {
      state.wsConnected = action.payload;
    },

    setWsAutoReconnect(state, action: PayloadAction<boolean>) {
      state.wsAutoReconnect = action.payload;
    },

    // Clear state
    clearErrors(state) {
      state.errors = {};
    },

    clearTopologyData(state) {
      state.currentTopology = null;
      state.discoveries = [];
      state.validations = [];
      state.visualization = null;
      state.stats = null;
      state.diff = null;
    },

    resetState() {
      return initialState;
    },

    // Real-time updates
    handleTopologyUpdate(state, action: PayloadAction<TopologyDefinition>) {
      state.currentTopology = action.payload;
    },

    handleDiscoveryUpdate(state, action: PayloadAction<TopologyDiscovery>) {
      const index = state.discoveries.findIndex(d => d.id === action.payload.id);
      if (index >= 0) {
        state.discoveries[index] = action.payload;
      } else {
        state.discoveries.push(action.payload);
      }

      if (state.activeDiscovery?.id === action.payload.id) {
        state.activeDiscovery = action.payload;
      }
    },

    handleValidationUpdate(state, action: PayloadAction<TopologyValidation>) {
      const index = state.validations.findIndex(v => v.id === action.payload.id);
      if (index >= 0) {
        state.validations[index] = action.payload;
      } else {
        state.validations.push(action.payload);
      }
      state.lastValidation = action.payload;
    },

    handleSimulationUpdate(state, action: PayloadAction<TopologySimulation>) {
      const index = state.simulations.findIndex(s => s.id === action.payload.id);
      if (index >= 0) {
        state.simulations[index] = action.payload;
      } else {
        state.simulations.push(action.payload);
      }

      if (state.activeSimulation?.id === action.payload.id) {
        state.activeSimulation = action.payload;
      }
    }
  },
  extraReducers: (builder) => {
    // Fetch topology
    builder
      .addCase(fetchTopology.pending, (state) => {
        state.loading.topology = true;
        state.errors.topology = undefined;
      })
      .addCase(fetchTopology.fulfilled, (state, action) => {
        state.loading.topology = false;
        state.currentTopology = action.payload;
      })
      .addCase(fetchTopology.rejected, (state, action) => {
        state.loading.topology = false;
        state.errors.topology = action.error.message;
      });

    // Create topology
    builder
      .addCase(createTopology.pending, (state) => {
        state.loading.topology = true;
        state.errors.topology = undefined;
      })
      .addCase(createTopology.fulfilled, (state, action) => {
        state.loading.topology = false;
        state.currentTopology = action.payload;
      })
      .addCase(createTopology.rejected, (state, action) => {
        state.loading.topology = false;
        state.errors.topology = action.error.message;
      });

    // Update topology
    builder
      .addCase(updateTopology.fulfilled, (state, action) => {
        state.currentTopology = action.payload;
      })
      .addCase(updateTopology.rejected, (state, action) => {
        state.errors.topology = action.error.message;
      });

    // Delete topology
    builder
      .addCase(deleteTopology.fulfilled, (state) => {
        state.currentTopology = null;
      });

    // Run discovery
    builder
      .addCase(runDiscovery.pending, (state) => {
        state.loading.discovery = true;
        state.errors.discovery = undefined;
      })
      .addCase(runDiscovery.fulfilled, (state, action) => {
        state.loading.discovery = false;
        state.activeDiscovery = action.payload;
        state.discoveries.push(action.payload);
      })
      .addCase(runDiscovery.rejected, (state, action) => {
        state.loading.discovery = false;
        state.errors.discovery = action.error.message;
      });

    // Get discovery history
    builder
      .addCase(getDiscoveryHistory.fulfilled, (state, action) => {
        state.discoveries = action.payload;
      });

    // Validate topology
    builder
      .addCase(validateTopology.pending, (state) => {
        state.loading.validation = true;
        state.errors.validation = undefined;
      })
      .addCase(validateTopology.fulfilled, (state, action) => {
        state.loading.validation = false;
        state.lastValidation = action.payload;
        state.validations.push(action.payload);
      })
      .addCase(validateTopology.rejected, (state, action) => {
        state.loading.validation = false;
        state.errors.validation = action.error.message;
      });

    // Get validation history
    builder
      .addCase(getValidationHistory.fulfilled, (state, action) => {
        state.validations = action.payload;
      });

    // Generate visualization
    builder
      .addCase(generateVisualization.pending, (state) => {
        state.loading.visualization = true;
        state.errors.visualization = undefined;
      })
      .addCase(generateVisualization.fulfilled, (state, action) => {
        state.loading.visualization = false;
        state.visualization = action.payload;
      })
      .addCase(generateVisualization.rejected, (state, action) => {
        state.loading.visualization = false;
        state.errors.visualization = action.error.message;
      });

    // Create snapshot
    builder
      .addCase(createSnapshot.fulfilled, (state, action) => {
        state.snapshots.push(action.payload);
      });

    // Get snapshots
    builder
      .addCase(getSnapshots.fulfilled, (state, action) => {
        state.snapshots = action.payload;
      });

    // Restore snapshot
    builder
      .addCase(restoreSnapshot.fulfilled, (state, action) => {
        state.currentTopology = action.payload;
      });

    // Compare topologies
    builder
      .addCase(compareTopologies.fulfilled, (state, action) => {
        state.diff = action.payload;
      });

    // Start simulation
    builder
      .addCase(startSimulation.pending, (state) => {
        state.loading.simulation = true;
        state.errors.simulation = undefined;
      })
      .addCase(startSimulation.fulfilled, (state, action) => {
        state.loading.simulation = false;
        state.activeSimulation = action.payload;
        state.simulations.push(action.payload);
      })
      .addCase(startSimulation.rejected, (state, action) => {
        state.loading.simulation = false;
        state.errors.simulation = action.error.message;
      });

    // Stop simulation
    builder
      .addCase(stopSimulation.fulfilled, (state, action) => {
        const simulation = state.simulations.find(s => s.id === action.payload);
        if (simulation) {
          simulation.status = 'stopped';
        }
        if (state.activeSimulation?.id === action.payload) {
          state.activeSimulation = null;
        }
      });

    // Export topology
    builder
      .addCase(exportTopology.pending, (state) => {
        state.loading.export = true;
      })
      .addCase(exportTopology.fulfilled, (state) => {
        state.loading.export = false;
      })
      .addCase(exportTopology.rejected, (state) => {
        state.loading.export = false;
      });

    // Import topology
    builder
      .addCase(importTopology.fulfilled, (state, action) => {
        state.currentTopology = action.payload;
      });

    // Multi-client operations
    builder
      .addCase(fetchMultiClientTopologies.fulfilled, (state, action) => {
        state.clientTopologies = action.payload;
      });
  }
});

// Export actions
export const {
  setSelectedNodes,
  addSelectedNode,
  removeSelectedNode,
  setSelectedEdges,
  addSelectedEdge,
  removeSelectedEdge,
  setFilter,
  setLayout,
  setWsConnected,
  setWsAutoReconnect,
  clearErrors,
  clearTopologyData,
  resetState,
  handleTopologyUpdate,
  handleDiscoveryUpdate,
  handleValidationUpdate,
  handleSimulationUpdate
} = topologySlice.actions;

// Export reducer
export default topologySlice.reducer;