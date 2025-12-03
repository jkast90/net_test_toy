import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { syncLocalDaemons } from '../store/connectionSlice';
import { selectEnabledManagedHosts } from '../store/labManagerSelectors';
import { labManagerService } from '../services/labManager/labManagerService';

/**
 * Hook to auto-discover local daemons from Lab Manager API(s)
 * Polls every 10 seconds to keep the client list in sync with running daemons
 * Fetches from ALL enabled Lab Manager hosts configured in Connection Manager
 */
export function useLocalDaemonDiscovery() {
  const dispatch = useAppDispatch();
  const enabledHosts = useAppSelector(selectEnabledManagedHosts);

  useEffect(() => {
    const syncDaemons = async () => {
      try {
        if (enabledHosts.length === 0) {
          console.log('[useLocalDaemonDiscovery] No enabled Lab Manager hosts found');
          dispatch(syncLocalDaemons([]));
          return;
        }

        // console.log(`[useLocalDaemonDiscovery] Fetching daemons from ${enabledHosts.length} Lab Manager host(s)`);

        // Use Lab Manager service to fetch daemons from all enabled hosts
        const results = await labManagerService.getLabDataFromHosts(enabledHosts);

        // Combine all daemons from successful results
        const allDaemons = results
          .filter(result => result.status === 'connected')
          .flatMap(result => result.daemons);

        // console.log('[useLocalDaemonDiscovery] Total daemons discovered:', allDaemons.length);
        dispatch(syncLocalDaemons(allDaemons));

      } catch (err) {
        console.error('[useLocalDaemonDiscovery] Error syncing daemons:', err);
        dispatch(syncLocalDaemons([]));
      }
    };

    // Initial sync on mount
    syncDaemons();

    // Re-sync every 10 seconds
    const interval = setInterval(syncDaemons, 10000);

    return () => clearInterval(interval);
  }, [dispatch, enabledHosts]);
}
