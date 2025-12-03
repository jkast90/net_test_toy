/**
 * Alert Hook
 * Provides a clean API for managing success/error/info alerts in pages
 */

import { useState, useCallback } from 'react';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

export interface AlertState {
  type: AlertType;
  message: string;
}

export const useAlert = () => {
  const [alert, setAlert] = useState<AlertState | null>(null);

  const showAlert = useCallback((type: AlertType, message: string) => {
    setAlert({ type, message });
  }, []);

  const showSuccess = useCallback((message: string) => {
    setAlert({ type: 'success', message });
  }, []);

  const showError = useCallback((message: string) => {
    setAlert({ type: 'error', message });
  }, []);

  const showWarning = useCallback((message: string) => {
    setAlert({ type: 'warning', message });
  }, []);

  const showInfo = useCallback((message: string) => {
    setAlert({ type: 'info', message });
  }, []);

  const clearAlert = useCallback(() => {
    setAlert(null);
  }, []);

  return {
    alert,
    showAlert,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    clearAlert
  };
};
