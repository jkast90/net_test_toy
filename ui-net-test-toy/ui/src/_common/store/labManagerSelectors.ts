import { createSelector } from '@reduxjs/toolkit';
import { RootState } from './store';
import { LabDaemon, LabHost, ManagedHost } from './labManagerSlice';

// Base selectors
export const selectLabManagerState = (state: RootState) => state.labManager;

export const selectManagedHosts = createSelector(
  [selectLabManagerState],
  (labManager) => labManager.managedHosts
);

export const selectEnabledManagedHosts = createSelector(
  [selectManagedHosts],
  (hosts) => hosts.filter(h => h.enabled)
);

export const selectEnabledManagedHostIds = createSelector(
  [selectEnabledManagedHosts],
  (hosts) => hosts.map(h => h.id)
);

export const selectSelectedHostId = createSelector(
  [selectLabManagerState],
  (labManager) => labManager.selectedHostId
);

export const selectLabDaemons = createSelector(
  [selectLabManagerState],
  (labManager) => labManager.daemons
);

export const selectLabHosts = createSelector(
  [selectLabManagerState],
  (labManager) => labManager.hosts
);

// Get all daemons from all managed hosts
export const selectAllLabDaemons = createSelector(
  [selectLabDaemons],
  (daemonsByHost): LabDaemon[] => {
    const allDaemons: LabDaemon[] = [];
    Object.values(daemonsByHost).forEach(daemons => {
      allDaemons.push(...daemons);
    });
    return allDaemons;
  }
);

// Get all hosts from all managed hosts
export const selectAllLabHosts = createSelector(
  [selectLabHosts],
  (hostsByHost): LabHost[] => {
    const allHosts: LabHost[] = [];
    Object.values(hostsByHost).forEach(hosts => {
      allHosts.push(...hosts);
    });
    return allHosts;
  }
);

// Get daemons for a specific managed host
export const selectDaemonsByHost = createSelector(
  [selectLabDaemons, (_: RootState, hostId: string) => hostId],
  (daemons, hostId) => daemons[hostId] || []
);

// Get hosts for a specific managed host
export const selectHostsByHost = createSelector(
  [selectLabHosts, (_: RootState, hostId: string) => hostId],
  (hosts, hostId) => hosts[hostId] || []
);

// Get daemons for the selected host
export const selectSelectedHostDaemons = createSelector(
  [selectLabDaemons, selectSelectedHostId],
  (daemons, selectedHostId) => daemons[selectedHostId] || []
);

// Get hosts for the selected host
export const selectSelectedHostHosts = createSelector(
  [selectLabHosts, selectSelectedHostId],
  (hosts, selectedHostId) => hosts[selectedHostId] || []
);

// Combined data for all enabled managed hosts
export const selectCombinedLabData = createSelector(
  [selectEnabledManagedHosts, selectLabDaemons, selectLabHosts],
  (managedHosts, daemonsByHost, hostsByHost) => {
    const result: {
      managedHost: ManagedHost;
      daemons: LabDaemon[];
      hosts: LabHost[];
    }[] = [];

    managedHosts.forEach(managedHost => {
      result.push({
        managedHost,
        daemons: daemonsByHost[managedHost.id] || [],
        hosts: hostsByHost[managedHost.id] || []
      });
    });

    return result;
  }
);

// Check if lab data is loaded
export const selectIsLabDataLoaded = createSelector(
  [selectLabDaemons, selectLabHosts],
  (daemons, hosts) => {
    return Object.keys(daemons).length > 0 || Object.keys(hosts).length > 0;
  }
);

// Get loading state
export const selectIsLabDataLoading = createSelector(
  [selectLabManagerState],
  (labManager) => labManager.isLoading
);

// Get error state
export const selectLabDataError = createSelector(
  [selectLabManagerState],
  (labManager) => labManager.error
);

// Mutation states
export const selectIsCreating = createSelector(
  [selectLabManagerState],
  (labManager) => labManager.isCreating
);

export const selectIsUpdating = createSelector(
  [selectLabManagerState],
  (labManager) => labManager.isUpdating
);

export const selectIsDeleting = createSelector(
  [selectLabManagerState],
  (labManager) => labManager.isDeleting
);

export const selectMutationError = createSelector(
  [selectLabManagerState],
  (labManager) => labManager.mutationError
);

export const selectIsMutating = createSelector(
  [selectIsCreating, selectIsUpdating, selectIsDeleting],
  (isCreating, isUpdating, isDeleting) => isCreating || isUpdating || isDeleting
);