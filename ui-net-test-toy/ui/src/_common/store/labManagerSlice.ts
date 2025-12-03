import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { labManagerService, type LabDaemon, type LabHost } from '../services/labManager/labManagerService';
import {
  createDaemon,
  updateDaemon,
  deleteDaemon,
  createLabHost,
  deleteLabHost,
  associateNetwork,
  restoreLab
} from '../services/labManager/labManagerMutations';

// Re-export types from service for backward compatibility
export type { LabDaemon, LabHost };

export interface ManagedHost {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  status: 'connected' | 'disconnected' | 'error';
  error?: string;
}

export interface LabManagerState {
  managedHosts: ManagedHost[];
  daemons: Record<string, LabDaemon[]>; // Keyed by managed host ID
  hosts: Record<string, LabHost[]>;      // Keyed by managed host ID
  selectedHostId: string;
  isLoading: boolean;
  error: string | null;
  // Mutation states
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  mutationError: string | null;
}

const STORAGE_KEY = 'managedHosts';

// Load managed hosts from localStorage
const loadManagedHosts = (): ManagedHost[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('Failed to load managed hosts:', error);
  }

  // Return empty array - users must explicitly add their managed hosts
  // No hardcoded defaults to avoid confusion with dynamic host management
  return [];
};

const initialState: LabManagerState = {
  managedHosts: loadManagedHosts(),
  daemons: {},
  hosts: {},
  selectedHostId: null, // No default - user must select a managed host
  isLoading: false,
  error: null,
  isCreating: false,
  isUpdating: false,
  isDeleting: false,
  mutationError: null
};

// Async thunk to fetch lab data from all managed hosts
export const fetchLabData = createAsyncThunk(
  'labManager/fetchLabData',
  async (_, { getState }) => {
    const state = getState() as any;
    const managedHosts = state.labManager.managedHosts.filter((h: ManagedHost) => h.enabled);

    return labManagerService.getLabDataFromHosts(managedHosts);
  }
);

// Async thunk to fetch data from a single managed host
export const fetchSingleHostData = createAsyncThunk(
  'labManager/fetchSingleHostData',
  async (hostId: string, { getState }) => {
    const state = getState() as any;
    const host = state.labManager.managedHosts.find((h: ManagedHost) => h.id === hostId);

    if (!host || !host.enabled) {
      throw new Error('Host not found or not enabled');
    }

    try {
      const data = await labManagerService.getLabData(host.url);
      return {
        hostId: host.id,
        daemons: data.daemons,
        hosts: data.hosts,
        status: 'connected' as const
      };
    } catch (error) {
      return {
        hostId: host.id,
        daemons: [],
        hosts: [],
        status: 'error' as const,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
);

const labManagerSlice = createSlice({
  name: 'labManager',
  initialState,
  reducers: {
    addManagedHost: (state, action: PayloadAction<Omit<ManagedHost, 'id' | 'status'>>) => {
      const newHost: ManagedHost = {
        ...action.payload,
        id: `host-${Date.now()}`,
        status: 'disconnected'
      };
      state.managedHosts.push(newHost);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.managedHosts));
    },
    updateManagedHost: (state, action: PayloadAction<ManagedHost>) => {
      const index = state.managedHosts.findIndex(h => h.id === action.payload.id);
      if (index !== -1) {
        state.managedHosts[index] = action.payload;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.managedHosts));
      }
    },
    removeManagedHost: (state, action: PayloadAction<string>) => {
      state.managedHosts = state.managedHosts.filter(h => h.id !== action.payload);
      delete state.daemons[action.payload];
      delete state.hosts[action.payload];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.managedHosts));
    },
    toggleManagedHost: (state, action: PayloadAction<string>) => {
      const host = state.managedHosts.find(h => h.id === action.payload);
      if (host) {
        host.enabled = !host.enabled;
        if (!host.enabled) {
          host.status = 'disconnected';
          delete state.daemons[action.payload];
          delete state.hosts[action.payload];
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.managedHosts));
      }
    },
    setSelectedHostId: (state, action: PayloadAction<string>) => {
      state.selectedHostId = action.payload;
    },
    clearLabData: (state) => {
      state.daemons = {};
      state.hosts = {};
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Handle fetchLabData
      .addCase(fetchLabData.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchLabData.fulfilled, (state, action) => {
        state.isLoading = false;

        // Update data and host statuses
        action.payload.forEach(result => {
          state.daemons[result.hostId] = result.daemons;
          state.hosts[result.hostId] = result.hosts;

          const host = state.managedHosts.find(h => h.id === result.hostId);
          if (host) {
            host.status = result.status === 'connected' ? 'connected' : 'error';
            host.error = result.error;
          }
        });

        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.managedHosts));
      })
      .addCase(fetchLabData.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch lab data';
      })
      // Handle fetchSingleHostData
      .addCase(fetchSingleHostData.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchSingleHostData.fulfilled, (state, action) => {
        state.isLoading = false;

        const result = action.payload;
        state.daemons[result.hostId] = result.daemons;
        state.hosts[result.hostId] = result.hosts;

        const host = state.managedHosts.find(h => h.id === result.hostId);
        if (host) {
          host.status = result.status === 'connected' ? 'connected' : 'error';
          host.error = result.error;
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.managedHosts));
      })
      .addCase(fetchSingleHostData.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch host data';
      })
      // Handle createDaemon
      .addCase(createDaemon.pending, (state) => {
        state.isCreating = true;
        state.mutationError = null;
      })
      .addCase(createDaemon.fulfilled, (state) => {
        state.isCreating = false;
      })
      .addCase(createDaemon.rejected, (state, action) => {
        state.isCreating = false;
        state.mutationError = action.payload || 'Failed to create daemon';
      })
      // Handle updateDaemon
      .addCase(updateDaemon.pending, (state) => {
        state.isUpdating = true;
        state.mutationError = null;
      })
      .addCase(updateDaemon.fulfilled, (state) => {
        state.isUpdating = false;
      })
      .addCase(updateDaemon.rejected, (state, action) => {
        state.isUpdating = false;
        state.mutationError = action.payload || 'Failed to update daemon';
      })
      // Handle deleteDaemon
      .addCase(deleteDaemon.pending, (state) => {
        state.isDeleting = true;
        state.mutationError = null;
      })
      .addCase(deleteDaemon.fulfilled, (state) => {
        state.isDeleting = false;
      })
      .addCase(deleteDaemon.rejected, (state, action) => {
        state.isDeleting = false;
        state.mutationError = action.payload || 'Failed to delete daemon';
      })
      // Handle createLabHost
      .addCase(createLabHost.pending, (state) => {
        state.isCreating = true;
        state.mutationError = null;
      })
      .addCase(createLabHost.fulfilled, (state) => {
        state.isCreating = false;
      })
      .addCase(createLabHost.rejected, (state, action) => {
        state.isCreating = false;
        state.mutationError = action.payload || 'Failed to create host';
      })
      // Handle deleteLabHost
      .addCase(deleteLabHost.pending, (state) => {
        state.isDeleting = true;
        state.mutationError = null;
      })
      .addCase(deleteLabHost.fulfilled, (state) => {
        state.isDeleting = false;
      })
      .addCase(deleteLabHost.rejected, (state, action) => {
        state.isDeleting = false;
        state.mutationError = action.payload || 'Failed to delete host';
      })
      // Handle associateNetwork
      .addCase(associateNetwork.pending, (state) => {
        state.isUpdating = true;
        state.mutationError = null;
      })
      .addCase(associateNetwork.fulfilled, (state) => {
        state.isUpdating = false;
      })
      .addCase(associateNetwork.rejected, (state, action) => {
        state.isUpdating = false;
        state.mutationError = action.payload || 'Failed to associate network';
      })
      // Handle restoreLab
      .addCase(restoreLab.pending, (state) => {
        state.isUpdating = true;
        state.mutationError = null;
      })
      .addCase(restoreLab.fulfilled, (state) => {
        state.isUpdating = false;
      })
      .addCase(restoreLab.rejected, (state, action) => {
        state.isUpdating = false;
        state.mutationError = action.payload || 'Failed to restore lab';
      });
  }
});

export const {
  addManagedHost,
  updateManagedHost,
  removeManagedHost,
  toggleManagedHost,
  setSelectedHostId,
  clearLabData
} = labManagerSlice.actions;

// Re-export mutation thunks
export {
  createDaemon,
  updateDaemon,
  deleteDaemon,
  createLabHost,
  deleteLabHost,
  associateNetwork,
  restoreLab
};

export default labManagerSlice.reducer;