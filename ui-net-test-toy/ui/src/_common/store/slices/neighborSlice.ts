/**
 * Neighbor Redux Slice
 * Manages BGP neighbor state
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { filterValidNeighbors, sortNeighbors } from '../../services/neighbors/neighborService';
import { fetchAggregatedNeighbors, deleteNeighborFromTargets, AggregatedNeighbor, ClientDaemonPair } from '../../services/multiClientBgpApi';

interface NeighborState {
  neighbors: AggregatedNeighbor[];
  loading: boolean;
  error: string | null;
  lastFetch: number | null;
}

const initialState: NeighborState = {
  neighbors: [],
  loading: false,
  error: null,
  lastFetch: null
};

/**
 * Fetch neighbors from targets
 * Filters out zero addresses and sorts before storing in Redux
 */
export const fetchNeighbors = createAsyncThunk(
  'neighbors/fetch',
  async (targets: ClientDaemonPair[]) => {
    if (targets.length === 0) {
      return [];
    }

    // Fetch raw neighbor data
    const neighbors = await fetchAggregatedNeighbors(targets);

    // Filter out invalid neighbors (zero addresses) BEFORE storing in Redux
    const filtered = filterValidNeighbors(neighbors);

    // Sort consistently
    const sorted = sortNeighbors(filtered);

    return sorted;
  }
);

/**
 * Delete a neighbor
 */
export const deleteNeighbor = createAsyncThunk(
  'neighbors/delete',
  async ({ target, neighborIp }: { target: ClientDaemonPair; neighborIp: string }) => {
    await deleteNeighborFromTargets([target], neighborIp);
    return neighborIp;
  }
);

const neighborSlice = createSlice({
  name: 'neighbors',
  initialState,
  reducers: {
    clearNeighbors: (state) => {
      state.neighbors = [];
      state.error = null;
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch neighbors
      .addCase(fetchNeighbors.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNeighbors.fulfilled, (state, action) => {
        state.loading = false;
        state.neighbors = action.payload;
        state.lastFetch = Date.now();
        state.error = null;
      })
      .addCase(fetchNeighbors.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch neighbors';
      })
      // Delete neighbor
      .addCase(deleteNeighbor.pending, (state) => {
        state.loading = true;
      })
      .addCase(deleteNeighbor.fulfilled, (state, action) => {
        state.loading = false;
        // Remove the deleted neighbor from state
        state.neighbors = state.neighbors.filter(n => n.neighbor_ip !== action.payload);
      })
      .addCase(deleteNeighbor.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to delete neighbor';
      });
  }
});

export const { clearNeighbors, clearError } = neighborSlice.actions;
export default neighborSlice.reducer;
