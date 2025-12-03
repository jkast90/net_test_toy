/**
 * Route Operations Hook
 * Handles route withdrawal with proper state management and user feedback
 */

import { useCallback } from 'react';
import { useAsyncMutation } from './useAsyncMutation';
import { useToast } from './useToast';
import { withdrawRouteFromTargets, type AggregatedRoute, type ClientDaemonPair } from '../services/multiClientBgpApi';

interface WithdrawRouteParams {
  route: AggregatedRoute;
  targets: ClientDaemonPair[];
}

interface UseRouteOperationsParams {
  onRouteChanged?: () => void;
}

/**
 * Hook for route operations with proper state management and user feedback
 */
export const useRouteOperations = (params?: UseRouteOperationsParams) => {
  const { showToast } = useToast();

  // Withdraw route mutation
  const {
    mutate: withdrawRoute,
    isLoading: isWithdrawing,
    reset: resetWithdraw
  } = useAsyncMutation(
    async ({ route, targets }: WithdrawRouteParams) => {
      // Parse prefix
      const [ip, cidr] = route.prefix.split('/');
      if (!ip || !cidr) {
        throw new Error('Invalid prefix format');
      }

      // Find the specific target for this route
      const target = targets.find(
        t => t.client.id === route.clientId && t.daemon.type === route.backend
      );

      if (!target) {
        throw new Error('Could not find target client/daemon for withdrawal');
      }

      // Withdraw the route
      const result = await withdrawRouteFromTargets([target], ip, cidr);

      if (result.failed > 0) {
        throw new Error(`Failed to withdraw: ${result.errors.join(', ')}`);
      }

      return {
        prefix: route.prefix,
        message: `Route ${route.prefix} withdrawn successfully`
      };
    },
    {
      onSuccess: (data) => {
        showToast({ type: 'success', text: data.message });
        params?.onRouteChanged?.();
      },
      onError: (error) => {
        showToast({ type: 'error', text: `Failed to withdraw route: ${error.message}` });
      }
    }
  );

  return {
    withdrawRoute,
    isWithdrawing,
    resetWithdraw
  };
};
