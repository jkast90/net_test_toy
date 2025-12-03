/**
 * Routes Hook
 * Hook for fetching and managing BGP routes
 */

import { useState, useCallback, useEffect } from 'react';
import { fetchAggregatedRoutes, type AggregatedRoute, type ClientDaemonPair } from '../services/multiClientBgpApi';

/**
 * Hook for fetching BGP routes
 */
export const useRoutes = (targets: ClientDaemonPair[], autoFetch: boolean = true) => {
  const [routes, setRoutes] = useState<AggregatedRoute[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRoutes = useCallback(async () => {
    if (targets.length === 0) {
      setRoutes([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await fetchAggregatedRoutes(targets);
      setRoutes(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch routes');
      setRoutes([]);
    } finally {
      setLoading(false);
    }
  }, [targets]);

  // Auto-fetch on mount and when targets change
  useEffect(() => {
    if (autoFetch) {
      fetchRoutes();
    }
  }, [fetchRoutes, autoFetch]);

  return {
    routes,
    loading,
    error,
    fetchRoutes,
    refetch: fetchRoutes
  };
};
