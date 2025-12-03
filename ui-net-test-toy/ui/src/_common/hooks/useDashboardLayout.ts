/**
 * Dashboard Layout Hook
 * Manages shared state for DashboardBuilder layouts with localStorage persistence
 */

import { useState, useEffect, useCallback } from 'react';

export interface UseDashboardLayoutOptions {
  storageKey: string;
  defaultPanes?: string[];
  defaultColumns?: number;
}

export interface DashboardLayoutState {
  selectedPanes: string[];
  paneOrder: string[];
  previewColumns: number;
  setSelectedPanes: (panes: string[]) => void;
  setPaneOrder: (order: string[]) => void;
  setPreviewColumns: (columns: number) => void;
  resetLayout: () => void;
}

export const useDashboardLayout = (options: UseDashboardLayoutOptions): DashboardLayoutState => {
  const { storageKey, defaultPanes = [], defaultColumns = 3 } = options;

  // Selected panes with localStorage persistence
  const [selectedPanes, setSelectedPanesState] = useState<string[]>(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : defaultPanes;
  });

  // Pane order with localStorage persistence
  const [paneOrder, setPaneOrderState] = useState<string[]>(() => {
    const saved = localStorage.getItem(`${storageKey}-order`);
    return saved ? JSON.parse(saved) : [];
  });

  // Preview columns with localStorage persistence
  const [previewColumns, setPreviewColumnsState] = useState<number>(() => {
    const saved = localStorage.getItem(`${storageKey}-columns`);
    return saved ? parseInt(saved, 10) : defaultColumns;
  });

  // Persist selectedPanes changes
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(selectedPanes));
  }, [storageKey, selectedPanes]);

  // Persist paneOrder changes
  useEffect(() => {
    localStorage.setItem(`${storageKey}-order`, JSON.stringify(paneOrder));
  }, [storageKey, paneOrder]);

  // Persist previewColumns changes
  useEffect(() => {
    localStorage.setItem(`${storageKey}-columns`, previewColumns.toString());
  }, [storageKey, previewColumns]);

  // Wrapped setters that also handle persistence
  const setSelectedPanes = useCallback((panes: string[]) => {
    setSelectedPanesState(panes);
  }, []);

  const setPaneOrder = useCallback((order: string[]) => {
    setPaneOrderState(order);
  }, []);

  const setPreviewColumns = useCallback((columns: number) => {
    setPreviewColumnsState(columns);
  }, []);

  // Reset to defaults
  const resetLayout = useCallback(() => {
    setSelectedPanesState(defaultPanes);
    setPaneOrderState([]);
    setPreviewColumnsState(defaultColumns);
  }, [defaultPanes, defaultColumns]);

  return {
    selectedPanes,
    paneOrder,
    previewColumns,
    setSelectedPanes,
    setPaneOrder,
    setPreviewColumns,
    resetLayout
  };
};
