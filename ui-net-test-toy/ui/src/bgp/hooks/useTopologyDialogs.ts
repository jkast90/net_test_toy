/**
 * Topology Dialogs Management Hook
 * Manages all dialog states for topology builder
 */

import { useState, useCallback } from 'react';
import { fetchWrapper } from '../../_common/utils/fetchWrapper';

interface UseTopologyDialogsOptions {
  hostUrl: string;
}

interface NetworkFormData {
  name: string;
  subnet: string;
  gateway: string;
}

interface PendingLinkData {
  source: string;
  target: string;
}

export const useTopologyDialogs = (options: UseTopologyDialogsOptions) => {
  const { hostUrl } = options;

  // BGP Configuration Dialog
  const [showBGPForm, setShowBGPForm] = useState(false);
  const [bgpFormData, setBGPFormData] = useState<{ source: any; target: any } | null>(null);

  // Network Dialog
  const [showNetworkDialog, setShowNetworkDialog] = useState(false);
  const [networkForm, setNetworkForm] = useState<NetworkFormData>({
    name: '',
    subnet: '',
    gateway: ''
  });

  // Network Selection Dialog
  const [showNetworkSelectionDialog, setShowNetworkSelectionDialog] = useState(false);
  const [pendingLink, setPendingLink] = useState<PendingLinkData | null>(null);

  // Load Dialog
  const [showLoadDialog, setShowLoadDialog] = useState(false);

  // Create Topology Dialog
  const [showCreateTopologyDialog, setShowCreateTopologyDialog] = useState(false);
  const [newBackendTopologyName, setNewBackendTopologyName] = useState('');
  const [newBackendTopologyDescription, setNewBackendTopologyDescription] = useState('');
  const [newBackendTopologyMgmtNetwork, setNewBackendTopologyMgmtNetwork] = useState('');
  const [availableNetworks, setAvailableNetworks] = useState<Array<{name: string, subnet: string}>>([]);

  // External Node Dialog
  const [showExternalNodeDialog, setShowExternalNodeDialog] = useState(false);
  const [externalNodeForm, setExternalNodeForm] = useState({
    name: ''
  });

  // External Network Dialog
  const [showExternalNetworkDialog, setShowExternalNetworkDialog] = useState(false);
  const [externalNetworkForm, setExternalNetworkForm] = useState<NetworkFormData>({
    name: '',
    subnet: '',
    gateway: ''
  });

  // GRE Tunnel Dialog
  const [showGRETunnelDialog, setShowGRETunnelDialog] = useState(false);
  const [greTunnelFormData, setGRETunnelFormData] = useState<{
    source: { name: string; type: 'daemon' | 'host' | 'external_node'; interfaces?: any[] };
    target: { name: string; type: 'daemon' | 'host' | 'external_node'; interfaces?: any[] };
  } | null>(null);

  // BGP Form actions
  const openBGPForm = useCallback((sourceData: any, targetData: any) => {
    setBGPFormData({ source: sourceData, target: targetData });
    setShowBGPForm(true);
  }, []);

  const closeBGPForm = useCallback(() => {
    setShowBGPForm(false);
    setBGPFormData(null);
  }, []);

  // Network Dialog actions
  const openNetworkDialog = useCallback(() => {
    setShowNetworkDialog(true);
  }, []);

  const closeNetworkDialog = useCallback(() => {
    setShowNetworkDialog(false);
    // Only clear form if not coming from pending link
    if (!pendingLink) {
      setNetworkForm({ name: '', subnet: '', gateway: '' });
    }
  }, [pendingLink]);

  const updateNetworkForm = useCallback((updates: Partial<NetworkFormData>) => {
    setNetworkForm(prev => ({ ...prev, ...updates }));
  }, []);

  const resetNetworkForm = useCallback(() => {
    setNetworkForm({ name: '', subnet: '', gateway: '' });
  }, []);

  // Network Selection Dialog actions
  const openNetworkSelectionDialog = useCallback((source: string, target: string) => {
    setPendingLink({ source, target });
    setShowNetworkSelectionDialog(true);
  }, []);

  const closeNetworkSelectionDialog = useCallback(() => {
    setShowNetworkSelectionDialog(false);
    setPendingLink(null);
  }, []);

  // Load Dialog actions
  const openLoadDialog = useCallback(() => {
    setShowLoadDialog(true);
  }, []);

  const closeLoadDialog = useCallback(() => {
    setShowLoadDialog(false);
  }, []);

  // Create Topology Dialog actions
  const openCreateTopologyDialog = useCallback(async () => {
    // Fetch available networks from the host
    try {
      const networks = await fetchWrapper(`${hostUrl}/networks`);
      setAvailableNetworks(networks.map((n: any) => ({
        name: n.name,
        subnet: n.subnet || 'N/A'
      })));
    } catch (error) {
      console.error('Failed to fetch networks:', error);
      setAvailableNetworks([]);
    }
    setShowCreateTopologyDialog(true);
  }, [hostUrl]);

  const closeCreateTopologyDialog = useCallback(() => {
    setShowCreateTopologyDialog(false);
    setNewBackendTopologyName('');
    setNewBackendTopologyDescription('');
    setNewBackendTopologyMgmtNetwork('');
  }, []);

  const updateTopologyName = useCallback((name: string) => {
    setNewBackendTopologyName(name);
  }, []);

  const updateTopologyDescription = useCallback((description: string) => {
    setNewBackendTopologyDescription(description);
  }, []);

  const updateTopologyMgmtNetwork = useCallback((network: string) => {
    setNewBackendTopologyMgmtNetwork(network);
  }, []);

  // External Node Dialog actions
  const openExternalNodeDialog = useCallback(() => {
    setShowExternalNodeDialog(true);
  }, []);

  const closeExternalNodeDialog = useCallback(() => {
    setShowExternalNodeDialog(false);
    setExternalNodeForm({ name: '' });
  }, []);

  const updateExternalNodeForm = useCallback((updates: Partial<typeof externalNodeForm>) => {
    setExternalNodeForm(prev => ({ ...prev, ...updates }));
  }, []);

  // External Network Dialog actions
  const openExternalNetworkDialog = useCallback(() => {
    setShowExternalNetworkDialog(true);
  }, []);

  const closeExternalNetworkDialog = useCallback(() => {
    setShowExternalNetworkDialog(false);
    setExternalNetworkForm({ name: '', subnet: '', gateway: '' });
  }, []);

  const updateExternalNetworkForm = useCallback((updates: Partial<NetworkFormData>) => {
    setExternalNetworkForm(prev => ({ ...prev, ...updates }));
  }, []);

  // GRE Tunnel Dialog actions
  const openGRETunnelDialog = useCallback(() => {
    setShowGRETunnelDialog(true);
  }, []);

  const openGRETunnelForm = useCallback((
    sourceData: { name: string; type: 'daemon' | 'host' | 'external_node'; interfaces?: any[] },
    targetData: { name: string; type: 'daemon' | 'host' | 'external_node'; interfaces?: any[] }
  ) => {
    setGRETunnelFormData({ source: sourceData, target: targetData });
    setShowGRETunnelDialog(true);
  }, []);

  const closeGRETunnelDialog = useCallback(() => {
    setShowGRETunnelDialog(false);
    setGRETunnelFormData(null);
  }, []);

  return {
    // BGP Form
    showBGPForm,
    bgpFormData,
    openBGPForm,
    closeBGPForm,

    // Network Dialog
    showNetworkDialog,
    networkForm,
    openNetworkDialog,
    closeNetworkDialog,
    updateNetworkForm,
    resetNetworkForm,
    setNetworkForm,

    // Network Selection Dialog
    showNetworkSelectionDialog,
    pendingLink,
    openNetworkSelectionDialog,
    closeNetworkSelectionDialog,
    setPendingLink,

    // Load Dialog
    showLoadDialog,
    openLoadDialog,
    closeLoadDialog,

    // Create Topology Dialog
    showCreateTopologyDialog,
    newBackendTopologyName,
    newBackendTopologyDescription,
    newBackendTopologyMgmtNetwork,
    availableNetworks,
    openCreateTopologyDialog,
    closeCreateTopologyDialog,
    updateTopologyName,
    updateTopologyDescription,
    updateTopologyMgmtNetwork,

    // External Node Dialog
    showExternalNodeDialog,
    externalNodeForm,
    openExternalNodeDialog,
    closeExternalNodeDialog,
    updateExternalNodeForm,

    // External Network Dialog
    showExternalNetworkDialog,
    externalNetworkForm,
    openExternalNetworkDialog,
    closeExternalNetworkDialog,
    updateExternalNetworkForm,

    // GRE Tunnel Dialog
    showGRETunnelDialog,
    greTunnelFormData,
    openGRETunnelDialog,
    openGRETunnelForm,
    closeGRETunnelDialog
  };
};
