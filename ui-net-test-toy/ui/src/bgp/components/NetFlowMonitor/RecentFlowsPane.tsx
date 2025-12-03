/**
 * Recent Flows Pane
 */

import React, { useState, useEffect } from 'react';
import { DataTablePane } from '../../../_common/components';
import { flowColumns, type Flow } from '../../pages/NetFlowMonitor.columns';

const FLOWS_LIMIT_STORAGE_KEY = 'netflow-recent-flows-limit';
const DEFAULT_FLOWS_LIMIT = 100;

interface RecentFlowsPaneProps {
  flows: Flow[];
  isLoading: boolean;
  dataFreshness: string;
  onLimitChange?: (limit: number) => void;
}

export const RecentFlowsPane: React.FC<RecentFlowsPaneProps> = ({
  flows,
  isLoading,
  dataFreshness,
  onLimitChange
}) => {
  const [limit, setLimit] = useState<number>(() => {
    const stored = localStorage.getItem(FLOWS_LIMIT_STORAGE_KEY);
    return stored ? parseInt(stored, 10) : DEFAULT_FLOWS_LIMIT;
  });

  useEffect(() => {
    localStorage.setItem(FLOWS_LIMIT_STORAGE_KEY, limit.toString());
    onLimitChange?.(limit);
  }, [limit, onLimitChange]);

  const handleLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value > 0 && value <= 500) {
      setLimit(value);
    }
  };

  const limitControl = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <label htmlFor="flows-limit" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        Show:
      </label>
      <input
        id="flows-limit"
        type="number"
        min="1"
        max="500"
        value={limit}
        onChange={handleLimitChange}
        style={{
          width: '60px',
          padding: '0.25rem 0.5rem',
          borderRadius: '4px',
          border: '1px solid var(--border)',
          backgroundColor: 'var(--background-primary)',
          color: 'var(--text)',
          fontSize: '0.85rem'
        }}
      />
    </div>
  );

  return (
    <DataTablePane
      title="Recent Flows"
      actions={limitControl}
      data={flows}
      columns={flowColumns}
      loading={isLoading}
      emptyMessage="No flows captured yet"
    />
  );
};

// Export hook for other components to use the persisted limit
export const useRecentFlowsLimit = () => {
  const [limit, setLimit] = useState<number>(() => {
    const stored = localStorage.getItem(FLOWS_LIMIT_STORAGE_KEY);
    return stored ? parseInt(stored, 10) : DEFAULT_FLOWS_LIMIT;
  });

  useEffect(() => {
    const handleStorageChange = () => {
      const stored = localStorage.getItem(FLOWS_LIMIT_STORAGE_KEY);
      if (stored) {
        setLimit(parseInt(stored, 10));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return limit;
};
