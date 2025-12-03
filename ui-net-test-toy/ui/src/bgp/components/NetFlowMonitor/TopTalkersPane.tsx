/**
 * Top Talkers and Conversations Panes
 */

import React, { useState, useEffect } from 'react';
import { DataTablePane } from '../../../_common/components';
import { talkerColumns, conversationColumns, type TopTalker, type Conversation } from '../../pages/NetFlowMonitor.columns';

const TALKERS_LIMIT_STORAGE_KEY = 'netflow-top-talkers-limit';
const CONVERSATIONS_LIMIT_STORAGE_KEY = 'netflow-top-conversations-limit';
const DEFAULT_LIMIT = 10;

// Top Talkers Pane
interface TopTalkersPaneProps {
  topTalkers: TopTalker[];
  isLoading: boolean;
  onLimitChange?: (limit: number) => void;
}

export const TopTalkersPane: React.FC<TopTalkersPaneProps> = ({
  topTalkers,
  isLoading,
  onLimitChange
}) => {
  const [limit, setLimit] = useState<number>(() => {
    const stored = localStorage.getItem(TALKERS_LIMIT_STORAGE_KEY);
    return stored ? parseInt(stored, 10) : DEFAULT_LIMIT;
  });

  useEffect(() => {
    localStorage.setItem(TALKERS_LIMIT_STORAGE_KEY, limit.toString());
    onLimitChange?.(limit);
  }, [limit, onLimitChange]);

  const handleLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value > 0 && value <= 100) {
      setLimit(value);
    }
  };

  const limitControl = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <label htmlFor="talkers-limit" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        Show:
      </label>
      <input
        id="talkers-limit"
        type="number"
        min="1"
        max="100"
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
      title="Top Talkers"
      actions={limitControl}
      data={topTalkers}
      columns={talkerColumns}
      loading={isLoading}
      emptyMessage="No traffic data available"
    />
  );
};

// Top Conversations Pane
interface TopConversationsPaneProps {
  topConversations: Conversation[];
  isLoading: boolean;
  onLimitChange?: (limit: number) => void;
}

export const TopConversationsPane: React.FC<TopConversationsPaneProps> = ({
  topConversations,
  isLoading,
  onLimitChange
}) => {
  const [limit, setLimit] = useState<number>(() => {
    const stored = localStorage.getItem(CONVERSATIONS_LIMIT_STORAGE_KEY);
    return stored ? parseInt(stored, 10) : DEFAULT_LIMIT;
  });

  useEffect(() => {
    localStorage.setItem(CONVERSATIONS_LIMIT_STORAGE_KEY, limit.toString());
    onLimitChange?.(limit);
  }, [limit, onLimitChange]);

  const handleLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value > 0 && value <= 100) {
      setLimit(value);
    }
  };

  const limitControl = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <label htmlFor="conversations-limit" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        Show:
      </label>
      <input
        id="conversations-limit"
        type="number"
        min="1"
        max="100"
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
      title="Top Conversations"
      actions={limitControl}
      data={topConversations}
      columns={conversationColumns}
      loading={isLoading}
      emptyMessage="No conversations detected"
    />
  );
};

// Export hooks for other components to use the persisted limits
export const useTopTalkersLimit = () => {
  const [limit, setLimit] = useState<number>(() => {
    const stored = localStorage.getItem(TALKERS_LIMIT_STORAGE_KEY);
    return stored ? parseInt(stored, 10) : DEFAULT_LIMIT;
  });

  useEffect(() => {
    const handleStorageChange = () => {
      const stored = localStorage.getItem(TALKERS_LIMIT_STORAGE_KEY);
      if (stored) {
        setLimit(parseInt(stored, 10));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return limit;
};

export const useTopConversationsLimit = () => {
  const [limit, setLimit] = useState<number>(() => {
    const stored = localStorage.getItem(CONVERSATIONS_LIMIT_STORAGE_KEY);
    return stored ? parseInt(stored, 10) : DEFAULT_LIMIT;
  });

  useEffect(() => {
    const handleStorageChange = () => {
      const stored = localStorage.getItem(CONVERSATIONS_LIMIT_STORAGE_KEY);
      if (stored) {
        setLimit(parseInt(stored, 10));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return limit;
};
