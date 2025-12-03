import { createSelector } from '@reduxjs/toolkit';
import { RootState } from './store';
import { UnifiedClient, DaemonConfig } from './connectionSlice';

// Types
export type EnabledDaemon = { client: UnifiedClient; daemon: DaemonConfig };

// Base selectors
export const selectAllClients = (state: RootState) => state.connections.clients;
export const selectSelectedClientIds = (state: RootState) => state.connections.selectedClientIds;
export const selectGlobalPollInterval = (state: RootState) => state.connections.globalPollInterval;

// Memoized selectors
export const selectEnabledClients = createSelector(
  [selectAllClients],
  (clients) => clients.filter(client => client.enabled)
);

export const selectSelectedClients = createSelector(
  [selectAllClients, selectSelectedClientIds],
  (clients, selectedIds) => clients.filter(client => selectedIds.includes(client.id))
);

export const selectConnectedClients = createSelector(
  [selectAllClients],
  (clients) => clients.filter(client => client.status === 'connected')
);

export const selectClientById = (clientId: string) =>
  createSelector(
    [selectAllClients],
    (clients) => clients.find(client => client.id === clientId)
  );

// Get all enabled daemons across selected clients
export const selectEnabledDaemonsForSelectedClients = createSelector(
  [selectSelectedClients],
  (clients) => {
    const result: EnabledDaemon[] = [];

    clients.forEach(client => {
      client.daemons.forEach(daemon => {
        if (daemon.enabled) {
          result.push({ client, daemon });
        }
      });
    });

    return result;
  }
);

// Get all enabled daemons across all enabled clients (regardless of selection)
export const selectAllEnabledDaemons = createSelector(
  [selectEnabledClients],
  (clients) => {
    const result: EnabledDaemon[] = [];

    clients.forEach(client => {
      client.daemons.forEach(daemon => {
        if (daemon.enabled) {
          result.push({ client, daemon });
        }
      });
    });

    return result;
  }
);

// Get enabled daemons by type across all enabled clients
export const selectEnabledDaemonsByType = (daemonType: DaemonConfig['type']) =>
  createSelector(
    [selectEnabledClients],
    (clients) => {
      return clients
        .map(client => ({
          client,
          daemon: client.daemons.find(d => d.type === daemonType && d.enabled)
        }))
        .filter(item => item.daemon !== undefined) as EnabledDaemon[];
    }
  );

// Get connection health stats
export const selectConnectionStats = createSelector(
  [selectAllClients],
  (clients) => {
    return {
      total: clients.length,
      connected: clients.filter(c => c.status === 'connected').length,
      disconnected: clients.filter(c => c.status === 'disconnected').length,
      error: clients.filter(c => c.status === 'error').length,
      enabled: clients.filter(c => c.enabled).length
    };
  }
);

// Get poll interval from first enabled target (in milliseconds)
export const selectPollIntervalMs = createSelector(
  [selectAllEnabledDaemons],
  (targets) => {
    const defaultInterval = 5;
    const interval = targets[0]?.client.pollInterval || defaultInterval;
    return interval * 1000;
  }
);
