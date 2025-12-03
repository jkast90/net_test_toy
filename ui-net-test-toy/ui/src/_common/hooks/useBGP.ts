/**
 * BGP React Hook
 * Custom hook for BGP operations (neighbors, routes) across multiple clients
 */

import { useState, useCallback } from 'react';
import { useAppSelector } from '../store/hooks';
import { selectAllEnabledDaemons } from '../store/connectionSelectors';
import {
  fetchAggregatedNeighbors,
  fetchAggregatedRoutes,
  type AggregatedNeighbor,
  type AggregatedRoute
} from '../services/multiClientBgpApi';

export const useBGP = () => {
  const enabledDaemons = useAppSelector(selectAllEnabledDaemons);

  // State
  const [neighbors, setNeighbors] = useState<AggregatedNeighbor[]>([]);
  const [routes, setRoutes] = useState<AggregatedRoute[]>([]);
  const [isLoadingNeighbors, setIsLoadingNeighbors] = useState(false);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);
  const [neighborsError, setNeighborsError] = useState<string | null>(null);
  const [routesError, setRoutesError] = useState<string | null>(null);

  // Fetch neighbors from all enabled BGP daemons
  const loadNeighbors = useCallback(async () => {
    if (enabledDaemons.length === 0) {
      setNeighbors([]);
      return { success: true, data: [] };
    }

    setIsLoadingNeighbors(true);
    setNeighborsError(null);

    try {
      const data = await fetchAggregatedNeighbors(enabledDaemons);
      setNeighbors(data);
      return { success: true, data };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch neighbors';
      setNeighborsError(errorMessage);
      setNeighbors([]);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoadingNeighbors(false);
    }
  }, [enabledDaemons]);

  // Fetch routes from all enabled BGP daemons
  const loadRoutes = useCallback(async () => {
    if (enabledDaemons.length === 0) {
      setRoutes([]);
      return { success: true, data: [] };
    }

    setIsLoadingRoutes(true);
    setRoutesError(null);

    try {
      const data = await fetchAggregatedRoutes(enabledDaemons);
      setRoutes(data);
      return { success: true, data };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch routes';
      setRoutesError(errorMessage);
      setRoutes([]);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoadingRoutes(false);
    }
  }, [enabledDaemons]);

  // Clear errors
  const clearNeighborsError = useCallback(() => {
    setNeighborsError(null);
  }, []);

  const clearRoutesError = useCallback(() => {
    setRoutesError(null);
  }, []);

  const clearAllErrors = useCallback(() => {
    setNeighborsError(null);
    setRoutesError(null);
  }, []);

  return {
    // State
    neighbors,
    routes,
    isLoadingNeighbors,
    isLoadingRoutes,
    isLoading: isLoadingNeighbors || isLoadingRoutes,
    neighborsError,
    routesError,

    // Actions
    loadNeighbors,
    loadRoutes,
    clearNeighborsError,
    clearRoutesError,
    clearAllErrors
  };
};
