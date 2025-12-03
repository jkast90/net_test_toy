/**
 * Topology Dialog Handlers Hook
 * Contains async submit handlers for topology dialogs
 */

import { useCallback } from 'react';
import { topologyService } from '../../_common/services/topology/topologyService';
import type { Trigger } from '../../_common/types/netflow';

interface NetworkFormData {
  name: string;
  subnet: string;
  gateway: string;
}

interface UseTopologyDialogHandlersOptions {
  containerManagerUrl: string;
  selectedTopologyName: string | null;

  // Operations - use generic Promise<any> to handle Redux thunk return types
  loadTopologyDetails: (name: string, suppressLogs?: boolean) => Promise<any>;
  loadTopologies: (suppressLogs?: boolean) => Promise<any>;
  handleAddNetwork: (network: NetworkFormData) => Promise<any>;
  handleSaveDaemon: (daemon: any, editingName: string | null) => Promise<any>;
  handleSaveHost: (host: any, editingName: string | null) => Promise<any>;
  handleSubmitTrigger: (trigger: Trigger, editingTriggerId?: string | number | null) => Promise<any>;
  refetchConfig: () => void;

  // Dialog close functions
  closeNetworkDialog: () => void;
  resetNetworkForm: () => void;
  closeExternalNodeDialog: () => void;
  closeExternalNetworkDialog: () => void;
  closeCreateTopologyDialog: () => void;
  closeEditTopologyDialog: () => void;
  closeCreateDaemonDialog: () => void;
  closeCreateHostDialog: () => void;
  closeTriggerDialog: () => void;
  closeGRETunnelDialog: () => void;

  // Form data
  networkForm: NetworkFormData;
  externalNodeForm: { name: string };
  externalNetworkForm: NetworkFormData;
  newBackendTopologyName: string;
  newBackendTopologyDescription: string;
  newBackendTopologyMgmtNetwork: string;
  editTopologyForm: { description: string };
  newDaemon: any;
  editingDaemonName: string | null;
  newHostForm: any;
  editingHostName: string | null;
  triggerFormState: any;
  editingTriggerId: string | number | null;

  // Create topology operation
  createTopology: (name: string, description?: string, mgmtNetwork?: string) => Promise<any>;
}

export const useTopologyDialogHandlers = (options: UseTopologyDialogHandlersOptions) => {
  const {
    containerManagerUrl,
    selectedTopologyName,
    loadTopologyDetails,
    loadTopologies,
    handleAddNetwork,
    handleSaveDaemon,
    handleSaveHost,
    handleSubmitTrigger,
    refetchConfig,
    closeNetworkDialog,
    resetNetworkForm,
    closeExternalNodeDialog,
    closeExternalNetworkDialog,
    closeCreateTopologyDialog,
    closeEditTopologyDialog,
    closeCreateDaemonDialog,
    closeCreateHostDialog,
    closeTriggerDialog,
    closeGRETunnelDialog,
    networkForm,
    externalNodeForm,
    externalNetworkForm,
    newBackendTopologyName,
    newBackendTopologyDescription,
    newBackendTopologyMgmtNetwork,
    editTopologyForm,
    newDaemon,
    editingDaemonName,
    newHostForm,
    editingHostName,
    triggerFormState,
    editingTriggerId,
    createTopology
  } = options;

  // Save network handler
  const handleSaveNetwork = useCallback(async () => {
    await handleAddNetwork(networkForm);
    resetNetworkForm();
    closeNetworkDialog();
  }, [handleAddNetwork, networkForm, resetNetworkForm, closeNetworkDialog]);

  // Save external node handler
  const handleSaveExternalNode = useCallback(async () => {
    if (!selectedTopologyName) return;
    try {
      const result = await topologyService.createExternalNode(
        selectedTopologyName,
        externalNodeForm.name,
        containerManagerUrl
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to create external node');
      }

      await loadTopologyDetails(selectedTopologyName);
      closeExternalNodeDialog();
    } catch (error) {
      console.error('Failed to create external node:', error);
      alert(`Failed to create external node: ${error}`);
    }
  }, [selectedTopologyName, externalNodeForm.name, containerManagerUrl, loadTopologyDetails, closeExternalNodeDialog]);

  // Save external network handler
  const handleSaveExternalNetwork = useCallback(async () => {
    if (!selectedTopologyName) return;
    try {
      const result = await topologyService.createExternalNetwork(
        selectedTopologyName,
        externalNetworkForm.name,
        externalNetworkForm.subnet,
        externalNetworkForm.gateway,
        containerManagerUrl
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to create external network');
      }

      await loadTopologyDetails(selectedTopologyName);
      closeExternalNetworkDialog();
    } catch (error) {
      console.error('Failed to create external network:', error);
      alert(`Failed to create external network: ${error}`);
    }
  }, [selectedTopologyName, externalNetworkForm, containerManagerUrl, loadTopologyDetails, closeExternalNetworkDialog]);

  // Create topology handler
  const handleCreateTopology = useCallback(async () => {
    await createTopology(
      newBackendTopologyName,
      newBackendTopologyDescription,
      newBackendTopologyMgmtNetwork
    );
    closeCreateTopologyDialog();
  }, [createTopology, newBackendTopologyName, newBackendTopologyDescription, newBackendTopologyMgmtNetwork, closeCreateTopologyDialog]);

  // Save topology edit handler
  const handleSaveTopologyEdit = useCallback(async () => {
    if (!selectedTopologyName) return;

    try {
      const result = await topologyService.updateTopology(
        selectedTopologyName,
        { name: selectedTopologyName, ...editTopologyForm },
        containerManagerUrl
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to update topology');
      }

      await loadTopologies();
      closeEditTopologyDialog();
    } catch (error) {
      console.error('Failed to update topology:', error);
      alert(`Failed to update topology: ${error}`);
    }
  }, [selectedTopologyName, editTopologyForm, containerManagerUrl, loadTopologies, closeEditTopologyDialog]);

  // Save daemon handler
  const handleSaveDaemonDialog = useCallback(async () => {
    await handleSaveDaemon(newDaemon, editingDaemonName);
    closeCreateDaemonDialog();
  }, [handleSaveDaemon, newDaemon, editingDaemonName, closeCreateDaemonDialog]);

  // Save host handler
  const handleSaveHostDialog = useCallback(async () => {
    await handleSaveHost(newHostForm, editingHostName);
    closeCreateHostDialog();
  }, [handleSaveHost, newHostForm, editingHostName, closeCreateHostDialog]);

  // Submit trigger handler
  const handleSubmitTriggerDialog = useCallback(async () => {
    console.log('[handleSubmitTriggerDialog] Called with:', {
      triggerFormState,
      editingTriggerId,
      selectedTopologyName
    });
    try {
      await handleSubmitTrigger(triggerFormState as Trigger, editingTriggerId);
      console.log('[handleSubmitTriggerDialog] Success, closing dialog');
      closeTriggerDialog();
    } catch (error) {
      const action = editingTriggerId ? 'update' : 'create';
      console.error(`Failed to ${action} trigger:`, error);
      alert(`Failed to ${action} trigger: ${error}`);
    }
  }, [handleSubmitTrigger, triggerFormState, editingTriggerId, closeTriggerDialog, selectedTopologyName]);

  // GRE tunnel success handler
  const handleGRETunnelSuccess = useCallback(() => {
    refetchConfig();
    closeGRETunnelDialog();
  }, [refetchConfig, closeGRETunnelDialog]);

  return {
    handleSaveNetwork,
    handleSaveExternalNode,
    handleSaveExternalNetwork,
    handleCreateTopology,
    handleSaveTopologyEdit,
    handleSaveDaemonDialog,
    handleSaveHostDialog,
    handleSubmitTriggerDialog,
    handleGRETunnelSuccess
  };
};
