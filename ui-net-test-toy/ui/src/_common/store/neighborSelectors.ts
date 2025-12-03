/**
 * Neighbor Selectors
 * Memoized selectors for neighbor data
 */

import { createSelector } from '@reduxjs/toolkit';
import { RootState } from './store';
import { AggregatedNeighbor, ClientDaemonPair } from '../services/multiClientBgpApi';

const selectNeighborState = (state: RootState) => state.neighbors;

export const selectNeighbors = createSelector(
  [selectNeighborState],
  (state) => state.neighbors
);

export const selectNeighborsLoading = createSelector(
  [selectNeighborState],
  (state) => state.loading
);

export const selectNeighborsError = createSelector(
  [selectNeighborState],
  (state) => state.error
);

export const selectNeighborsLastFetch = createSelector(
  [selectNeighborState],
  (state) => state.lastFetch
);

/**
 * Group neighbors by client and backend
 * Ensures all targets are represented even if they have no neighbors
 */
export const selectGroupedNeighbors = createSelector(
  [
    selectNeighbors,
    (_state: RootState, targets: ClientDaemonPair[]) => targets
  ],
  (neighbors, targets) => {
    // Start with all targets to ensure we show daemons even with no neighbors
    const groups = targets.reduce((acc, target) => {
      const groupKey = `${target.client.id}-${target.daemon.type}`;
      if (!acc[groupKey]) {
        acc[groupKey] = {
          clientName: target.client.name,
          clientId: target.client.id,
          backend: target.daemon.type,
          neighbors: []
        };
      }
      return acc;
    }, {} as Record<string, {
      clientName: string;
      clientId: string;
      backend: string;
      neighbors: AggregatedNeighbor[]
    }>);

    // Add neighbors to their respective groups
    neighbors.forEach(neighbor => {
      const groupKey = `${neighbor.clientId}-${neighbor.backend}`;
      if (groups[groupKey]) {
        groups[groupKey].neighbors.push(neighbor);
      }
    });

    return groups;
  }
);
