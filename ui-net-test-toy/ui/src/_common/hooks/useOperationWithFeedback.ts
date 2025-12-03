/**
 * Hook for wrapping async operations with success/error feedback
 * Eliminates repetitive try-catch boilerplate in components
 */

import { useCallback, useState } from 'react';

export interface OperationFeedback {
  type: 'success' | 'error';
  text: string;
}

export interface UseOperationWithFeedbackResult {
  /**
   * Current feedback message (null if none)
   */
  feedback: OperationFeedback | null;

  /**
   * Set feedback manually
   */
  setFeedback: (feedback: OperationFeedback | null) => void;

  /**
   * Clear current feedback
   */
  clearFeedback: () => void;

  /**
   * Wrap an async operation with automatic feedback handling
   */
  wrapOperation: <TArgs extends any[], TResult>(
    operation: (...args: TArgs) => Promise<TResult>,
    options?: {
      successMessage?: string | ((result: TResult) => string);
      errorMessage?: string | ((error: Error) => string);
      onSuccess?: (result: TResult) => void;
      onError?: (error: Error) => void;
    }
  ) => (...args: TArgs) => Promise<TResult | undefined>;
}

/**
 * Hook for handling async operations with automatic success/error feedback
 */
export const useOperationWithFeedback = (): UseOperationWithFeedbackResult => {
  const [feedback, setFeedback] = useState<OperationFeedback | null>(null);

  const clearFeedback = useCallback(() => {
    setFeedback(null);
  }, []);

  const wrapOperation = useCallback(<TArgs extends any[], TResult>(
    operation: (...args: TArgs) => Promise<TResult>,
    options: {
      successMessage?: string | ((result: TResult) => string);
      errorMessage?: string | ((error: Error) => string);
      onSuccess?: (result: TResult) => void;
      onError?: (error: Error) => void;
    } = {}
  ) => {
    return async (...args: TArgs): Promise<TResult | undefined> => {
      try {
        const result = await operation(...args);

        // Set success message if provided
        if (options.successMessage) {
          const message = typeof options.successMessage === 'function'
            ? options.successMessage(result)
            : options.successMessage;
          setFeedback({ type: 'success', text: message });
        }

        // Call success callback if provided
        if (options.onSuccess) {
          options.onSuccess(result);
        }

        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');

        // Set error message
        const message = options.errorMessage
          ? (typeof options.errorMessage === 'function'
              ? options.errorMessage(err)
              : options.errorMessage)
          : `Operation failed: ${err.message}`;

        setFeedback({ type: 'error', text: message });

        // Call error callback if provided
        if (options.onError) {
          options.onError(err);
        }

        // Don't re-throw - let caller decide
        return undefined;
      }
    };
  }, []);

  return {
    feedback,
    setFeedback,
    clearFeedback,
    wrapOperation
  };
};
