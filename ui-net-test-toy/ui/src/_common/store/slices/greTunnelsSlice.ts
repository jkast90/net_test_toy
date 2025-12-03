/**
 * GRE Tunnels Redux Slice
 * Manages GRE tunnel data across multiple container manager hosts
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { containerManagerService, GreTunnel, GreTunnelCreateParams } from '../../services/containerManager/containerManagerService';

export interface GreTunnelsState {
  // Tunnels grouped by host ID
  tunnelsByHost: Record<string, GreTunnel[]>;

  // Selected hosts for tunnel filtering
  selectedHostIds: string[];

  // Loading states
  isLoading: boolean;
  isCreating: boolean;

  // Errors
  error: string | null;
  mutationError: string | null;

  // Last fetch timestamp
  lastFetch: number | null;
}

const initialState: GreTunnelsState = {
  tunnelsByHost: {},
  selectedHostIds: [],
  isLoading: false,
  isCreating: false,
  error: null,
  mutationError: null,
  lastFetch: null
};

// Async thunks
export const fetchGreTunnels = createAsyncThunk(
  'greTunnels/fetchAll',
  async ({
    hosts,
    selectedHostIds
  }: {
    hosts: Array<{ url: string; id: string; enabled: boolean }>;
    selectedHostIds: string[];
  }) => {
    const tunnelsMap = await containerManagerService.getGreTunnelsFromHosts(hosts, selectedHostIds);
    return tunnelsMap;
  }
);

export const createGreTunnel = createAsyncThunk(
  'greTunnels/create',
  async ({
    hostUrl,
    containerName,
    params
  }: {
    hostUrl: string;
    containerName: string;
    params: GreTunnelCreateParams;
  }, { rejectWithValue }) => {
    try {
      await containerManagerService.createGreTunnel(hostUrl, containerName, params);
      return { success: true };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to create GRE tunnel');
    }
  }
);

const greTunnelsSlice = createSlice({
  name: 'greTunnels',
  initialState,
  reducers: {
    setSelectedHostIds: (state, action: PayloadAction<string[]>) => {
      state.selectedHostIds = action.payload;
    },
    toggleSelectedHostId: (state, action: PayloadAction<string>) => {
      const hostId = action.payload;
      const index = state.selectedHostIds.indexOf(hostId);
      if (index > -1) {
        state.selectedHostIds.splice(index, 1);
      } else {
        state.selectedHostIds.push(hostId);
      }
    },
    clearError: (state) => {
      state.error = null;
    },
    clearMutationError: (state) => {
      state.mutationError = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch tunnels
      .addCase(fetchGreTunnels.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchGreTunnels.fulfilled, (state, action) => {
        state.isLoading = false;
        state.tunnelsByHost = action.payload;
        state.lastFetch = Date.now();
      })
      .addCase(fetchGreTunnels.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch GRE tunnels';
      })

      // Create tunnel
      .addCase(createGreTunnel.pending, (state) => {
        state.isCreating = true;
        state.mutationError = null;
      })
      .addCase(createGreTunnel.fulfilled, (state) => {
        state.isCreating = false;
      })
      .addCase(createGreTunnel.rejected, (state, action) => {
        state.isCreating = false;
        state.mutationError = action.payload as string || 'Failed to create GRE tunnel';
      });
  }
});

export const {
  setSelectedHostIds,
  toggleSelectedHostId,
  clearError,
  clearMutationError
} = greTunnelsSlice.actions;

export default greTunnelsSlice.reducer;
