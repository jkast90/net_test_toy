/**
 * Docker Networks Selectors
 */

import { createSelector } from '@reduxjs/toolkit';
import { RootState } from './store';
import { Network } from '../services/containerManager/containerManagerService';

// Base selector
const selectDockerNetworksState = (state: RootState) => state.dockerNetworks;

// Networks by host
export const selectNetworksByHost = createSelector(
  [selectDockerNetworksState],
  (state) => state.networksByHost
);

// Get networks for a specific host
export const selectNetworksForHost = (hostId: string) =>
  createSelector(
    [selectNetworksByHost],
    (networksByHost) => networksByHost[hostId] || []
  );

// Get all networks across all hosts
export const selectAllNetworks = createSelector(
  [selectNetworksByHost],
  (networksByHost) => {
    const allNetworks: Network[] = [];
    Object.values(networksByHost).forEach((networks) => {
      allNetworks.push(...networks);
    });
    return allNetworks;
  }
);

// Get total network count across all hosts
export const selectTotalNetworkCount = createSelector(
  [selectAllNetworks],
  (networks) => networks.length
);

// Loading states
export const selectIsLoadingNetworks = createSelector(
  [selectDockerNetworksState],
  (state) => state.isLoading
);

export const selectIsCreatingNetwork = createSelector(
  [selectDockerNetworksState],
  (state) => state.isCreating
);

export const selectIsDeletingNetwork = createSelector(
  [selectDockerNetworksState],
  (state) => state.isDeleting
);

export const selectIsMutatingNetwork = createSelector(
  [selectIsCreatingNetwork, selectIsDeletingNetwork],
  (isCreating, isDeleting) => isCreating || isDeleting
);

// Errors
export const selectNetworksError = createSelector(
  [selectDockerNetworksState],
  (state) => state.error
);

export const selectNetworksMutationError = createSelector(
  [selectDockerNetworksState],
  (state) => state.mutationError
);

// Last fetch timestamp
export const selectNetworksLastFetch = createSelector(
  [selectDockerNetworksState],
  (state) => state.lastFetch
);
