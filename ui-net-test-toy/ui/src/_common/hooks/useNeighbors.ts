/**
 * Neighbor Hooks
 * React hooks for BGP neighbor operations
 */

import { useCallback, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchNeighbors, deleteNeighbor, clearNeighbors, clearError } from '../store/slices/neighborSlice';
import { selectNeighbors, selectNeighborsLoading, selectNeighborsError, selectNeighborsLastFetch, selectGroupedNeighbors } from '../store/neighborSelectors';
import { ClientDaemonPair, AggregatedNeighbor } from '../services/multiClientBgpApi';

/**
 * Main neighbor hook - provides access to neighbor state
 */
export const useNeighbors = () => {
  const neighbors = useAppSelector(selectNeighbors);
  const loading = useAppSelector(selectNeighborsLoading);
  const error = useAppSelector(selectNeighborsError);
  const lastFetch = useAppSelector(selectNeighborsLastFetch);

  return {
    neighbors,
    loading,
    error,
    lastFetch
  };
};

/**
 * Grouped neighbors hook - provides neighbors grouped by client and backend
 */
export const useGroupedNeighbors = (targets: ClientDaemonPair[]) => {
  const groupedNeighbors = useAppSelector((state) => selectGroupedNeighbors(state, targets));

  return groupedNeighbors;
};

/**
 * Neighbor operations hook
 */
export const useNeighborOperations = () => {
  const dispatch = useAppDispatch();

  const loadNeighbors = useCallback(
    (targets: ClientDaemonPair[]) => {
      return dispatch(fetchNeighbors(targets));
    },
    [dispatch]
  );

  const removeNeighbor = useCallback(
    (target: ClientDaemonPair, neighborIp: string) => {
      return dispatch(deleteNeighbor({ target, neighborIp }));
    },
    [dispatch]
  );

  const clear = useCallback(() => {
    dispatch(clearNeighbors());
  }, [dispatch]);

  const clearErrorMessage = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);

  return {
    loadNeighbors,
    removeNeighbor,
    clear,
    clearErrorMessage
  };
};

/**
 * Filtered neighbors hook
 */
export const useFilteredNeighbors = (filterFn?: (neighbor: AggregatedNeighbor) => boolean) => {
  const { neighbors } = useNeighbors();

  const filteredNeighbors = useMemo(() => {
    if (!filterFn) return neighbors;
    return neighbors.filter(filterFn);
  }, [neighbors, filterFn]);

  return filteredNeighbors;
};

/**
 * Sorted neighbors hook
 */
export const useSortedNeighbors = () => {
  const { neighbors } = useNeighbors();

  const sortedNeighbors = useMemo(() => {
    return [...neighbors].sort((a, b) => {
      const clientCompare = a.clientName.localeCompare(b.clientName);
      if (clientCompare !== 0) return clientCompare;
      const backendCompare = a.backend.localeCompare(b.backend);
      if (backendCompare !== 0) return backendCompare;
      return a.neighbor_ip.localeCompare(b.neighbor_ip, undefined, { numeric: true });
    });
  }, [neighbors]);

  return sortedNeighbors;
};
