/**
 * Neighbor Operations with Feedback Hook
 * Wraps neighbor operations with automatic success/error feedback
 */

import { useCallback } from 'react';
import { useNeighborOperations } from './useNeighbors';
import { useOperationWithFeedback } from './useOperationWithFeedback';
import { AggregatedNeighbor, ClientDaemonPair } from '../services/multiClientBgpApi';

export const useNeighborOperationsWithFeedback = (targets: ClientDaemonPair[]) => {
  const { loadNeighbors, removeNeighbor } = useNeighborOperations();
  const { feedback, clearFeedback, wrapOperation } = useOperationWithFeedback();

  const handleDeleteNeighbor = wrapOperation(
    async (neighbor: AggregatedNeighbor) => {
      const target = targets.find(
        t => t.client.id === neighbor.clientId && t.daemon.type === neighbor.backend
      );

      if (!target) {
        throw new Error('Could not find target for neighbor');
      }

      await removeNeighbor(target, neighbor.neighbor_ip);
      return neighbor;
    },
    {
      successMessage: (result: AggregatedNeighbor) => `Neighbor ${result.neighbor_ip} deleted successfully`,
      errorMessage: (error: Error) => error.message
    }
  );

  const refreshNeighbors = useCallback(() => {
    loadNeighbors(targets);
  }, [loadNeighbors, targets]);

  return {
    handleDeleteNeighbor,
    refreshNeighbors,
    feedback,
    clearFeedback
  };
};
