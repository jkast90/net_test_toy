import { useState, useCallback, useRef } from 'react';

/**
 * Options for useAsyncMutation
 */
export interface UseAsyncMutationOptions<TArgs, TResult> {
  /**
   * Callback fired when mutation succeeds
   */
  onSuccess?: (result: TResult, args: TArgs) => void | Promise<void>;

  /**
   * Callback fired when mutation fails
   */
  onError?: (error: Error, args: TArgs) => void;

  /**
   * Callback fired when mutation is settled (success or error)
   */
  onSettled?: (result: TResult | null, error: Error | null, args: TArgs) => void;

  /**
   * Success message to display (if using notification system)
   */
  successMessage?: string | ((result: TResult, args: TArgs) => string);

  /**
   * Error message to display (if using notification system)
   */
  errorMessage?: string | ((error: Error, args: TArgs) => string);

  /**
   * Whether to throw errors instead of catching them
   * @default false
   */
  throwOnError?: boolean;

  /**
   * Whether to reset state after successful mutation
   * @default false
   */
  resetOnSuccess?: boolean;

  /**
   * Debounce delay in milliseconds
   * @default 0
   */
  debounce?: number;
}

/**
 * Result returned by useAsyncMutation
 */
export interface UseAsyncMutationResult<TArgs, TResult> {
  /** Execute the mutation */
  mutate: (args: TArgs) => Promise<TResult | null>;

  /** Execute the mutation asynchronously (doesn't throw) */
  mutateAsync: (args: TArgs) => Promise<TResult | null>;

  /** Whether the mutation is currently loading */
  isLoading: boolean;

  /** Whether the mutation has succeeded */
  isSuccess: boolean;

  /** Whether the mutation has failed */
  isError: boolean;

  /** Error if the mutation failed */
  error: Error | null;

  /** Result data from the last successful mutation */
  data: TResult | null;

  /** Reset the mutation state */
  reset: () => void;

  /** The loading state can be manually set if needed */
  setIsLoading: (loading: boolean) => void;
}

/**
 * Custom hook for handling async mutations with loading and error states
 *
 * Standardizes try-catch-finally patterns for async operations
 *
 * @example
 * ```typescript
 * // Basic usage
 * const createNeighbor = useAsyncMutation(
 *   (data: NeighborData) => api.createNeighbor(data),
 *   {
 *     onSuccess: () => {
 *       notifications.success('Neighbor created!');
 *       refetch();
 *     },
 *     onError: (error) => {
 *       notifications.error(`Failed: ${error.message}`);
 *     }
 *   }
 * );
 *
 * // In component
 * <button
 *   onClick={() => createNeighbor.mutate(formData)}
 *   disabled={createNeighbor.isLoading}
 * >
 *   {createNeighbor.isLoading ? 'Creating...' : 'Create'}
 * </button>
 *
 * {createNeighbor.error && (
 *   <Alert type="error">{createNeighbor.error.message}</Alert>
 * )}
 * ```
 */
export function useAsyncMutation<TArgs = void, TResult = unknown>(
  mutationFn: (args: TArgs) => Promise<TResult>,
  options: UseAsyncMutationOptions<TArgs, TResult> = {}
): UseAsyncMutationResult<TArgs, TResult> {
  const {
    onSuccess,
    onError,
    onSettled,
    throwOnError = false,
    resetOnSuccess = false,
    debounce = 0
  } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<TResult | null>(null);

  // Use refs to avoid recreating the mutation function
  const mutationFnRef = useRef(mutationFn);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const onSettledRef = useRef(onSettled);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Update refs when callbacks change
  mutationFnRef.current = mutationFn;
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;
  onSettledRef.current = onSettled;

  const reset = useCallback(() => {
    setIsLoading(false);
    setIsSuccess(false);
    setIsError(false);
    setError(null);
    setData(null);
  }, []);

  const executeMutation = useCallback(async (args: TArgs): Promise<TResult | null> => {
    setIsLoading(true);
    setIsSuccess(false);
    setIsError(false);
    setError(null);

    try {
      const result = await mutationFnRef.current(args);

      setData(result);
      setIsSuccess(true);

      // Call onSuccess callback
      await onSuccessRef.current?.(result, args);

      // Call onSettled callback
      onSettledRef.current?.(result, null, args);

      // Reset state if configured
      if (resetOnSuccess) {
        setTimeout(reset, 0);
      }

      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error occurred');

      setError(error);
      setIsError(true);

      // Call onError callback
      onErrorRef.current?.(error, args);

      // Call onSettled callback
      onSettledRef.current?.(null, error, args);

      // Throw error if configured
      if (throwOnError) {
        throw error;
      }

      return null;
    } finally {
      setIsLoading(false);
    }
  }, [throwOnError, resetOnSuccess, reset]);

  const mutateAsync = useCallback(
    async (args: TArgs): Promise<TResult | null> => {
      if (debounce > 0) {
        // Clear existing debounce timer
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }

        // Create new promise that resolves after debounce
        return new Promise((resolve) => {
          debounceTimerRef.current = setTimeout(async () => {
            const result = await executeMutation(args);
            resolve(result);
          }, debounce);
        });
      }

      return executeMutation(args);
    },
    [debounce, executeMutation]
  );

  // Alias for mutateAsync that throws errors
  const mutate = useCallback(
    async (args: TArgs): Promise<TResult | null> => {
      return mutateAsync(args);
    },
    [mutateAsync]
  );

  return {
    mutate,
    mutateAsync,
    isLoading,
    isSuccess,
    isError,
    error,
    data,
    reset,
    setIsLoading
  };
}

/**
 * Variant that doesn't require arguments
 *
 * @example
 * ```typescript
 * const logout = useSimpleAsyncMutation(
 *   () => api.logout(),
 *   { onSuccess: () => navigate('/login') }
 * );
 *
 * <button onClick={() => logout.mutate()}>Logout</button>
 * ```
 */
export function useSimpleAsyncMutation<TResult = unknown>(
  mutationFn: () => Promise<TResult>,
  options: Omit<UseAsyncMutationOptions<void, TResult>, 'onSuccess' | 'onError'> & {
    onSuccess?: (result: TResult) => void | Promise<void>;
    onError?: (error: Error) => void;
  } = {}
): Omit<UseAsyncMutationResult<void, TResult>, 'mutate' | 'mutateAsync'> & {
  mutate: () => Promise<TResult | null>;
  mutateAsync: () => Promise<TResult | null>;
} {
  const { onSuccess, onError, ...restOptions } = options;

  const mutation = useAsyncMutation<void, TResult>(
    mutationFn,
    {
      ...restOptions,
      onSuccess: onSuccess ? (result) => onSuccess(result) : undefined,
      onError: onError ? (error) => onError(error) : undefined
    }
  );

  return {
    ...mutation,
    mutate: () => mutation.mutate(undefined as void),
    mutateAsync: () => mutation.mutateAsync(undefined as void)
  };
}

/**
 * Hook for multiple mutations with shared loading state
 *
 * Useful when you have create/update/delete operations that should
 * share a single loading indicator
 *
 * @example
 * ```typescript
 * const operations = useMultiMutation({
 *   create: (data) => api.create(data),
 *   update: (data) => api.update(data),
 *   delete: (id) => api.delete(id)
 * }, {
 *   onSuccess: () => refetch()
 * });
 *
 * operations.create.mutate(newData);
 * operations.update.mutate(updatedData);
 * operations.delete.mutate(itemId);
 *
 * // Shared loading state
 * if (operations.isAnyLoading) { ... }
 * ```
 */
export function useMultiMutation<
  TMutations extends Record<string, (args: any) => Promise<any>>
>(
  mutations: TMutations,
  sharedOptions: Partial<UseAsyncMutationOptions<any, any>> = {}
): {
  [K in keyof TMutations]: UseAsyncMutationResult<
    Parameters<TMutations[K]>[0],
    Awaited<ReturnType<TMutations[K]>>
  >;
} & {
  isAnyLoading: boolean;
  hasAnyError: boolean;
  reset: () => void;
} {
  const mutationHooks = {} as any;
  let isAnyLoading = false;
  let hasAnyError = false;

  // Create mutation hook for each operation
  Object.entries(mutations).forEach(([key, mutationFn]) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    mutationHooks[key] = useAsyncMutation(mutationFn as any, sharedOptions);

    if (mutationHooks[key].isLoading) isAnyLoading = true;
    if (mutationHooks[key].isError) hasAnyError = true;
  });

  const resetAll = useCallback(() => {
    Object.values(mutationHooks).forEach((hook: any) => {
      hook.reset();
    });
  }, [mutationHooks]);

  return {
    ...mutationHooks,
    isAnyLoading,
    hasAnyError,
    reset: resetAll
  };
}
