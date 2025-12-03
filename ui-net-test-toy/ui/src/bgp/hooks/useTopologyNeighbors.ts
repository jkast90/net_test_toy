/**
 * Topology Neighbors Hook
 * Manages loading and refreshing neighbor data for BGP session status
 */

import { useEffect, useCallback } from 'react';
import { useNeighborOperations, useNeighbors } from '../../_common/hooks/useNeighbors';

export interface UseTopologyNeighborsOptions {
  containerManagerUrl: string;
  daemons: any[] | undefined;
}

export const useTopologyNeighbors = (options: UseTopologyNeighborsOptions) => {
  const { containerManagerUrl, daemons } = options;
  const { loadNeighbors } = useNeighborOperations();
  const { neighbors, loading, error } = useNeighbors();

  // Build targets from running daemons
  const buildTargets = useCallback(() => {
    if (!daemons || daemons.length === 0 || !containerManagerUrl) {
      return [];
    }

    const runningDaemons = daemons.filter((d: any) => d.status === 'running');

    return runningDaemons.map((d: any) => {
      // Use container manager proxy: /proxy/{daemon_name}/...
      const proxyUrl = `${containerManagerUrl}/proxy/${d.name}`;

      return {
        client: {
          id: d.name,
          name: d.name,
          baseUrl: proxyUrl,
          daemons: [],
          pollInterval: 5,
          enabled: true,
          status: 'connected' as const,
          isLocal: true
        },
        daemon: {
          type: d.type || 'gobgp',
          enabled: true
        }
      };
    });
  }, [daemons, containerManagerUrl]);

  // Load neighbors when daemons change (one-time per daemon list change)
  // Polling disabled to avoid connection exhaustion
  useEffect(() => {
    const targets = buildTargets();

    if (targets.length > 0) {
      console.log('[useTopologyNeighbors] Loading neighbors for', targets.length, 'targets');
      loadNeighbors(targets);
    }
    // Note: Polling removed to prevent connection exhaustion when daemon APIs are slow/unresponsive
    // If you need fresh neighbor data, call loadNeighbors() manually
  }, [buildTargets, loadNeighbors]);

  return {
    neighbors,
    isLoading: loading,
    error,
    loadNeighbors
  };
};
