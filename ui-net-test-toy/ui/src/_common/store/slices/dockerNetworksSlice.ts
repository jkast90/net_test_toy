/**
 * Docker Networks Redux Slice
 * Manages Docker network data across multiple container manager hosts
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { containerManagerService, Network, NetworkCreateParams } from '../../services/containerManager/containerManagerService';

export interface DockerNetworksState {
  // Networks grouped by host ID
  networksByHost: Record<string, Network[]>;

  // Loading states
  isLoading: boolean;
  isCreating: boolean;
  isDeleting: boolean;

  // Errors
  error: string | null;
  mutationError: string | null;

  // Last fetch timestamp
  lastFetch: number | null;
}

const initialState: DockerNetworksState = {
  networksByHost: {},
  isLoading: false,
  isCreating: false,
  isDeleting: false,
  error: null,
  mutationError: null,
  lastFetch: null
};

// Async thunks
export const fetchDockerNetworks = createAsyncThunk(
  'dockerNetworks/fetchAll',
  async (hosts: Array<{ url: string; id: string; enabled: boolean }>) => {
    const networksMap = await containerManagerService.getNetworksFromHosts(hosts);
    return networksMap;
  }
);

export const createDockerNetwork = createAsyncThunk(
  'dockerNetworks/create',
  async ({ hostUrl, params }: { hostUrl: string; params: NetworkCreateParams }, { rejectWithValue }) => {
    try {
      await containerManagerService.createNetwork(hostUrl, params);
      return { success: true };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to create network');
    }
  }
);

export const deleteDockerNetwork = createAsyncThunk(
  'dockerNetworks/delete',
  async ({ hostUrl, networkName }: { hostUrl: string; networkName: string }, { rejectWithValue }) => {
    try {
      await containerManagerService.deleteNetwork(hostUrl, networkName);
      return { success: true };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to delete network');
    }
  }
);

const dockerNetworksSlice = createSlice({
  name: 'dockerNetworks',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearMutationError: (state) => {
      state.mutationError = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch networks
      .addCase(fetchDockerNetworks.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchDockerNetworks.fulfilled, (state, action) => {
        state.isLoading = false;
        state.networksByHost = action.payload;
        state.lastFetch = Date.now();
      })
      .addCase(fetchDockerNetworks.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch networks';
      })

      // Create network
      .addCase(createDockerNetwork.pending, (state) => {
        state.isCreating = true;
        state.mutationError = null;
      })
      .addCase(createDockerNetwork.fulfilled, (state) => {
        state.isCreating = false;
      })
      .addCase(createDockerNetwork.rejected, (state, action) => {
        state.isCreating = false;
        state.mutationError = action.payload as string || 'Failed to create network';
      })

      // Delete network
      .addCase(deleteDockerNetwork.pending, (state) => {
        state.isDeleting = true;
        state.mutationError = null;
      })
      .addCase(deleteDockerNetwork.fulfilled, (state) => {
        state.isDeleting = false;
      })
      .addCase(deleteDockerNetwork.rejected, (state, action) => {
        state.isDeleting = false;
        state.mutationError = action.payload as string || 'Failed to delete network';
      });
  }
});

export const { clearError, clearMutationError } = dockerNetworksSlice.actions;
export default dockerNetworksSlice.reducer;
