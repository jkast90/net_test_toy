/**
 * Clipboard Hook
 * Provides copy-to-clipboard functionality with success/error feedback
 */

import { useState, useCallback } from 'react';

export interface UseClipboardOptions {
  /** Duration in ms to show success state (default: 2000) */
  successDuration?: number;
  /** Callback when copy succeeds */
  onSuccess?: (text: string) => void;
  /** Callback when copy fails */
  onError?: (error: Error) => void;
}

export interface UseClipboardReturn {
  /** Whether a copy operation is in progress */
  copying: boolean;
  /** Whether the last copy was successful (resets after successDuration) */
  copied: boolean;
  /** Error from the last copy operation */
  error: string | null;
  /** Copy text to clipboard */
  copy: (text: string) => Promise<boolean>;
  /** Copy an object as JSON to clipboard */
  copyJSON: (obj: unknown, indent?: number) => Promise<boolean>;
  /** Reset state */
  reset: () => void;
}

export const useClipboard = (options?: UseClipboardOptions): UseClipboardReturn => {
  const { successDuration = 2000, onSuccess, onError } = options ?? {};

  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setCopying(false);
    setCopied(false);
    setError(null);
  }, []);

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      setCopying(true);
      setError(null);
      setCopied(false);

      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        onSuccess?.(text);

        // Reset copied state after duration
        if (successDuration > 0) {
          setTimeout(() => {
            setCopied(false);
          }, successDuration);
        }

        return true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to copy to clipboard';
        setError(errorMessage);
        onError?.(err instanceof Error ? err : new Error(errorMessage));
        return false;
      } finally {
        setCopying(false);
      }
    },
    [successDuration, onSuccess, onError]
  );

  const copyJSON = useCallback(
    async (obj: unknown, indent = 2): Promise<boolean> => {
      try {
        const jsonString = JSON.stringify(obj, null, indent);
        return await copy(jsonString);
      } catch (err) {
        const errorMessage = 'Failed to serialize object to JSON';
        setError(errorMessage);
        onError?.(new Error(errorMessage));
        return false;
      }
    },
    [copy, onError]
  );

  return {
    copying,
    copied,
    error,
    copy,
    copyJSON,
    reset
  };
};
