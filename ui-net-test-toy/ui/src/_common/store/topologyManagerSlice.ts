import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { topologyService } from '../services/topology/topologyService';
import type { Topology, TopologyDetails, TopologyMutationResult } from '../services/topology/types';

// Helper function to build activation message
const buildActivationMessage = (name: string, result: TopologyMutationResult): string => {
  if (result.success) {
    return `Topology "${name}" activated successfully`;
  }
  return result.error || 'Failed to activate topology';
};

export interface TopologyState {
  // List of all topologies
  topologies: Topology[];

  // Currently active topology
  activeTopology: Topology | null;

  // Selected topology for viewing details
  selectedTopology: string | null;

  // Details of selected topology
  topologyDetails: TopologyDetails | null;

  // Loading states
  isLoading: boolean;
  isLoadingDetails: boolean;
  isActivating: boolean;

  // Error states
  error: string | null;
  detailsError: string | null;

  // Success message
  successMessage: string | null;

  // Current host URL
  currentHostUrl: string;
}

const initialState: TopologyState = {
  topologies: [],
  activeTopology: null,
  selectedTopology: null,
  topologyDetails: null,
  isLoading: false,
  isLoadingDetails: false,
  isActivating: false,
  error: null,
  detailsError: null,
  successMessage: null,
  currentHostUrl: ''
};

// Async thunks
export const fetchTopologies = createAsyncThunk(
  'topology/fetchAll',
  async ({ hostUrl }: { hostUrl: string; suppressLogs?: boolean }) => {
    const topologies = await topologyService.getTopologies(hostUrl);
    const activeTopology = await topologyService.getActiveTopology(hostUrl);
    return { topologies, activeTopology };
  }
);

export const fetchTopologyDetails = createAsyncThunk(
  'topology/fetchDetails',
  async ({ hostUrl, name }: { hostUrl: string; name: string; suppressLogs?: boolean }) => {
    const details = await topologyService.getTopologyDetails(name, hostUrl);
    return { name, details };
  }
);

export const createTopology = createAsyncThunk(
  'topology/create',
  async ({ hostUrl, name, description }: { hostUrl: string; name: string; description: string; managementNetwork?: string }) => {
    const result = await topologyService.createTopology({ name, description }, hostUrl);
    if (!result.success) {
      throw new Error(result.error || 'Failed to create topology');
    }
    // Refetch all topologies after creation
    const topologies = await topologyService.getTopologies(hostUrl);
    const activeTopology = await topologyService.getActiveTopology(hostUrl);
    return { topologies, activeTopology, createdName: name };
  }
);

export const activateTopology = createAsyncThunk(
  'topology/activate',
  async ({ hostUrl, name }: { hostUrl: string; name: string }) => {
    const result = await topologyService.activateTopology(name, hostUrl);
    if (!result.success) {
      throw new Error(result.error || 'Failed to activate topology');
    }
    // Refetch all topologies and details after activation
    const topologies = await topologyService.getTopologies(hostUrl);
    const activeTopology = await topologyService.getActiveTopology(hostUrl);
    const details = await topologyService.getTopologyDetails(name, hostUrl);

    return {
      topologies,
      activeTopology,
      activatedName: name,
      activationResult: result,
      details
    };
  }
);

export const deleteTopology = createAsyncThunk(
  'topology/delete',
  async ({ hostUrl, name }: { hostUrl: string; name: string }) => {
    const result = await topologyService.deleteTopology(name, hostUrl);
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete topology');
    }
    // Refetch all topologies after deletion
    const topologies = await topologyService.getTopologies(hostUrl);
    const activeTopology = await topologyService.getActiveTopology(hostUrl);
    return { topologies, activeTopology, deletedName: name };
  }
);

const topologySlice = createSlice({
  name: 'topology',
  initialState,
  reducers: {
    setCurrentHostUrl: (state, action: PayloadAction<string>) => {
      state.currentHostUrl = action.payload;
      // Clear data when switching hosts
      state.topologies = [];
      state.activeTopology = null;
      state.selectedTopology = null;
      state.topologyDetails = null;
    },

    selectTopology: (state, action: PayloadAction<string | null>) => {
      state.selectedTopology = action.payload;
      if (!action.payload) {
        state.topologyDetails = null;
        state.detailsError = null;
      }
    },

    clearError: (state) => {
      state.error = null;
      state.detailsError = null;
    },

    clearSuccessMessage: (state) => {
      state.successMessage = null;
    },

    resetTopologyState: () => initialState
  },
  extraReducers: (builder) => {
    // Fetch all topologies
    builder
      .addCase(fetchTopologies.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTopologies.fulfilled, (state, action) => {
        state.isLoading = false;
        state.topologies = action.payload.topologies;
        state.activeTopology = action.payload.activeTopology;
      })
      .addCase(fetchTopologies.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch topologies';
      });

    // Fetch topology details
    builder
      .addCase(fetchTopologyDetails.pending, (state) => {
        state.isLoadingDetails = true;
        state.detailsError = null;
      })
      .addCase(fetchTopologyDetails.fulfilled, (state, action) => {
        state.isLoadingDetails = false;
        state.selectedTopology = action.payload.name;
        state.topologyDetails = action.payload.details;
      })
      .addCase(fetchTopologyDetails.rejected, (state, action) => {
        state.isLoadingDetails = false;
        state.detailsError = action.error.message || 'Failed to fetch topology details';
        state.topologyDetails = null;
      });

    // Create topology
    builder
      .addCase(createTopology.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createTopology.fulfilled, (state, action) => {
        state.isLoading = false;
        state.topologies = action.payload.topologies;
        state.activeTopology = action.payload.activeTopology;
        state.successMessage = `Topology "${action.payload.createdName}" created successfully`;
      })
      .addCase(createTopology.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to create topology';
      });

    // Activate topology
    builder
      .addCase(activateTopology.pending, (state) => {
        state.isActivating = true;
        state.error = null;
      })
      .addCase(activateTopology.fulfilled, (state, action) => {
        state.isActivating = false;
        state.topologies = action.payload.topologies;
        state.activeTopology = action.payload.activeTopology;
        state.topologyDetails = action.payload.details;
        state.selectedTopology = action.payload.activatedName;

        // Build success message
        state.successMessage = buildActivationMessage(
          action.payload.activatedName,
          action.payload.activationResult
        );
      })
      .addCase(activateTopology.rejected, (state, action) => {
        state.isActivating = false;
        state.error = action.error.message || 'Failed to activate topology';
      });

    // Delete topology
    builder
      .addCase(deleteTopology.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteTopology.fulfilled, (state, action) => {
        state.isLoading = false;
        state.topologies = action.payload.topologies;
        state.activeTopology = action.payload.activeTopology;
        state.successMessage = `Topology "${action.payload.deletedName}" deleted`;

        // Clear details if deleted topology was selected
        if (state.selectedTopology === action.payload.deletedName) {
          state.selectedTopology = null;
          state.topologyDetails = null;
        }
      })
      .addCase(deleteTopology.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to delete topology';
      });
  }
});

export const {
  setCurrentHostUrl,
  selectTopology,
  clearError,
  clearSuccessMessage,
  resetTopologyState
} = topologySlice.actions;

export default topologySlice.reducer;