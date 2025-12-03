import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface DaemonConfig {
  type: 'gobgp' | 'frr' | 'exabgp' | 'bmp' | 'netflow';
  name?: string;
  enabled: boolean;
  port?: number;
}

export interface UnifiedClient {
  id: string;
  name: string;
  baseUrl: string;
  daemons: DaemonConfig[];
  pollInterval: number; // in seconds, min 1, max 60
  enabled: boolean;
  status: 'connected' | 'disconnected' | 'error';
  lastPoll?: string;
  error?: string;
  isLocal?: boolean; // True if auto-discovered from local Lab Manager
  daemonName?: string; // Associated daemon name from Lab Manager (for local clients)
}

export interface ConnectionState {
  clients: UnifiedClient[];
  selectedClientIds: string[]; // Multi-select for target selection in forms
  globalPollInterval: number;
}

const STORAGE_KEY = 'route-herald-connections';

// Load initial state from localStorage
const loadFromStorage = (): ConnectionState => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);

      // Migration: Remove local clients with old container IPs (192.168.70.x)
      // These will be re-discovered with correct localhost URLs
      if (parsed.clients && Array.isArray(parsed.clients)) {
        const hasOldContainerIPs = parsed.clients.some(
          (c: UnifiedClient) => c.isLocal && c.baseUrl.includes('192.168.70.')
        );

        if (hasOldContainerIPs) {
          // console.log('[connectionSlice] Migrating: removing local clients with old container IPs');
          // Remove all local clients - they'll be re-discovered with correct URLs
          parsed.clients = parsed.clients.filter((c: UnifiedClient) => !c.isLocal);
          // Clear selectedClientIds that reference removed clients
          parsed.selectedClientIds = parsed.selectedClientIds.filter(
            (id: string) => parsed.clients.some((c: UnifiedClient) => c.id === id)
          );
          // Save the migrated state back to localStorage
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
            // console.log('[connectionSlice] Migration saved to localStorage');
          } catch (e) {
            console.error('[connectionSlice] Failed to save migration:', e);
          }
        }
      }

      return parsed;
    }
  } catch (error) {
    console.error('Failed to load connections from localStorage:', error);
  }

  // Default state - no hardcoded clients
  // Users must explicitly add their BGP clients
  return {
    clients: [],
    selectedClientIds: [],
    globalPollInterval: 5
  };
};

const initialState: ConnectionState = loadFromStorage();

const connectionSlice = createSlice({
  name: 'connections',
  initialState,
  reducers: {
    addClient: (state, action: PayloadAction<Omit<UnifiedClient, 'id' | 'status'>>) => {
      const newClient: UnifiedClient = {
        ...action.payload,
        id: `client-${Date.now()}`,
        status: 'disconnected'
      };
      state.clients.push(newClient);
      saveToStorage(state);
    },

    updateClient: (state, action: PayloadAction<{ id: string; updates: Partial<UnifiedClient> }>) => {
      const client = state.clients.find(c => c.id === action.payload.id);
      if (client) {
        Object.assign(client, action.payload.updates);
        saveToStorage(state);
      }
    },

    removeClient: (state, action: PayloadAction<string>) => {
      state.clients = state.clients.filter(c => c.id !== action.payload);
      state.selectedClientIds = state.selectedClientIds.filter(id => id !== action.payload);
      if (state.selectedClientIds.length === 0 && state.clients.length > 0) {
        state.selectedClientIds = [state.clients[0].id];
      }
      saveToStorage(state);
    },

    toggleClientEnabled: (state, action: PayloadAction<string>) => {
      const client = state.clients.find(c => c.id === action.payload);
      if (client) {
        client.enabled = !client.enabled;
        saveToStorage(state);
      }
    },

    toggleDaemon: (state, action: PayloadAction<{ clientId: string; daemonType: DaemonConfig['type'] }>) => {
      const client = state.clients.find(c => c.id === action.payload.clientId);
      if (client) {
        const daemon = client.daemons.find(d => d.type === action.payload.daemonType);
        if (daemon) {
          daemon.enabled = !daemon.enabled;
          saveToStorage(state);
        }
      }
    },

    setClientStatus: (state, action: PayloadAction<{ id: string; status: UnifiedClient['status']; error?: string }>) => {
      const client = state.clients.find(c => c.id === action.payload.id);
      if (client) {
        client.status = action.payload.status;
        client.error = action.payload.error;
        client.lastPoll = new Date().toISOString();
      }
    },

    setSelectedClients: (state, action: PayloadAction<string[]>) => {
      state.selectedClientIds = action.payload;
      saveToStorage(state);
    },

    toggleSelectedClient: (state, action: PayloadAction<string>) => {
      const index = state.selectedClientIds.indexOf(action.payload);
      if (index >= 0) {
        state.selectedClientIds = state.selectedClientIds.filter(id => id !== action.payload);
      } else {
        state.selectedClientIds.push(action.payload);
      }
      saveToStorage(state);
    },

    setGlobalPollInterval: (state, action: PayloadAction<number>) => {
      const interval = Math.max(1, Math.min(60, action.payload));
      state.globalPollInterval = interval;
      saveToStorage(state);
    },

    setClientPollInterval: (state, action: PayloadAction<{ id: string; interval: number }>) => {
      const client = state.clients.find(c => c.id === action.payload.id);
      if (client) {
        client.pollInterval = Math.max(1, Math.min(60, action.payload.interval));
        saveToStorage(state);
      }
    },

    // Sync local daemons from Lab Manager
    syncLocalDaemons: (state, action: PayloadAction<Array<{
      name: string;
      daemon_type: string;
      ip_address: string;
      api_port: string;
      status: string;
    }>>) => {
      const localDaemons = action.payload;
      const existingLocalClientIds = new Set(
        state.clients.filter(c => c.isLocal).map(c => c.id)
      );

      // Add or update local daemons
      localDaemons.forEach(daemon => {
        const clientId = `local-${daemon.name}`;
        const existingClient = state.clients.find(c => c.id === clientId);

        const baseUrl = `http://${daemon.ip_address}:${daemon.api_port}`;

        // console.log(`[syncLocalDaemons] Processing daemon: ${daemon.name}`, {
        //   ip_address: daemon.ip_address,
        //   api_port: daemon.api_port,
        //   baseUrl,
        //   existingClient: existingClient ? `${existingClient.name} - ${existingClient.baseUrl}` : 'NEW'
        // });

        // Determine enabled daemons based on daemon_type
        const enabledDaemons: DaemonConfig[] = [
          { type: 'gobgp', enabled: daemon.daemon_type === 'gobgp' },
          { type: 'frr', enabled: daemon.daemon_type === 'frr' },
          { type: 'exabgp', enabled: daemon.daemon_type === 'exabgp' },
        ];

        if (existingClient) {
          // Update existing (don't change status - let connection poller handle that)
          // console.log(`[syncLocalDaemons] Updating existing client ${existingClient.id} from ${existingClient.baseUrl} to ${baseUrl}`);
          existingClient.name = `${daemon.name} (Local)`;
          existingClient.baseUrl = baseUrl;
          existingClient.daemons = enabledDaemons;
          // Keep existing enabled state and status - don't override
        } else {
          // Add new local daemon (status will be verified by connection poller)
          const newClient: UnifiedClient = {
            id: clientId,
            name: `${daemon.name} (Local)`,
            baseUrl,
            daemons: enabledDaemons,
            pollInterval: 5,
            enabled: true,
            status: 'disconnected', // Start as disconnected, let connection poller verify
            isLocal: true,
            daemonName: daemon.name
          };
          state.clients.push(newClient);
        }

        existingLocalClientIds.delete(clientId);
      });

      // Remove local daemons that no longer exist
      existingLocalClientIds.forEach(id => {
        state.clients = state.clients.filter(c => c.id !== id);
        state.selectedClientIds = state.selectedClientIds.filter(sid => sid !== id);
      });

      // Ensure at least one client is selected
      if (state.selectedClientIds.length === 0 && state.clients.length > 0) {
        state.selectedClientIds = [state.clients[0].id];
      }

      saveToStorage(state);
    }
  }
});

// Helper to save to localStorage
function saveToStorage(state: ConnectionState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save connections to localStorage:', error);
  }
}

export const {
  addClient,
  updateClient,
  removeClient,
  toggleClientEnabled,
  toggleDaemon,
  setClientStatus,
  setSelectedClients,
  toggleSelectedClient,
  setGlobalPollInterval,
  setClientPollInterval,
  syncLocalDaemons
} = connectionSlice.actions;

export default connectionSlice.reducer;
