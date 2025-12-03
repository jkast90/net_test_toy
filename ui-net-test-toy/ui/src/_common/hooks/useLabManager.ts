import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  selectIsCreating,
  selectIsUpdating,
  selectIsDeleting,
  selectMutationError,
  selectIsMutating
} from '../store/labManagerSelectors';
import {
  createDaemon,
  updateDaemon,
  deleteDaemon,
  createLabHost,
  deleteLabHost,
  associateNetwork,
  restoreLab
} from '../store/labManagerSlice';
import type { LabDaemon } from '../services/labManager/labManagerService';
import { execCommand } from '../services/labManager/labManagerMutations';
import { useConfig, useDaemons, useHosts, useContainerManager, useContainerManagers } from '../contexts/ConfigContext';

// Main hook for consuming Lab Manager data
// Now uses Container Manager's topology instead of separate managed hosts
export const useLabManager = () => {
  const dispatch = useAppDispatch();

  // Get data from Container Manager config instead of Redux
  const { config, loading: isLoading, error, refetch } = useConfig();
  const labDaemons = useDaemons(); // Daemons from Container Manager
  const labHosts = useHosts(); // Hosts from Container Manager
  const selectedContainerManager = useContainerManager();
  const { containerManagers, selectContainerManager } = useContainerManagers();

  // Convert Container Managers to managed hosts format for backward compatibility
  const managedHosts = containerManagers.map(cm => ({
    id: cm.id,
    name: cm.name,
    url: cm.url,
    enabled: true
  }));

  const enabledManagedHosts = managedHosts; // All Container Managers are enabled
  const selectedHostId = selectedContainerManager?.id || null;

  // Mutation states
  const isCreating = useAppSelector(selectIsCreating);
  const isUpdating = useAppSelector(selectIsUpdating);
  const isDeleting = useAppSelector(selectIsDeleting);
  const mutationError = useAppSelector(selectMutationError);
  const isMutating = useAppSelector(selectIsMutating);

  // Actions
  const refreshAllData = useCallback(() => {
    refetch();
  }, [refetch]);

  const refreshHostData = useCallback((_hostId: string) => {
    // Just refresh the config since we're using Container Manager data
    refetch();
  }, [refetch]);

  const selectHost = useCallback((hostId: string) => {
    // Select the Container Manager with this ID
    selectContainerManager(hostId);
  }, [selectContainerManager]);

  // Note: addHost, updateHost, removeHost, toggleHost are now handled by
  // useContainerManagers hook (addContainerManager, removeContainerManager, etc.)
  const addHost = useCallback((_name: string, _url: string) => {
    console.warn('useLabManager.addHost is deprecated. Use useContainerManagers().addContainerManager instead.');
  }, []);

  const updateHost = useCallback((_host: any) => {
    console.warn('useLabManager.updateHost is deprecated. Container Managers are immutable.');
  }, []);

  const removeHost = useCallback((_hostId: string) => {
    console.warn('useLabManager.removeHost is deprecated. Use useContainerManagers().removeContainerManager instead.');
  }, []);

  const toggleHost = useCallback((_hostId: string) => {
    console.warn('useLabManager.toggleHost is deprecated. Container Managers are always enabled.');
  }, []);

  return {
    // Data - now from Container Manager config
    labDaemons,
    labHosts,
    managedHosts, // Container Managers
    enabledManagedHosts, // All Container Managers
    selectedHostId, // Selected Container Manager ID
    combinedData: { daemons: labDaemons, hosts: labHosts }, // Combined data for compatibility
    isLoading,
    error: error || null,

    // Mutation states
    isCreating,
    isUpdating,
    isDeleting,
    mutationError,
    isMutating,

    // Actions
    refreshAllData,
    refreshHostData,
    selectHost,
    addHost, // Deprecated - use useContainerManagers instead
    updateHost, // Deprecated
    removeHost, // Deprecated
    toggleHost // Deprecated
  };
};

// Hook for Lab Manager operations (create, update, delete)
// Now uses the selected Container Manager as the target
export const useLabManagerOperations = () => {
  const dispatch = useAppDispatch();
  const selectedContainerManager = useContainerManager();

  // The "hostId" is now the Container Manager ID
  const selectedHostId = selectedContainerManager?.id || '';
  const hostUrl = selectedContainerManager?.url;

  const handleCreateDaemon = useCallback(async (config: {
    name: string;
    daemon_type: 'gobgp' | 'frr' | 'exabgp';
    asn?: string;
    router_id?: string;
  }) => {
    if (!selectedHostId) {
      throw new Error('No Container Manager selected');
    }
    return dispatch(createDaemon({ hostId: selectedHostId, config })).unwrap();
  }, [selectedHostId, dispatch]);

  const handleUpdateDaemon = useCallback(async (daemonId: string, config: Partial<LabDaemon>) => {
    if (!selectedHostId) {
      throw new Error('No Container Manager selected');
    }
    return dispatch(updateDaemon({ hostId: selectedHostId, daemonId, config })).unwrap();
  }, [selectedHostId, dispatch]);

  const handleDeleteDaemon = useCallback(async (daemonId: string) => {
    if (!selectedHostId) {
      throw new Error('No Container Manager selected');
    }
    return dispatch(deleteDaemon({ hostId: selectedHostId, daemonId })).unwrap();
  }, [selectedHostId, dispatch]);

  const handleCreateHost = useCallback(async (config: {
    name: string;
    gateway_daemon?: string;
    loopback_network?: string;
  }) => {
    if (!selectedHostId) {
      throw new Error('No Container Manager selected');
    }
    return dispatch(createLabHost({ hostId: selectedHostId, config })).unwrap();
  }, [selectedHostId, dispatch]);

  const handleDeleteHost = useCallback(async (labHostId: string) => {
    if (!selectedHostId) {
      throw new Error('No Container Manager selected');
    }
    return dispatch(deleteLabHost({ hostId: selectedHostId, labHostId })).unwrap();
  }, [selectedHostId, dispatch]);

  const handleExecCommand = useCallback(async (containerId: string, command: string) => {
    if (!selectedHostId) {
      throw new Error('No Container Manager selected');
    }
    return dispatch(execCommand({ hostId: selectedHostId, containerId, command })).unwrap();
  }, [selectedHostId, dispatch]);

  const handleAssociateNetwork = useCallback(async (containerId: string, networkName: string) => {
    if (!selectedHostId) {
      throw new Error('No Container Manager selected');
    }
    return dispatch(associateNetwork({ hostId: selectedHostId, containerId, networkName })).unwrap();
  }, [selectedHostId, dispatch]);

  const handleRestoreLab = useCallback(async () => {
    if (!selectedHostId) {
      throw new Error('No Container Manager selected');
    }
    return dispatch(restoreLab({ hostId: selectedHostId })).unwrap();
  }, [selectedHostId, dispatch]);

  return {
    createDaemon: handleCreateDaemon,
    updateDaemon: handleUpdateDaemon,
    deleteDaemon: handleDeleteDaemon,
    createHost: handleCreateHost,
    deleteHost: handleDeleteHost,
    execCommand: handleExecCommand,
    associateNetwork: handleAssociateNetwork,
    restoreLab: handleRestoreLab,
    // Expose the Container Manager URL for components that need it
    containerManagerUrl: hostUrl
  };
};