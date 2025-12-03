/**
 * Docker Networks Hook
 * Provides Docker network data with automatic polling
 */

import { useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { useLabManager } from './useLabManager';
import {
  fetchDockerNetworks,
  createDockerNetwork,
  deleteDockerNetwork,
  clearError,
  clearMutationError
} from '../store/slices/dockerNetworksSlice';
import {
  selectNetworksByHost,
  selectNetworksForHost,
  selectAllNetworks,
  selectTotalNetworkCount,
  selectIsLoadingNetworks,
  selectIsCreatingNetwork,
  selectIsDeletingNetwork,
  selectIsMutatingNetwork,
  selectNetworksError,
  selectNetworksMutationError,
  selectNetworksLastFetch
} from '../store/dockerNetworksSelectors';
import { NetworkCreateParams } from '../services/containerManager/containerManagerService';

export interface UseDockerNetworksOptions {
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
}

export const useDockerNetworks = (options: UseDockerNetworksOptions = {}) => {
  const {
    pollInterval = 30000,
    enablePolling = true,
    fetchOnMount = true
  } = options;

  const dispatch = useAppDispatch();
  const { managedHosts, enabledManagedHosts } = useLabManager();

  // Selectors
  const networksByHost = useAppSelector(selectNetworksByHost);
  const allNetworks = useAppSelector(selectAllNetworks);
  const totalCount = useAppSelector(selectTotalNetworkCount);
  const isLoading = useAppSelector(selectIsLoadingNetworks);
  const isCreating = useAppSelector(selectIsCreatingNetwork);
  const isDeleting = useAppSelector(selectIsDeletingNetwork);
  const isMutating = useAppSelector(selectIsMutatingNetwork);
  const error = useAppSelector(selectNetworksError);
  const mutationError = useAppSelector(selectNetworksMutationError);
  const lastFetch = useAppSelector(selectNetworksLastFetch);

  // Fetch networks
  const refresh = useCallback(() => {
    if (enabledManagedHosts.length > 0) {
      dispatch(fetchDockerNetworks(enabledManagedHosts));
    }
  }, [dispatch, enabledManagedHosts]);

  // Get networks for a specific host
  const getNetworksForHost = useCallback((hostId: string) => {
    return networksByHost[hostId] || [];
  }, [networksByHost]);

  // Create network
  const createNetwork = useCallback(async (
    hostUrl: string,
    params: NetworkCreateParams
  ) => {
    const result = await dispatch(createDockerNetwork({ hostUrl, params }));
    if (createDockerNetwork.fulfilled.match(result)) {
      // Refresh after successful creation
      refresh();
      return { success: true };
    } else {
      return { success: false, error: result.payload as string };
    }
  }, [dispatch, refresh]);

  // Create network for a managed host by ID - handles validation
  const createNetworkForHost = useCallback(async (
    hostId: string,
    params: NetworkCreateParams
  ) => {
    // Find the target host
    const targetHost = managedHosts.find(h => h.id === hostId);
    if (!targetHost) {
      return { success: false, error: 'No host selected' };
    }

    // Validate network parameters
    if (!params.name || !params.subnet || !params.gateway) {
      return { success: false, error: 'Please provide network name, subnet, and gateway' };
    }

    // Create the network
    const result = await dispatch(createDockerNetwork({ hostUrl: targetHost.url, params }));
    if (createDockerNetwork.fulfilled.match(result)) {
      // Refresh after successful creation
      refresh();
      return { success: true };
    } else {
      return { success: false, error: result.payload as string };
    }
  }, [dispatch, refresh, managedHosts]);

  // Delete network
  const deleteNetwork = useCallback(async (
    hostUrl: string,
    networkName: string
  ) => {
    const result = await dispatch(deleteDockerNetwork({ hostUrl, networkName }));
    if (deleteDockerNetwork.fulfilled.match(result)) {
      // Refresh after successful deletion
      refresh();
      return { success: true };
    } else {
      return { success: false, error: result.payload as string };
    }
  }, [dispatch, refresh]);

  // Clear errors
  const clearErrors = useCallback(() => {
    dispatch(clearError());
    dispatch(clearMutationError());
  }, [dispatch]);

  // Auto-fetch on mount
  useEffect(() => {
    if (fetchOnMount && enabledManagedHosts.length > 0) {
      refresh();
    }
  }, [fetchOnMount]); // Only run on mount

  // Polling effect
  useEffect(() => {
    if (!enablePolling || enabledManagedHosts.length === 0) return;

    const interval = setInterval(() => {
      refresh();
    }, pollInterval);

    return () => clearInterval(interval);
  }, [enablePolling, pollInterval, refresh]);

  return {
    // Data
    networksByHost,
    allNetworks,
    totalCount,
    getNetworksForHost,

    // Loading states
    isLoading,
    isCreating,
    isDeleting,
    isMutating,

    // Errors
    error,
    mutationError,

    // Metadata
    lastFetch,

    // Actions
    refresh,
    createNetwork,
    createNetworkForHost,
    deleteNetwork,
    clearErrors
  };
};
