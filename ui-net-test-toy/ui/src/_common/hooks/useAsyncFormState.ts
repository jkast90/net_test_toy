/**
 * Async Form State Hook
 * Provides common state management for forms with async operations
 * (loading, error, success patterns)
 */

import { useState, useCallback } from 'react';

export interface AsyncFormState {
  loading: boolean;
  error: string | null;
  successMessage: string | null;
}

export interface UseAsyncFormStateReturn extends AsyncFormState {
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSuccessMessage: (message: string | null) => void;
  clearMessages: () => void;
  reset: () => void;
  /**
   * Execute an async operation with automatic loading/error/success handling
   */
  execute: <T>(
    operation: () => Promise<T>,
    options?: {
      successMessage?: string;
      onSuccess?: (result: T) => void;
      onError?: (error: Error) => void;
    }
  ) => Promise<T | undefined>;
}

export const useAsyncFormState = (
  initialState?: Partial<AsyncFormState>
): UseAsyncFormStateReturn => {
  const [loading, setLoading] = useState(initialState?.loading ?? false);
  const [error, setError] = useState<string | null>(initialState?.error ?? null);
  const [successMessage, setSuccessMessage] = useState<string | null>(
    initialState?.successMessage ?? null
  );

  const clearMessages = useCallback(() => {
    setError(null);
    setSuccessMessage(null);
  }, []);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setSuccessMessage(null);
  }, []);

  const execute = useCallback(
    async <T>(
      operation: () => Promise<T>,
      options?: {
        successMessage?: string;
        onSuccess?: (result: T) => void;
        onError?: (error: Error) => void;
      }
    ): Promise<T | undefined> => {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);

      try {
        const result = await operation();
        if (options?.successMessage) {
          setSuccessMessage(options.successMessage);
        }
        options?.onSuccess?.(result);
        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);
        options?.onError?.(err instanceof Error ? err : new Error(errorMessage));
        return undefined;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    loading,
    error,
    successMessage,
    setLoading,
    setError,
    setSuccessMessage,
    clearMessages,
    reset,
    execute
  };
};
