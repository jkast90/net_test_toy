import { useCallback, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  fetchTopologies,
  fetchTopologyDetails,
  createTopology,
  activateTopology,
  deleteTopology,
  setCurrentHostUrl,
  selectTopology,
  clearError,
  clearSuccessMessage,
  resetTopologyState
} from '../store/topologyManagerSlice';
import {
  selectTopologies,
  selectActiveTopology,
  selectSelectedTopology,
  selectTopologyDetails,
  selectCurrentHostUrl,
  selectIsLoadingTopologies,
  selectIsLoadingDetails,
  selectIsActivating,
  selectTopologyError,
  selectDetailsError,
  selectSuccessMessage,
  selectTopologyDetailsSummary,
  selectTopologyManagerUIState
} from '../store/topologyManagerSelectors';

export interface UseTopologyManagerOptions {
  hostUrl: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export const useTopologyManager = (options: UseTopologyManagerOptions) => {
  const dispatch = useAppDispatch();

  const {
    hostUrl,
    autoRefresh = false,
    refreshInterval = 30000
  } = options;

  // Selectors
  const topologies = useAppSelector(selectTopologies);
  const activeTopology = useAppSelector(selectActiveTopology);
  const selectedTopologyName = useAppSelector(selectSelectedTopology);
  const topologyDetails = useAppSelector(selectTopologyDetails);
  const currentHostUrl = useAppSelector(selectCurrentHostUrl);
  const isLoadingTopologies = useAppSelector(selectIsLoadingTopologies);
  const isLoadingDetails = useAppSelector(selectIsLoadingDetails);
  const isActivating = useAppSelector(selectIsActivating);
  const error = useAppSelector(selectTopologyError);
  const detailsError = useAppSelector(selectDetailsError);
  const successMessage = useAppSelector(selectSuccessMessage);
  const detailsSummary = useAppSelector(selectTopologyDetailsSummary);
  const uiState = useAppSelector(selectTopologyManagerUIState);

  // Set host URL on mount or when it changes
  useEffect(() => {
    if (hostUrl !== currentHostUrl) {
      dispatch(setCurrentHostUrl(hostUrl));
    }
  }, [dispatch, hostUrl, currentHostUrl]);

  // Load topologies
  const loadTopologies = useCallback((suppressLogs = false) => {
    return dispatch(fetchTopologies({ hostUrl, suppressLogs }));
  }, [dispatch, hostUrl]);

  // Load topology details
  const loadTopologyDetails = useCallback((name: string, suppressLogs = false) => {
    dispatch(selectTopology(name));
    return dispatch(fetchTopologyDetails({ hostUrl, name, suppressLogs }));
  }, [dispatch, hostUrl]);

  // Create a new topology
  const createNewTopology = useCallback((name: string, description: string = '', managementNetwork?: string) => {
    return dispatch(createTopology({ hostUrl, name, description, managementNetwork }));
  }, [dispatch, hostUrl]);

  // Activate a topology
  const activateTopologyByName = useCallback((name: string) => {
    return dispatch(activateTopology({ hostUrl, name }));
  }, [dispatch, hostUrl]);

  // Delete a topology
  const deleteTopologyByName = useCallback((name: string) => {
    return dispatch(deleteTopology({ hostUrl, name }));
  }, [dispatch, hostUrl]);

  // Clear selected topology
  const clearSelectedTopology = useCallback(() => {
    dispatch(selectTopology(null));
  }, [dispatch]);

  // Clear errors
  const clearErrors = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);

  // Clear success message
  const clearSuccess = useCallback(() => {
    dispatch(clearSuccessMessage());
  }, [dispatch]);

  // Reset all state
  const resetState = useCallback(() => {
    dispatch(resetTopologyState());
  }, [dispatch]);

  // Initial load
  useEffect(() => {
    loadTopologies();
  }, [loadTopologies]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadTopologies(true); // Suppress logs for polling
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, loadTopologies]);

  // Auto-clear messages after 5 seconds
  useEffect(() => {
    if (error || detailsError || successMessage) {
      const timer = setTimeout(() => {
        if (error || detailsError) clearErrors();
        if (successMessage) clearSuccess();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, detailsError, successMessage, clearErrors, clearSuccess]);

  return {
    // State
    topologies,
    activeTopology,
    selectedTopologyName,
    topologyDetails,
    detailsSummary,

    // Loading states
    isLoadingTopologies,
    isLoadingDetails,
    isActivating,
    isLoading: uiState.isLoading,

    // Error states
    error,
    detailsError,
    hasError: uiState.hasError,
    errorMessage: uiState.errorMessage,

    // Success message
    successMessage,

    // Actions
    loadTopologies,
    loadTopologyDetails,
    createTopology: createNewTopology,
    activateTopology: activateTopologyByName,
    deleteTopology: deleteTopologyByName,
    clearSelectedTopology,
    clearErrors,
    clearSuccess,
    resetState,

    // Helper data
    currentHostUrl
  };
};