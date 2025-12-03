import { useCallback, useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  fetchFlowSpecRules,
  createFlowSpecRule,
  deleteFlowSpecRule,
  cancelFlowSpecMitigation,
  setSelectedBackend,
  clearError,
  clearSuccessMessage,
  resetFlowSpecState
} from '../store/flowspecSlice';
import {
  selectFlowSpecRulesByClient,
  selectFlowSpecRulesForClient,
  selectAllFlowSpecRules,
  selectFlowSpecSelectedBackend,
  selectFlowSpecIsLoading,
  selectFlowSpecIsDeleting,
  selectFlowSpecIsCreating,
  selectFlowSpecError,
  selectFlowSpecSuccessMessage,
  selectFlowSpecUIState
} from '../store/flowspecSelectors';
import { selectAllEnabledDaemons } from '../store/connectionSelectors';
import { FlowSpecRule } from '../services/flowspecService';

interface TriggeredEvent {
  timestamp: string;
  trigger_id: string;
  trigger_name: string;
  flow: {
    src_addr: string;
    dst_addr: string;
    src_port: number;
    dst_port: number;
    protocol: number;
    bytes: number;
    packets: number;
    kbps: number;
    mbps: number;
  };
  action_type: string;
  action_result: string;
}

export const useFlowSpec = () => {
  const dispatch = useAppDispatch();

  // Selectors
  const rulesByClient = useAppSelector(selectFlowSpecRulesByClient);
  const allRules = useAppSelector(selectAllFlowSpecRules);
  const selectedBackend = useAppSelector(selectFlowSpecSelectedBackend);
  const isLoading = useAppSelector(selectFlowSpecIsLoading);
  const isDeleting = useAppSelector(selectFlowSpecIsDeleting);
  const isCreating = useAppSelector(selectFlowSpecIsCreating);
  const error = useAppSelector(selectFlowSpecError);
  const successMessage = useAppSelector(selectFlowSpecSuccessMessage);
  const uiState = useAppSelector(selectFlowSpecUIState);
  const enabledDaemons = useAppSelector(selectAllEnabledDaemons);

  // Track canceling state
  const [cancelingMitigation, setCancelingMitigation] = useState<string | null>(null);

  // Fetch rules for a client
  const fetchRules = useCallback((clientUrl: string, backend?: string) => {
    return dispatch(fetchFlowSpecRules({
      clientUrl,
      backend: backend || selectedBackend
    }));
  }, [dispatch, selectedBackend]);

  // Create a new rule
  const createRule = useCallback((clientUrl: string, rule: FlowSpecRule, backend?: string) => {
    return dispatch(createFlowSpecRule({
      clientUrl,
      rule,
      backend: backend || selectedBackend
    }));
  }, [dispatch, selectedBackend]);

  // Delete a rule
  const deleteRule = useCallback((clientUrl: string, rule: FlowSpecRule, backend?: string) => {
    return dispatch(deleteFlowSpecRule({
      clientUrl,
      rule,
      backend: backend || selectedBackend
    }));
  }, [dispatch, selectedBackend]);

  // Cancel mitigation for a flow
  const cancelMitigation = useCallback((
    clientUrl: string,
    flow: {
      src_addr: string;
      dst_addr: string;
      src_port?: number;
      dst_port?: number;
      protocol?: number;
    },
    backend?: string
  ) => {
    return dispatch(cancelFlowSpecMitigation({
      clientUrl,
      flow,
      backend: backend || selectedBackend
    }));
  }, [dispatch, selectedBackend]);

  // Cancel mitigation for a triggered event - handles everything internally
  const cancelMitigationForEvent = useCallback(async (event: TriggeredEvent) => {
    const mitigationKey = `${event.flow.src_addr}-${event.flow.dst_addr}-${event.flow.dst_port}-${event.flow.protocol}`;
    setCancelingMitigation(mitigationKey);

    try {
      // Find a GoBGP daemon to cancel the FlowSpec mitigation
      const gobgpDaemon = enabledDaemons.find(t => t.daemon.type === 'gobgp');
      if (!gobgpDaemon) {
        throw new Error('No GoBGP daemon available to cancel FlowSpec mitigation');
      }

      // Cancel the mitigation
      await dispatch(cancelFlowSpecMitigation({
        clientUrl: gobgpDaemon.client.baseUrl,
        flow: {
          src_addr: event.flow.src_addr,
          dst_addr: event.flow.dst_addr,
          src_port: event.flow.src_port,
          dst_port: event.flow.dst_port,
          protocol: event.flow.protocol
        },
        backend: 'gobgp'
      }));

      // Refresh FlowSpec rules
      await dispatch(fetchFlowSpecRules({
        clientUrl: gobgpDaemon.client.baseUrl,
        backend: 'gobgp'
      }));

      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: errorMessage };
    } finally {
      setCancelingMitigation(null);
    }
  }, [dispatch, enabledDaemons]);

  // Get rules for a specific client
  const getRulesForClient = useCallback((clientUrl: string) => {
    return rulesByClient[clientUrl] || [];
  }, [rulesByClient]);

  // Set the selected backend
  const selectBackend = useCallback((backend: string) => {
    dispatch(setSelectedBackend(backend));
  }, [dispatch]);

  // Clear errors
  const clearErrors = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);

  // Clear success message
  const clearSuccess = useCallback(() => {
    dispatch(clearSuccessMessage());
  }, [dispatch]);

  // Reset all state
  const resetState = useCallback(() => {
    dispatch(resetFlowSpecState());
  }, [dispatch]);

  // Auto-clear messages after 5 seconds
  useEffect(() => {
    if (error || successMessage) {
      const timer = setTimeout(() => {
        if (error) clearErrors();
        if (successMessage) clearSuccess();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, successMessage, clearErrors, clearSuccess]);

  return {
    // State
    rulesByClient,
    allRules,
    selectedBackend,
    isLoading,
    isDeleting,
    isCreating,
    cancelingMitigation,
    error,
    successMessage,
    uiState,

    // Actions
    fetchRules,
    createRule,
    deleteRule,
    cancelMitigation,
    cancelMitigationForEvent,
    getRulesForClient,
    selectBackend,
    clearErrors,
    clearSuccess,
    resetState
  };
};