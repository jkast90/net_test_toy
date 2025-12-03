/**
 * Connections Page Operations Hook
 * Encapsulates all business logic for the Connections page
 */

import { useCallback } from 'react';
import { useDockerNetworkOperations } from '../../_common/hooks';
import { ManagedHost } from '../../_common/store/labManagerSlice';

interface NetworkFormState {
  name: string;
  subnet: string;
  gateway: string;
  driver: string;
}

interface UseConnectionsPageOperationsOptions {
  managedHosts: ManagedHost[];
  selectedHostId: string | null;
  newNetwork: NetworkFormState;
  setNewNetwork: (network: NetworkFormState) => void;
  dialogs: any;
  deleteNetworkDialog: any;
  pollInterval?: number;
}

export const useConnectionsPageOperations = ({
  managedHosts,
  selectedHostId,
  newNetwork,
  setNewNetwork,
  dialogs,
  deleteNetworkDialog,
  pollInterval
}: UseConnectionsPageOperationsOptions) => {
  const dockerNetworkOps = useDockerNetworkOperations({ pollInterval });

  const createNetwork = useCallback(async () => {
    const targetHost = managedHosts.find(h => h.id === selectedHostId);
    if (!targetHost) return;

    await dockerNetworkOps.handleCreateNetwork({
      hostUrl: targetHost.url,
      params: newNetwork,
      onSuccess: () => {
        dialogs.close('createNetwork');
        setNewNetwork({
          name: '',
          subnet: '',
          gateway: '',
          driver: 'bridge'
        });
      }
    });
  }, [managedHosts, selectedHostId, newNetwork, dockerNetworkOps, dialogs, setNewNetwork]);

  const deleteNetwork = useCallback((hostId: string, name: string) => {
    const host = managedHosts.find(h => h.id === hostId);
    if (!host) return;

    deleteNetworkDialog.open({ hostId, networkName: name });
  }, [managedHosts, deleteNetworkDialog]);

  const confirmDeleteNetwork = useCallback(async () => {
    if (!deleteNetworkDialog.data) return;

    const { hostId, networkName } = deleteNetworkDialog.data;
    const host = managedHosts.find(h => h.id === hostId);
    if (!host) return;

    await dockerNetworkOps.handleDeleteNetwork({
      hostUrl: host.url,
      networkName,
      onSuccess: () => {
        deleteNetworkDialog.close();
      }
    });
  }, [deleteNetworkDialog, managedHosts, dockerNetworkOps]);

  return {
    ...dockerNetworkOps,
    createNetwork,
    deleteNetwork,
    confirmDeleteNetwork
  };
};
