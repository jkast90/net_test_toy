/**
 * Trigger Operations Hook
 * Handles NetFlow trigger CRUD operations with proper state management and user feedback
 */

import { useCallback } from 'react';
import { useAsyncMutation } from './useAsyncMutation';
import { useToast } from './useToast';
import { netflowService } from '../services/netflow/netflowService';
import type { Trigger, TriggerConditions, TriggerAction } from '../types/netflow';

interface TriggerData {
  name: string;
  enabled: boolean;
  conditions: TriggerConditions;
  action: TriggerAction;
}

interface CreateTriggerParams {
  triggerData: TriggerData;
  baseUrl: string;
}

interface UpdateTriggerParams {
  triggerId: string;
  triggerData: Partial<TriggerData>;
  baseUrl: string;
}

interface DeleteTriggerParams {
  triggerId: string;
  baseUrl: string;
}

interface ToggleEnabledParams {
  trigger: Trigger;
  baseUrl: string;
}

interface UseTriggerOperationsParams {
  onTriggerChanged?: () => void;
}

/**
 * Hook for trigger operations with proper state management and user feedback
 */
export const useTriggerOperations = (params?: UseTriggerOperationsParams) => {
  const { onTriggerChanged } = params || {};
  const { showToast } = useToast();

  // Create trigger mutation
  const {
    mutate: createTrigger,
    isLoading: isCreating,
    reset: resetCreate
  } = useAsyncMutation(
    async ({ triggerData, baseUrl }: CreateTriggerParams) => {
      const result = await netflowService.createNetFlowAlert(triggerData, baseUrl);
      return {
        triggerName: triggerData.name,
        message: `Trigger "${triggerData.name}" created successfully`
      };
    },
    {
      onSuccess: (data) => {
        showToast({ type: 'success', text: data.message });
        onTriggerChanged?.();
      },
      onError: (error) => {
        showToast({ type: 'error', text: `Failed to create trigger: ${error.message}` });
      }
    }
  );

  // Update trigger mutation
  const {
    mutate: updateTrigger,
    isLoading: isUpdating,
    reset: resetUpdate
  } = useAsyncMutation(
    async ({ triggerId, triggerData, baseUrl }: UpdateTriggerParams) => {
      const result = await netflowService.updateNetFlowAlert(triggerId, triggerData, baseUrl);
      return {
        message: `Trigger updated successfully`
      };
    },
    {
      onSuccess: (data) => {
        showToast({ type: 'success', text: data.message });
        onTriggerChanged?.();
      },
      onError: (error) => {
        showToast({ type: 'error', text: `Failed to update trigger: ${error.message}` });
      }
    }
  );

  // Delete trigger mutation
  const {
    mutate: deleteTrigger,
    isLoading: isDeleting,
    reset: resetDelete
  } = useAsyncMutation(
    async ({ triggerId, baseUrl }: DeleteTriggerParams) => {
      await netflowService.deleteNetFlowAlert(triggerId, baseUrl);
      return {
        message: 'Trigger deleted successfully'
      };
    },
    {
      onSuccess: (data) => {
        showToast({ type: 'success', text: data.message });
        onTriggerChanged?.();
      },
      onError: (error) => {
        showToast({ type: 'error', text: `Failed to delete trigger: ${error.message}` });
      }
    }
  );

  // Toggle enabled mutation
  const {
    mutate: toggleEnabled,
    isLoading: isToggling,
    reset: resetToggle
  } = useAsyncMutation(
    async ({ trigger, baseUrl }: ToggleEnabledParams) => {
      await netflowService.updateNetFlowAlert(
        trigger.id,
        { enabled: !trigger.enabled },
        baseUrl
      );
      return {
        message: `Trigger ${trigger.enabled ? 'disabled' : 'enabled'} successfully`
      };
    },
    {
      onSuccess: (data) => {
        showToast({ type: 'success', text: data.message });
        onTriggerChanged?.();
      },
      onError: (error) => {
        showToast({ type: 'error', text: `Failed to toggle trigger: ${error.message}` });
      }
    }
  );

  return {
    // Create
    createTrigger,
    isCreating,
    resetCreate,

    // Update
    updateTrigger,
    isUpdating,
    resetUpdate,

    // Delete
    deleteTrigger,
    isDeleting,
    resetDelete,

    // Toggle
    toggleEnabled,
    isToggling,
    resetToggle
  };
};
