/**
 * FlowSpec Operations with Feedback Hook
 * Wraps FlowSpec operations with automatic success/error feedback
 */

import { useCallback } from 'react';
import { useOperationWithFeedback } from './useOperationWithFeedback';
import { useBMP } from './useBMP';
import { ClientDaemonPair } from '../services/multiClientBgpApi';

export const useFlowSpecOperationsWithFeedback = (
  monitoringUrl: string | undefined,
  targets: ClientDaemonPair[]
) => {
  const { deleteFlowSpecRuleWithService, loadBMPData } = useBMP(monitoringUrl);
  const { feedback, clearFeedback, wrapOperation } = useOperationWithFeedback();

  const handleDeleteFlowSpecRule = wrapOperation(
    async (rule: any) => {
      const result = await deleteFlowSpecRuleWithService(rule, targets);

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete FlowSpec rule');
      }

      // Refresh BMP data after successful deletion
      await loadBMPData();

      return rule;
    },
    {
      successMessage: () => 'FlowSpec rule deleted successfully',
      errorMessage: (error: Error) => `Error deleting FlowSpec rule: ${error.message}`
    }
  );

  return {
    handleDeleteFlowSpecRule,
    feedback,
    clearFeedback
  };
};
