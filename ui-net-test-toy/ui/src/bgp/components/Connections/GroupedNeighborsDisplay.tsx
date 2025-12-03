/**
 * Grouped Neighbors Display Component
 * Displays BGP neighbors grouped by client and backend, each in its own pane
 */

import React, { useState, useCallback } from 'react';
import { DashboardPane, EmptyState } from '../../../_common/components';
import { AggregatedNeighbor, ClientDaemonPair } from '../../../_common/services/multiClientBgpApi';
import NeighborCard from './NeighborCard';
import styles from '../../pages/SharedBGPPages.module.css';

interface NeighborGroup {
  clientName: string;
  backend: string;
  neighbors: AggregatedNeighbor[];
}

interface GroupedNeighborsDisplayProps {
  groupedNeighbors: Record<string, NeighborGroup>;
  loading: boolean;
  targets: ClientDaemonPair[];
  onEditNeighbor: (neighbor: AggregatedNeighbor, target: ClientDaemonPair) => void;
  onDeleteNeighbor: (neighbor: AggregatedNeighbor) => void;
}

export const GroupedNeighborsDisplay: React.FC<GroupedNeighborsDisplayProps> = ({
  groupedNeighbors,
  loading,
  targets,
  onEditNeighbor,
  onDeleteNeighbor
}) => {
  // Internal UI state for expand/collapse
  const [expandedNeighbors, setExpandedNeighbors] = useState<Record<string, boolean>>({});

  const toggleNeighbor = useCallback((clientId: string, backend: string, neighborIp: string) => {
    const key = `${clientId}-${backend}-${neighborIp}`;
    setExpandedNeighbors(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const findTargetForNeighbor = useCallback((neighbor: AggregatedNeighbor) => {
    return targets.find(
      t => t.client.id === neighbor.clientId && t.daemon.type === neighbor.backend
    );
  }, [targets]);

  const handleEditNeighbor = useCallback((neighbor: AggregatedNeighbor) => {
    const target = findTargetForNeighbor(neighbor);
    if (target) {
      onEditNeighbor(neighbor, target);
    }
  }, [findTargetForNeighbor, onEditNeighbor]);

  return (
    <>
      {Object.keys(groupedNeighbors).map(groupKey => {
        const group = groupedNeighbors[groupKey];
        return (
          <DashboardPane
            key={groupKey}
            title={`${group.clientName} - ${group.backend.toUpperCase()}`}
            loading={loading && group.neighbors.length === 0}
          >
            {group.neighbors.length === 0 ? (
              <EmptyState message="No BGP neighbors configured" />
            ) : (
              <div className={styles.neighborList}>
                {group.neighbors.map((neighbor) => {
                  const key = `${neighbor.clientId}-${neighbor.backend}-${neighbor.neighbor_ip}`;
                  const isExpanded = expandedNeighbors[key] || false;

                  return (
                    <NeighborCard
                      key={key}
                      neighbor={neighbor}
                      isExpanded={isExpanded}
                      onToggle={() => toggleNeighbor(neighbor.clientId, neighbor.backend, neighbor.neighbor_ip)}
                      onEdit={() => handleEditNeighbor(neighbor)}
                      onDelete={() => onDeleteNeighbor(neighbor)}
                    />
                  );
                })}
              </div>
            )}
          </DashboardPane>
        );
      })}
    </>
  );
};
