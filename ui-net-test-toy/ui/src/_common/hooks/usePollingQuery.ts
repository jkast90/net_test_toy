import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Configuration options for usePollingQuery
 */
export interface UsePollingQueryOptions<T> {
  /**
   * Polling interval in milliseconds
   * @default 5000
   */
  interval?: number;

  /**
   * Whether polling is enabled
   * @default true
   */
  enabled?: boolean;

  /**
   * Whether to fetch immediately on mount
   * @default true
   */
  fetchOnMount?: boolean;

  /**
   * Callback fired when data is successfully fetched
   */
  onSuccess?: (data: T) => void;

  /**
   * Callback fired when an error occurs
   */
  onError?: (error: Error) => void;

  /**
   * Whether to retry on error
   * @default true
   */
  retryOnError?: boolean;

  /**
   * Stale time in milliseconds - data is considered fresh during this period
   * @default 0
   */
  staleTime?: number;

  /**
   * Enable exponential backoff on errors
   * @default true
   */
  enableBackoff?: boolean;

  /**
   * Maximum backoff interval in milliseconds
   * @default 300000 (5 minutes)
   */
  maxBackoffInterval?: number;
}

/**
 * Result returned by usePollingQuery
 */
export interface UsePollingQueryResult<T> {
  /** The fetched data */
  data: T | null;

  /** Whether the query is currently loading */
  isLoading: boolean;

  /** Whether this is the first fetch */
  isInitialLoading: boolean;

  /** Error if the query failed */
  error: Error | null;

  /** Manually trigger a refetch */
  refetch: () => Promise<void>;

  /** Whether the data is stale */
  isStale: boolean;

  /** Timestamp of last successful fetch */
  lastFetchedAt: number | null;
}

/**
 * Custom hook for polling data at regular intervals
 *
 * Note: Services used with this hook should support a suppressLogs parameter
 * to reduce console noise from repeated polling operations. Set it to true
 * by default when designing services meant for polling.
 *
 * @example
 * ```typescript
 * const { data, isLoading, error, refetch } = usePollingQuery(
 *   async () => await api.getNeighbors(true), // suppressLogs = true
 *   {
 *     interval: 5000,
 *     enabled: isConnected,
 *     onSuccess: (data) => console.log('Fetched:', data)
 *   }
 * );
 * ```
 */
export function usePollingQuery<T>(
  queryFn: () => Promise<T>,
  options: UsePollingQueryOptions<T> = {}
): UsePollingQueryResult<T> {
  const {
    interval = 5000,
    enabled = true,
    fetchOnMount = true,
    onSuccess,
    onError,
    retryOnError = true,
    staleTime = 0,
    enableBackoff = true,
    maxBackoffInterval = 300000 // 5 minutes
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(fetchOnMount);
  const [error, setError] = useState<Error | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);
  const [currentInterval, setCurrentInterval] = useState(interval);

  // Use refs to avoid recreating the fetch function on every render
  const isMountedRef = useRef(true);
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);
  const queryFnRef = useRef(queryFn);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  // Update refs when callbacks change
  useEffect(() => {
    queryFnRef.current = queryFn;
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [queryFn, onSuccess, onError]);

  // Track mount status
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Calculate if data is stale
  const isStale = lastFetchedAt === null || (Date.now() - lastFetchedAt > staleTime);

  const fetchData = useCallback(async () => {
    // Don't fetch if unmounted
    if (!isMountedRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await queryFnRef.current();

      // Only update state if still mounted
      if (isMountedRef.current) {
        setData(result);
        setLastFetchedAt(Date.now());
        setIsInitialLoading(false);

        // Reset backoff on success
        if (consecutiveErrors > 0) {
          setConsecutiveErrors(0);
          setCurrentInterval(interval);
        }

        onSuccessRef.current?.(result);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error occurred');

      // Only update state if still mounted
      if (isMountedRef.current) {
        setError(error);
        setIsInitialLoading(false);
        onErrorRef.current?.(error);

        // Increment consecutive errors and apply backoff
        if (enableBackoff) {
          setConsecutiveErrors(prev => {
            const newCount = prev + 1;

            // Check if this is a 404 error (more aggressive backoff)
            const is404 = error.message.includes('404') || error.message.includes('Not Found');
            const backoffMultiplier = is404 ? Math.pow(2, newCount) : Math.pow(1.5, newCount);

            // Calculate new interval with exponential backoff
            const newInterval = Math.min(
              Math.floor(interval * backoffMultiplier),
              maxBackoffInterval
            );

            setCurrentInterval(newInterval);

            if (newCount === 1) {
              console.warn(`usePollingQuery: Error detected, backing off to ${newInterval}ms`);
            } else if (newCount > 1) {
              console.warn(`usePollingQuery: ${newCount} consecutive errors, backing off to ${newInterval}ms`);
            }

            return newCount;
          });
        }

        // Clear data on error if configured
        if (!retryOnError) {
          setData(null);
        }
      }

      console.error('usePollingQuery error:', error);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [retryOnError, consecutiveErrors, interval, enableBackoff, maxBackoffInterval]);

  // Setup polling
  useEffect(() => {
    // Clear any existing interval
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }

    // Don't start polling if disabled
    if (!enabled) {
      return;
    }

    // Fetch immediately if configured
    if (fetchOnMount || data !== null) {
      fetchData();
    }

    // Start polling with current interval (which adjusts based on errors)
    intervalIdRef.current = setInterval(fetchData, currentInterval);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    };
  }, [enabled, currentInterval, fetchData, fetchOnMount, data]);

  return {
    data,
    isLoading,
    isInitialLoading,
    error,
    refetch: fetchData,
    isStale,
    lastFetchedAt
  };
}

/**
 * Variant of usePollingQuery that accepts dependencies array
 * Useful when the query function depends on reactive values
 *
 * @example
 * ```typescript
 * const { data } = usePollingQueryWithDeps(
 *   [clientUrl, limit],
 *   () => api.getNeighbors(clientUrl, limit),
 *   { interval: 5000 }
 * );
 * ```
 */
export function usePollingQueryWithDeps<T>(
  deps: React.DependencyList,
  queryFn: () => Promise<T>,
  options: UsePollingQueryOptions<T> = {}
): UsePollingQueryResult<T> {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoizedQueryFn = useCallback(queryFn, deps);
  return usePollingQuery(memoizedQueryFn, options);
}
