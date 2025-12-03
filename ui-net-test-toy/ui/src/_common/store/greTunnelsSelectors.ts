/**
 * GRE Tunnels Selectors
 */

import { createSelector } from '@reduxjs/toolkit';
import { RootState } from './store';
import { GreTunnel } from '../services/containerManager/containerManagerService';

// Base selector
const selectGreTunnelsState = (state: RootState) => state.greTunnels;

// Tunnels by host
export const selectTunnelsByHost = createSelector(
  [selectGreTunnelsState],
  (state) => state.tunnelsByHost
);

// Get tunnels for a specific host
export const selectTunnelsForHost = (hostId: string) =>
  createSelector(
    [selectTunnelsByHost],
    (tunnelsByHost) => tunnelsByHost[hostId] || []
  );

// Get all tunnels across all hosts
export const selectAllTunnels = createSelector(
  [selectTunnelsByHost],
  (tunnelsByHost) => {
    const allTunnels: GreTunnel[] = [];
    Object.values(tunnelsByHost).forEach((tunnels) => {
      allTunnels.push(...tunnels);
    });
    return allTunnels;
  }
);

// Get total tunnel count across all hosts
export const selectTotalTunnelCount = createSelector(
  [selectAllTunnels],
  (tunnels) => tunnels.length
);

// Selected host IDs for filtering
export const selectSelectedHostIds = createSelector(
  [selectGreTunnelsState],
  (state) => state.selectedHostIds
);

// Get tunnels for selected hosts only
export const selectTunnelsForSelectedHosts = createSelector(
  [selectTunnelsByHost, selectSelectedHostIds],
  (tunnelsByHost, selectedHostIds) => {
    const filteredTunnels: GreTunnel[] = [];
    selectedHostIds.forEach(hostId => {
      const tunnels = tunnelsByHost[hostId] || [];
      filteredTunnels.push(...tunnels);
    });
    return filteredTunnels;
  }
);

// Loading states
export const selectIsLoadingTunnels = createSelector(
  [selectGreTunnelsState],
  (state) => state.isLoading
);

export const selectIsCreatingTunnel = createSelector(
  [selectGreTunnelsState],
  (state) => state.isCreating
);

export const selectIsMutatingTunnel = createSelector(
  [selectIsCreatingTunnel],
  (isCreating) => isCreating
);

// Errors
export const selectTunnelsError = createSelector(
  [selectGreTunnelsState],
  (state) => state.error
);

export const selectTunnelsMutationError = createSelector(
  [selectGreTunnelsState],
  (state) => state.mutationError
);

// Last fetch timestamp
export const selectTunnelsLastFetch = createSelector(
  [selectGreTunnelsState],
  (state) => state.lastFetch
);
