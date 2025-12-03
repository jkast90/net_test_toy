/**
 * Lab Manager Operations with Feedback Hook
 * Wraps lab manager operations with automatic success/error feedback
 */

import { useCallback } from 'react';
import { useLabManagerOperations } from './useLabManager';
import { useOperationWithFeedback } from './useOperationWithFeedback';

export const useLabManagerOperationsWithFeedback = () => {
  const operations = useLabManagerOperations();
  const { feedback, clearFeedback, wrapOperation } = useOperationWithFeedback();

  const handleCreateDaemon = useCallback((config: any, options?: { onSuccess?: () => void }) => {
    return wrapOperation(
      async () => {
        await operations.createDaemon(config);
        return { name: config.name };
      },
      {
        successMessage: (result: { name: string }) => `Daemon ${result.name} created successfully`,
        onSuccess: options?.onSuccess
      }
    )();
  }, [operations, wrapOperation]);

  const handleDeleteDaemon = useCallback((daemonId: string, options?: { onSuccess?: () => void }) => {
    return wrapOperation(
      async () => {
        await operations.deleteDaemon(daemonId);
        return { daemonId };
      },
      {
        successMessage: () => 'Daemon deleted successfully',
        onSuccess: options?.onSuccess
      }
    )();
  }, [operations, wrapOperation]);

  const handleCreateHost = useCallback((config: any, options?: { onSuccess?: () => void }) => {
    return wrapOperation(
      async () => {
        await operations.createHost(config);
        return { name: config.name };
      },
      {
        successMessage: (result: { name: string }) => `Host ${result.name} created successfully`,
        onSuccess: options?.onSuccess
      }
    )();
  }, [operations, wrapOperation]);

  const handleDeleteHost = useCallback((labHostId: string, options?: { onSuccess?: () => void }) => {
    return wrapOperation(
      async () => {
        await operations.deleteHost(labHostId);
        return { labHostId };
      },
      {
        successMessage: () => 'Host deleted successfully',
        onSuccess: options?.onSuccess
      }
    )();
  }, [operations, wrapOperation]);

  const handleRestoreLab = useCallback((options?: { onSuccess?: () => void }) => {
    return wrapOperation(
      async () => {
        await operations.restoreLab();
        return {};
      },
      {
        successMessage: () => 'Lab restored successfully',
        onSuccess: options?.onSuccess
      }
    )();
  }, [operations, wrapOperation]);

  const handleExecCommand = useCallback(async (containerId: string, command: string) => {
    // Note: execCommand is special - it needs to return the result
    // So we don't wrap it with feedback, but we can still throw errors
    try {
      const result = await operations.execCommand(containerId, command);
      return result;
    } catch (error) {
      throw error;
    }
  }, [operations]);

  const handleAssociateNetwork = useCallback((containerId: string, networkName: string, options?: { onSuccess?: () => void }) => {
    return wrapOperation(
      async () => {
        await operations.associateNetwork(containerId, networkName);
        return { networkName };
      },
      {
        successMessage: (result: { networkName: string }) => `Network ${result.networkName} associated successfully`,
        onSuccess: options?.onSuccess
      }
    )();
  }, [operations, wrapOperation]);

  return {
    handleCreateDaemon,
    handleDeleteDaemon,
    handleCreateHost,
    handleDeleteHost,
    handleRestoreLab,
    handleExecCommand,
    handleAssociateNetwork,
    feedback,
    clearFeedback
  };
};
