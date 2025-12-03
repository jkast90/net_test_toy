/**
 * GRE Tunnels Hook
 * Provides GRE tunnel data with automatic polling
 */

import { useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { useLabManager } from './useLabManager';
import {
  fetchGreTunnels,
  createGreTunnel,
  setSelectedHostIds,
  toggleSelectedHostId,
  clearError,
  clearMutationError
} from '../store/slices/greTunnelsSlice';
import {
  selectTunnelsByHost,
  selectTunnelsForHost,
  selectAllTunnels,
  selectTotalTunnelCount,
  selectSelectedHostIds,
  selectTunnelsForSelectedHosts,
  selectIsLoadingTunnels,
  selectIsCreatingTunnel,
  selectIsMutatingTunnel,
  selectTunnelsError,
  selectTunnelsMutationError,
  selectTunnelsLastFetch
} from '../store/greTunnelsSelectors';
import { GreTunnelCreateParams } from '../services/containerManager/containerManagerService';

export interface UseGreTunnelsOptions {
  /**
   * Polling interval in milliseconds
   * Default: 30000 (30 seconds)
   */
  pollInterval?: number;

  /**
   * Whether to enable automatic polling
   * Default: true
   */
  enablePolling?: boolean;

  /**
   * Whether to fetch on mount
   * Default: true
   */
  fetchOnMount?: boolean;

  /**
   * Initial selected host IDs for filtering
   * Default: all enabled hosts
   */
  initialSelectedHostIds?: string[];
}

export const useGreTunnels = (options: UseGreTunnelsOptions = {}) => {
  const {
    pollInterval = 30000,
    enablePolling = true,
    fetchOnMount = true,
    initialSelectedHostIds
  } = options;

  const dispatch = useAppDispatch();
  const { managedHosts, enabledManagedHosts } = useLabManager();

  // Selectors
  const tunnelsByHost = useAppSelector(selectTunnelsByHost);
  const allTunnels = useAppSelector(selectAllTunnels);
  const totalCount = useAppSelector(selectTotalTunnelCount);
  const selectedHostIds = useAppSelector(selectSelectedHostIds);
  const tunnelsForSelectedHosts = useAppSelector(selectTunnelsForSelectedHosts);
  const isLoading = useAppSelector(selectIsLoadingTunnels);
  const isCreating = useAppSelector(selectIsCreatingTunnel);
  const isMutating = useAppSelector(selectIsMutatingTunnel);
  const error = useAppSelector(selectTunnelsError);
  const mutationError = useAppSelector(selectTunnelsMutationError);
  const lastFetch = useAppSelector(selectTunnelsLastFetch);

  // Initialize selected host IDs on mount
  useEffect(() => {
    if (initialSelectedHostIds !== undefined) {
      dispatch(setSelectedHostIds(initialSelectedHostIds));
    } else if (selectedHostIds.length === 0 && enabledManagedHosts.length > 0) {
      // Default to all enabled hosts if not set
      dispatch(setSelectedHostIds(enabledManagedHosts.map(h => h.id)));
    }
  }, []); // Only run on mount

  // Fetch tunnels
  const refresh = useCallback(() => {
    if (enabledManagedHosts.length > 0 && selectedHostIds.length > 0) {
      dispatch(fetchGreTunnels({
        hosts: enabledManagedHosts,
        selectedHostIds
      }));
    }
  }, [dispatch, enabledManagedHosts, selectedHostIds]);

  // Get tunnels for a specific host
  const getTunnelsForHost = useCallback((hostId: string) => {
    return tunnelsByHost[hostId] || [];
  }, [tunnelsByHost]);

  // Create tunnel
  const createTunnel = useCallback(async (
    hostUrl: string,
    containerName: string,
    params: GreTunnelCreateParams
  ) => {
    const result = await dispatch(createGreTunnel({ hostUrl, containerName, params }));
    if (createGreTunnel.fulfilled.match(result)) {
      // Refresh after successful creation
      refresh();
      return { success: true };
    } else {
      return { success: false, error: result.payload as string };
    }
  }, [dispatch, refresh]);

  // Toggle host selection
  const toggleHost = useCallback((hostId: string) => {
    dispatch(toggleSelectedHostId(hostId));
  }, [dispatch]);

  // Set selected hosts
  const setSelectedHosts = useCallback((hostIds: string[]) => {
    dispatch(setSelectedHostIds(hostIds));
  }, [dispatch]);

  // Clear errors
  const clearErrors = useCallback(() => {
    dispatch(clearError());
    dispatch(clearMutationError());
  }, [dispatch]);

  // Auto-fetch on mount
  useEffect(() => {
    if (fetchOnMount && enabledManagedHosts.length > 0 && selectedHostIds.length > 0) {
      refresh();
    }
  }, [fetchOnMount]); // Only run on mount

  // Polling effect
  useEffect(() => {
    if (!enablePolling || enabledManagedHosts.length === 0 || selectedHostIds.length === 0) return;

    const interval = setInterval(() => {
      refresh();
    }, pollInterval);

    return () => clearInterval(interval);
  }, [enablePolling, pollInterval, refresh]);

  return {
    // Data
    tunnelsByHost,
    allTunnels,
    totalCount,
    tunnelsForSelectedHosts,
    getTunnelsForHost,

    // Selection
    selectedHostIds,
    toggleHost,
    setSelectedHosts,

    // Loading states
    isLoading,
    isCreating,
    isMutating,

    // Errors
    error,
    mutationError,

    // Metadata
    lastFetch,

    // Actions
    refresh,
    createTunnel,
    clearErrors
  };
};
