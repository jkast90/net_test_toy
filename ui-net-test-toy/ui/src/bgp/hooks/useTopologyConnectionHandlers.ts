/**
 * Topology Connection Handlers Hook
 * Manages node click handling for creating connections (links, BGP peers, GRE tunnels, taps, quick tests)
 */

import { useCallback, useState } from 'react';
import { topologyService } from '../../_common/services/topology/topologyService';
import type { TopologyNode, TopologyLink } from '../types/topology';

interface QuickTestNodeData {
  name: string;
  type: string;
  interfaces?: any[];
  asn?: number;
  router_id?: string;
}

interface QuickTestNodes {
  source: QuickTestNodeData;
  target: QuickTestNodeData;
}

export interface UseTopologyConnectionHandlersOptions {
  containerManagerUrl: string;
  selectedTopologyName: string | null;
  // Canvas hooks
  interactionMode: string;
  firstSelectedForLink: string | null;
  setFirstSelectedForLink: (nodeId: string | null) => void;
  changeMode: (mode: string) => void;
  findNode: (nodeId: string) => TopologyNode | undefined;
  addLink: (link: TopologyLink) => void;
  nodes: TopologyNode[];
  // Dialog hooks
  openNetworkSelectionDialog: (source: string, target: string) => void;
  closeNetworkSelectionDialog: () => void;
  openBGPForm: (sourceData: any, targetData: any) => void;
  closeBGPForm: () => void;
  bgpFormData: { source: any; target: any } | null;
  openGRETunnelForm: (sourceData: any, targetData: any) => void;
  pendingLink: { source: string; target: string } | null;
  // Operations data
  topologyDetails: any;
  daemonsWithInterfaces: any[];
  loadTopologyDetails: (name: string) => Promise<any>;
}

export const useTopologyConnectionHandlers = (options: UseTopologyConnectionHandlersOptions) => {
  const {
    containerManagerUrl,
    selectedTopologyName,
    interactionMode,
    firstSelectedForLink,
    setFirstSelectedForLink,
    changeMode,
    findNode,
    addLink,
    nodes,
    openNetworkSelectionDialog,
    closeNetworkSelectionDialog,
    openBGPForm,
    closeBGPForm,
    bgpFormData,
    openGRETunnelForm,
    pendingLink,
    topologyDetails,
    daemonsWithInterfaces,
    loadTopologyDetails
  } = options;

  // Quick test state
  const [quickTestNodes, setQuickTestNodes] = useState<QuickTestNodes | null>(null);

  // Tap dialog state
  const [showTapDialog, setShowTapDialog] = useState(false);
  const [preselectedContainer, setPreselectedContainer] = useState<string | null>(null);

  // Helper to get node interfaces
  const getNodeInterfaces = useCallback((node: TopologyNode) => {
    const daemon = daemonsWithInterfaces?.find((d: any) => d.name === node.data.name);
    const host = topologyDetails?.hosts?.find((h: any) => h.name === node.data.name);
    return daemon?.interfaces || host?.interfaces || [];
  }, [daemonsWithInterfaces, topologyDetails]);

  // Helper to enrich node data with interfaces
  const enrichNodeData = useCallback((node: TopologyNode) => {
    if (node.type === 'external_node') {
      return {
        name: node.data.name,
        type: 'external_node',
        router_id: node.data.name,
        daemon_type: 'external_node',
        asn: node.data.asn || 65000,
        interfaces: []
      };
    }
    return {
      ...node.data,
      interfaces: getNodeInterfaces(node)
    };
  }, [getNodeInterfaces]);

  // Handle node click for connection creation
  const handleNodeClickForConnection = useCallback((nodeId: string) => {
    if (interactionMode !== 'add-link' &&
        interactionMode !== 'add-bgp-neighbor' &&
        interactionMode !== 'add-gre-tunnel' &&
        interactionMode !== 'add-tap' &&
        interactionMode !== 'quick-test') {
      return;
    }

    if (!firstSelectedForLink) {
      // Handle tap creation - single click to select container
      if (interactionMode === 'add-tap') {
        const node = findNode(nodeId);
        if (node && (node.type === 'daemon' || node.type === 'host')) {
          setPreselectedContainer(node.data.name);
          setShowTapDialog(true);
          changeMode('select');
        } else {
          alert('Please select a daemon or host container to add a tap');
          changeMode('select');
        }
        return;
      }

      // For BGP neighbor mode, validate that the first node is not a host
      if (interactionMode === 'add-bgp-neighbor') {
        const node = findNode(nodeId);
        if (node && node.type === 'host') {
          alert('Hosts cannot be used as BGP peers. Please select a daemon (GoBGP, FRR, ExaBGP) or external node.');
          return;
        }
      }
      setFirstSelectedForLink(nodeId);
    } else {
      // Second node selected
      if (interactionMode === 'add-link') {
        openNetworkSelectionDialog(firstSelectedForLink, nodeId);
      } else if (interactionMode === 'quick-test') {
        handleQuickTestSelection(nodeId);
      } else if (interactionMode === 'add-bgp-neighbor') {
        handleBGPNeighborSelection(nodeId);
      } else if (interactionMode === 'add-gre-tunnel') {
        handleGRETunnelSelection(nodeId);
      }

      setFirstSelectedForLink(null);
      changeMode('select');
    }
  }, [interactionMode, firstSelectedForLink, findNode, changeMode, setFirstSelectedForLink, openNetworkSelectionDialog]);

  // Handle quick test node selection
  const handleQuickTestSelection = useCallback((targetNodeId: string) => {
    if (!firstSelectedForLink) return;

    const sourceNode = findNode(firstSelectedForLink);
    const targetNode = findNode(targetNodeId);

    if (sourceNode && targetNode) {
      setQuickTestNodes({
        source: {
          name: sourceNode.data.name,
          type: sourceNode.type,
          interfaces: getNodeInterfaces(sourceNode)
        },
        target: {
          name: targetNode.data.name,
          type: targetNode.type,
          interfaces: getNodeInterfaces(targetNode)
        }
      });
    }
  }, [firstSelectedForLink, findNode, getNodeInterfaces]);

  // Handle BGP neighbor selection
  const handleBGPNeighborSelection = useCallback((targetNodeId: string) => {
    if (!firstSelectedForLink) return;

    const sourceNode = findNode(firstSelectedForLink);
    const targetNode = findNode(targetNodeId);

    // Validate that neither node is a host
    if (targetNode && targetNode.type === 'host') {
      alert('Hosts cannot be used as BGP peers. Please select a daemon (GoBGP, FRR, ExaBGP) or external node.');
      return;
    }

    if (sourceNode && targetNode) {
      openBGPForm(enrichNodeData(sourceNode), enrichNodeData(targetNode));
    }
  }, [firstSelectedForLink, findNode, enrichNodeData, openBGPForm]);

  // Handle GRE tunnel selection
  const handleGRETunnelSelection = useCallback((targetNodeId: string) => {
    if (!firstSelectedForLink) return;

    const sourceNode = findNode(firstSelectedForLink);
    const targetNode = findNode(targetNodeId);

    if (sourceNode && targetNode) {
      openGRETunnelForm(
        {
          name: sourceNode.data.name,
          type: sourceNode.type as 'daemon' | 'host' | 'external_node',
          interfaces: getNodeInterfaces(sourceNode)
        },
        {
          name: targetNode.data.name,
          type: targetNode.type as 'daemon' | 'host' | 'external_node',
          interfaces: getNodeInterfaces(targetNode)
        }
      );
    }
  }, [firstSelectedForLink, findNode, getNodeInterfaces, openGRETunnelForm]);

  // Handle network selection for links
  const handleNetworkSelected = useCallback(async (networkName: string) => {
    if (!pendingLink || !selectedTopologyName) return;

    const sourceNode = findNode(pendingLink.source);
    const targetNode = findNode(pendingLink.target);

    if (!sourceNode || !targetNode) return;

    try {
      const networkDetails = topologyDetails?.networks?.find((n: any) => n.name === networkName);
      if (!networkDetails) {
        throw new Error(`Network ${networkName} not found`);
      }

      // Helper function to connect a node to a network
      const connectNodeToNetwork = async (node: TopologyNode, ipSuffix: number) => {
        const subnetBase = networkDetails.subnet.split('/')[0];
        const ipParts = subnetBase.split('.');
        ipParts[3] = String(ipSuffix);
        const ipAddress = ipParts.join('.');

        if (node.type === 'daemon') {
          const result = await topologyService.connectDaemonToNetwork(
            selectedTopologyName,
            node.data.name,
            networkName,
            ipAddress,
            networkDetails.gateway,
            containerManagerUrl
          );
          if (!result.success) {
            throw new Error(result.error || 'Failed to connect daemon to network');
          }
        } else if (node.type === 'host') {
          const result = await topologyService.connectHostToNetwork(
            selectedTopologyName,
            node.data.name,
            networkName,
            ipAddress,
            networkDetails.gateway,
            containerManagerUrl
          );
          if (!result.success) {
            throw new Error(result.error || 'Failed to connect host to network');
          }
        } else {
          throw new Error(`Cannot connect node type ${node.type} to network`);
        }
      };

      // Connect both nodes to the network (if they're not networks themselves)
      let connectionsCreated = 0;
      if (sourceNode.type !== 'network') {
        await connectNodeToNetwork(sourceNode, 10 + connectionsCreated * 10);
        connectionsCreated++;
      }
      if (targetNode.type !== 'network') {
        await connectNodeToNetwork(targetNode, 10 + connectionsCreated * 10);
        connectionsCreated++;
      }

      // Add link to canvas
      addLink({
        id: `link-${sourceNode.id}-${targetNode.id}`,
        source: sourceNode.id,
        target: targetNode.id,
        type: 'network',
        label: networkName,
        color: '#4CAF50',
        width: 2
      });

      closeNetworkSelectionDialog();
      changeMode('select');
      await loadTopologyDetails(selectedTopologyName);
    } catch (error) {
      console.error('Failed to create link:', error);
      alert(`Failed to create link: ${error}`);
    }
  }, [pendingLink, selectedTopologyName, containerManagerUrl, findNode, addLink, closeNetworkSelectionDialog, changeMode, loadTopologyDetails, topologyDetails]);

  // Close quick test pane
  const closeQuickTest = useCallback(() => {
    setQuickTestNodes(null);
  }, []);

  // Close tap dialog
  const closeTapDialog = useCallback(() => {
    setShowTapDialog(false);
    setPreselectedContainer(null);
  }, []);

  // Open quick test directly (without node selection)
  const openQuickTestDirect = useCallback(() => {
    setQuickTestNodes({ source: {} as QuickTestNodeData, target: {} as QuickTestNodeData });
  }, []);

  // Handle successful BGP session creation
  const handleBGPSuccess = useCallback(async () => {
    if (!selectedTopologyName) return;

    await loadTopologyDetails(selectedTopologyName);
    closeBGPForm();

    // Create visual link if both nodes exist
    if (bgpFormData) {
      const sourceNode = nodes.find(n =>
        (n.type === 'daemon' || n.type === 'external_node') &&
        n.data.router_id === bgpFormData.source.router_id
      );
      const targetNode = nodes.find(n =>
        (n.type === 'daemon' || n.type === 'external_node') &&
        n.data.router_id === bgpFormData.target.router_id
      );

      if (sourceNode && targetNode) {
        addLink({
          id: `bgp-${sourceNode.id}-${targetNode.id}`,
          source: sourceNode.id,
          target: targetNode.id,
          type: 'bgp',
          color: '#2196F3',
          width: 2
        });
      }
    }
  }, [selectedTopologyName, loadTopologyDetails, closeBGPForm, bgpFormData, nodes, addLink]);

  return {
    // Quick test state
    quickTestNodes,
    setQuickTestNodes,
    closeQuickTest,
    openQuickTestDirect,

    // Tap dialog state
    showTapDialog,
    preselectedContainer,
    closeTapDialog,

    // Handlers
    handleNodeClickForConnection,
    handleNetworkSelected,
    handleBGPSuccess
  };
};
