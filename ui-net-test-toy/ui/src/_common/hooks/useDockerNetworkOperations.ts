/**
 * Docker Network Operations Hook
 * Wraps Docker network operations with validation and feedback
 */

import { useCallback } from 'react';
import { useDockerNetworks } from './useDockerNetworks';
import { useOperationWithFeedback } from './useOperationWithFeedback';

export interface NetworkCreateParams {
  name: string;
  subnet: string;
  gateway: string;
  driver: string;
}

export interface CreateNetworkOptions {
  hostUrl: string;
  params: NetworkCreateParams;
  onSuccess?: () => void;
}

export interface DeleteNetworkOptions {
  hostUrl: string;
  networkName: string;
  onSuccess?: () => void;
}

export interface UseDockerNetworkOperationsOptions {
  pollInterval?: number;
}

export const useDockerNetworkOperations = (options?: UseDockerNetworkOperationsOptions) => {
  const dockerNetworks = useDockerNetworks(options);
  const { feedback, clearFeedback, wrapOperation } = useOperationWithFeedback();

  const handleCreateNetwork = useCallback((options: CreateNetworkOptions) => {
    return wrapOperation(
      async () => {
        if (!options.params.name || !options.params.subnet || !options.params.gateway) {
          throw new Error('Please provide network name, subnet, and gateway');
        }

        const result = await dockerNetworks.createNetwork(options.hostUrl, options.params);

        if (!result.success) {
          throw new Error(result.error || 'Failed to create network');
        }

        return { networkName: options.params.name };
      },
      {
        successMessage: (result: { networkName: string }) => `Network ${result.networkName} created successfully`,
        onSuccess: options.onSuccess
      }
    )();
  }, [dockerNetworks, wrapOperation]);

  const handleDeleteNetwork = useCallback((options: DeleteNetworkOptions) => {
    return wrapOperation(
      async () => {
        const result = await dockerNetworks.deleteNetwork(options.hostUrl, options.networkName);

        if (!result.success) {
          throw new Error(result.error || 'Failed to delete network');
        }

        return { networkName: options.networkName };
      },
      {
        successMessage: (result: { networkName: string }) => `Network ${result.networkName} deleted successfully`,
        onSuccess: options.onSuccess
      }
    )();
  }, [dockerNetworks, wrapOperation]);

  return {
    ...dockerNetworks,
    handleCreateNetwork,
    handleDeleteNetwork,
    feedback,
    clearFeedback
  };
};
