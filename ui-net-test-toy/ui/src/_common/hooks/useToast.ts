/**
 * Toast Hook
 * Manages toast notifications for user feedback
 */

import { useState, useCallback } from 'react';
import type { ToastMessage } from '../components/ui/Toast';

let toastId = 0;

export interface ShowToastOptions {
  type: 'success' | 'error' | 'info' | 'warning';
  text: string;
  duration?: number;
}

export const useToast = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((options: ShowToastOptions) => {
    const id = `toast-${++toastId}`;
    const toast: ToastMessage = {
      id,
      type: options.type,
      text: options.text,
      duration: options.duration
    };

    setToasts((prev) => [...prev, toast]);
    return id;
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return {
    toasts,
    showToast,
    dismissToast,
    clearAllToasts
  };
};
