import { createSelector } from '@reduxjs/toolkit';
import { RootState } from './store';

// Base selectors
export const selectTopologyManagerState = (state: RootState) => state.topologyManager;

export const selectTopologies = createSelector(
  [selectTopologyManagerState],
  (topologyManager) => topologyManager.topologies
);

export const selectActiveTopology = createSelector(
  [selectTopologyManagerState],
  (topologyManager) => topologyManager.activeTopology
);

export const selectSelectedTopology = createSelector(
  [selectTopologyManagerState],
  (topologyManager) => topologyManager.selectedTopology
);

export const selectTopologyDetails = createSelector(
  [selectTopologyManagerState],
  (topologyManager) => topologyManager.topologyDetails
);

export const selectCurrentHostUrl = createSelector(
  [selectTopologyManagerState],
  (topologyManager) => topologyManager.currentHostUrl
);

// Loading states
export const selectIsLoadingTopologies = createSelector(
  [selectTopologyManagerState],
  (topologyManager) => topologyManager.isLoading
);

export const selectIsLoadingDetails = createSelector(
  [selectTopologyManagerState],
  (topologyManager) => topologyManager.isLoadingDetails
);

export const selectIsActivating = createSelector(
  [selectTopologyManagerState],
  (topologyManager) => topologyManager.isActivating
);

// Error states
export const selectTopologyError = createSelector(
  [selectTopologyManagerState],
  (topologyManager) => topologyManager.error
);

export const selectDetailsError = createSelector(
  [selectTopologyManagerState],
  (topologyManager) => topologyManager.detailsError
);

// Success message
export const selectSuccessMessage = createSelector(
  [selectTopologyManagerState],
  (topologyManager) => topologyManager.successMessage
);

// Derived selectors
export const selectIsTopologyActive = createSelector(
  [selectActiveTopology, (_: RootState, name: string) => name],
  (activeTopology, name) => activeTopology?.name === name
);

export const selectTopologyByName = createSelector(
  [selectTopologies, (_: RootState, name: string) => name],
  (topologies, name) => topologies.find(t => t.name === name)
);

export const selectHasActiveTopology = createSelector(
  [selectActiveTopology],
  (activeTopology) => activeTopology !== null
);

export const selectTopologyCount = createSelector(
  [selectTopologies],
  (topologies) => topologies.length
);

export const selectTopologyDetailsSummary = createSelector(
  [selectTopologyDetails],
  (details) => {
    if (!details) return null;

    return {
      daemonCount: details.daemons.length,
      networkCount: details.networks.length,
      hostCount: details.hosts.length,
      peerCount: details.bgp_peers.length,
      routeCount: details.bgp_routes.length,
      isEmpty: details.daemons.length === 0 &&
               details.networks.length === 0 &&
               details.hosts.length === 0 &&
               details.bgp_peers.length === 0 &&
               details.bgp_routes.length === 0
    };
  }
);

export const selectTopologyManagerUIState = createSelector(
  [selectIsLoadingTopologies, selectIsLoadingDetails, selectIsActivating, selectTopologyError, selectDetailsError, selectSuccessMessage],
  (isLoading, isLoadingDetails, isActivating, error, detailsError, successMessage) => ({
    isLoading: isLoading || isLoadingDetails || isActivating,
    hasError: !!(error || detailsError),
    errorMessage: error || detailsError || null,
    successMessage
  })
);