/**
 * Topology Builder Operations Hook
 * Manages all operations and business logic for the topology builder
 */

import { useCallback, useState, useEffect } from 'react';
import { useTopologyManager } from '../../_common/hooks/useTopologyManager';
import { useLabManager } from '../../_common/hooks/useLabManager';
import { useLabManagerOperationsWithFeedback } from '../../_common/hooks';
import { useConfig, useMonitoring } from '../../_common/contexts/ConfigContext';
import { fetchWrapper } from '../../_common/utils/fetchWrapper';
import { topologyService } from '../../_common/services/topology/topologyService';
import { containerManagerService } from '../../_common/services/containerManager/containerManagerService';
import type { Trigger } from '../../_common/types/netflow';
import type { TopologyNode, TopologyLink } from '../types/topology';

export interface UseTopologyBuilderOperationsOptions {
  containerManagerUrl: string;
  selectedTopologyName: string | null;
  canvasNodes: TopologyNode[];
  canvasLinks: TopologyLink[];
  onNodesChange: (nodes: TopologyNode[]) => void;
  onLinksChange: (links: TopologyLink[]) => void;
}

export const useTopologyBuilderOperations = (options: UseTopologyBuilderOperationsOptions) => {
  const {
    containerManagerUrl,
    selectedTopologyName,
    canvasNodes,
    canvasLinks,
    onNodesChange,
    onLinksChange
  } = options;

  // Hooks
  const { config: appConfig, refetch: refetchConfig } = useConfig();
  const monitoring = useMonitoring();
  const { labDaemons, labHosts } = useLabManager();
  const {
    feedback: labFeedback,
    clearFeedback: clearLabFeedback
  } = useLabManagerOperationsWithFeedback();

  const {
    topologies,
    activeTopology,
    topologyDetails,
    isLoadingTopologies,
    isLoadingDetails,
    isActivating,
    error,
    detailsError,
    successMessage,
    loadTopologies,
    loadTopologyDetails,
    createTopology: createBackendTopology,
    activateTopology: activateBackendTopology,
    deleteTopology: deleteBackendTopology,
    clearErrors,
    clearSuccess
  } = useTopologyManager({ hostUrl: containerManagerUrl });

  // Note: Triggers are now saved directly to topology database via /topologies/{name}/triggers

  // Fetch daemons with interfaces from topology
  const [daemonsWithInterfaces, setDaemonsWithInterfaces] = useState<any[]>([]);

  useEffect(() => {
    if (!containerManagerUrl || !selectedTopologyName || !topologyDetails) return;

    const fetchDaemonsWithInterfaces = async (suppressLogs = false) => {
      try {
        const daemons = topologyDetails.daemons || [];

        const daemonsWithNetworks = await Promise.all(
          daemons.map(async (daemon: any) => {
            try {
              const data = await fetchWrapper(
                `${containerManagerUrl}/topologies/${selectedTopologyName}/daemons/${daemon.name}/networks`,
                { suppressLogs }
              );
              const networks = data.networks || [];

              const interfaces = networks.map((network: any) => ({
                network: network.name,
                ipv4: network.ipv4_address || '',
                gateway: network.gateway || '',
                mac: ''
              }));

              return {
                id: daemon.name,
                name: daemon.name,
                daemon_type: daemon.type,
                type: daemon.type,
                router_id: daemon.router_id,
                ip_address: daemon.ip_address,
                interfaces: interfaces
              };
            } catch (error) {
              console.error(`Error fetching networks for daemon ${daemon.name}:`, error);
              return {
                id: daemon.name,
                name: daemon.name,
                daemon_type: daemon.type,
                type: daemon.type,
                router_id: daemon.router_id,
                ip_address: daemon.ip_address,
                interfaces: []
              };
            }
          })
        );

        setDaemonsWithInterfaces(daemonsWithNetworks);
      } catch (error) {
        console.error('Failed to fetch daemons with interfaces from topology:', error);
        setDaemonsWithInterfaces([]);
      }
    };

    fetchDaemonsWithInterfaces();

    const interval = setInterval(() => fetchDaemonsWithInterfaces(true), 5000);
    return () => clearInterval(interval);
  }, [containerManagerUrl, selectedTopologyName, topologyDetails]);

  // Network operations
  const handleAddNetwork = useCallback(async (networkData: { name: string; subnet: string; gateway: string }) => {
    if (!selectedTopologyName) return;

    try {
      const params = new URLSearchParams({
        name: networkData.name,
        subnet: networkData.subnet,
        gateway: networkData.gateway,
        driver: 'bridge'
      });

      await fetchWrapper(`${containerManagerUrl}/topologies/${selectedTopologyName}/networks?${params}`, {
        method: 'POST'
      });
      await loadTopologyDetails(selectedTopologyName);
    } catch (error) {
      console.error('Failed to create network:', error);
      throw error;
    }
  }, [containerManagerUrl, selectedTopologyName, loadTopologyDetails]);

  // Node operations
  const handleDeleteNode = useCallback(async (nodeId: string) => {
    const node = canvasNodes.find(n => n.id === nodeId);
    if (!node || !selectedTopologyName) return;

    try {
      let result;
      if (node.type === 'daemon') {
        result = await topologyService.deleteDaemon(node.data.name, containerManagerUrl);
      } else if (node.type === 'host') {
        result = await topologyService.deleteHost(node.data.name, containerManagerUrl);
      } else if (node.type === 'network') {
        result = await topologyService.deleteNetwork(selectedTopologyName, node.data.name, containerManagerUrl);
      } else if (node.type === 'external_node') {
        result = await topologyService.deleteExternalNode(selectedTopologyName, node.data.name, containerManagerUrl);
      }

      if (result && !result.success) {
        throw new Error(result.error || `Failed to delete ${node.type}`);
      }

      // Remove from canvas
      onNodesChange(canvasNodes.filter(n => n.id !== nodeId));

      await loadTopologyDetails(selectedTopologyName);
      await refetchConfig();
    } catch (error) {
      console.error(`Failed to delete ${node.type} ${node.data.name}:`, error);
      throw error;
    }
  }, [canvasNodes, selectedTopologyName, containerManagerUrl, onNodesChange, loadTopologyDetails, refetchConfig]);

  // Link operations
  const handleDeleteLink = useCallback(async (linkId: string) => {
    const link = canvasLinks.find(l => l.id === linkId);
    if (!link || !selectedTopologyName) return;

    try {
      if (link.type === 'bgp') {
        const sourceNode = canvasNodes.find(n => n.id === link.source);
        const targetNode = canvasNodes.find(n => n.id === link.target);

        if (sourceNode && targetNode) {
          const result = await topologyService.deleteBGPPeer(
            selectedTopologyName,
            sourceNode.data.name,
            targetNode.data.name,
            containerManagerUrl
          );

          if (!result.success) {
            throw new Error(result.error || 'Failed to delete BGP peer');
          }
        }
      } else if (link.type === 'gre') {
        // For GRE tunnels, we need to delete both tunnel records (source and reciprocal)
        const greTunnel = link.data;
        if (greTunnel && greTunnel.container_name && greTunnel.tunnel_name &&
            greTunnel.reciprocalContainerName && greTunnel.reciprocalTunnelName) {
          // Delete both tunnels using container_name and tunnel_name
          const result1 = await topologyService.deleteGreTunnelByName(
            greTunnel.container_name,
            greTunnel.tunnel_name,
            containerManagerUrl
          );
          const result2 = await topologyService.deleteGreTunnelByName(
            greTunnel.reciprocalContainerName,
            greTunnel.reciprocalTunnelName,
            containerManagerUrl
          );

          if (!result1.success || !result2.success) {
            throw new Error(result1.error || result2.error || 'Failed to delete GRE tunnel');
          }
        }
      }

      onLinksChange(canvasLinks.filter(l => l.id !== linkId));
      await loadTopologyDetails(selectedTopologyName);
    } catch (error) {
      console.error('Failed to delete link:', error);
      throw error;
    }
  }, [canvasLinks, canvasNodes, selectedTopologyName, containerManagerUrl, onLinksChange, loadTopologyDetails]);

  // Position save
  const handleNodeDragEnd = useCallback(async (nodeId: string, position: { x: number; y: number }) => {
    if (!selectedTopologyName) return;

    const node = canvasNodes.find(n => n.id === nodeId);
    if (!node) return;

    try {
      console.log(`[handleNodeDragEnd] Saving position for ${node.type} '${node.data.name}':`, { x: position.x, y: position.y });

      let result;
      if (node.type === 'daemon') {
        result = await topologyService.updateDaemonPosition(
          selectedTopologyName,
          node.data.name,
          position.x,
          position.y,
          containerManagerUrl
        );
      } else if (node.type === 'host') {
        result = await topologyService.updateHostPosition(
          selectedTopologyName,
          node.data.name,
          position.x,
          position.y,
          containerManagerUrl
        );
      } else if (node.type === 'network') {
        result = await topologyService.updateNetworkPosition(
          selectedTopologyName,
          node.data.name,
          position.x,
          position.y,
          containerManagerUrl
        );
      } else if (node.type === 'external_node') {
        result = await topologyService.updateExternalNodePosition(
          selectedTopologyName,
          node.data.name,
          position.x,
          position.y,
          containerManagerUrl
        );
      }

      if (result && !result.success) {
        throw new Error(result.error || 'Failed to save position');
      }

      console.log(`[handleNodeDragEnd] ✓ Position saved for ${node.type} '${node.data.name}'`);
      // Note: We intentionally do NOT refetch topology details here.
      // The local state already has the correct position, and refetching
      // can cause the node to jump back due to race conditions or caching.
    } catch (error) {
      console.error('Failed to save node position:', error);
    }
  }, [canvasNodes, selectedTopologyName, containerManagerUrl]);

  // Daemon save
  const handleSaveDaemon = useCallback(async (daemonData: any, editingDaemonName: string | null) => {
    if (!selectedTopologyName) throw new Error('No topology selected');

    const method = editingDaemonName ? 'PUT' : 'POST';
    const endpoint = editingDaemonName
      ? `/topologies/${selectedTopologyName}/daemons/${editingDaemonName}`
      : `/topologies/${selectedTopologyName}/daemons`;

    await fetchWrapper(`${containerManagerUrl}${endpoint}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(daemonData)
    });

    await loadTopologyDetails(selectedTopologyName);
    await refetchConfig();
  }, [selectedTopologyName, containerManagerUrl, loadTopologyDetails, refetchConfig]);

  // Host save
  const handleSaveHost = useCallback(async (hostData: any, editingHostName: string | null) => {
    if (!selectedTopologyName) throw new Error('No topology selected');

    if (editingHostName) {
      // Update existing host via /hosts/{name} PATCH endpoint
      await fetchWrapper(`${containerManagerUrl}/hosts/${editingHostName}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hostData)
      });
    } else {
      // Create new host via topology endpoint
      await fetchWrapper(`${containerManagerUrl}/topologies/${selectedTopologyName}/hosts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hostData)
      });
    }

    await loadTopologyDetails(selectedTopologyName);
    await refetchConfig();
  }, [selectedTopologyName, containerManagerUrl, loadTopologyDetails, refetchConfig]);

  // Trigger save - saves to topology database via container manager API
  // If editingTriggerId is provided, updates existing trigger; otherwise creates new
  const handleSubmitTrigger = useCallback(async (triggerData: Trigger, editingTriggerId?: string | number | null) => {
    console.log('[handleSubmitTrigger] Called with:', {
      triggerData,
      editingTriggerId,
      selectedTopologyName,
      containerManagerUrl
    });

    if (!selectedTopologyName) {
      throw new Error('No topology selected');
    }

    const payload = {
      name: triggerData.name,
      enabled: triggerData.enabled,
      min_kbps: triggerData.conditions?.min_kbps?.toString(),
      min_mbps: triggerData.conditions?.min_mbps?.toString(),
      min_pps: triggerData.conditions?.min_pps?.toString(),
      min_bytes: triggerData.conditions?.min_bytes?.toString(),
      src_addr: triggerData.conditions?.src_addr,
      dst_addr: triggerData.conditions?.dst_addr,
      src_or_dst_addr: triggerData.conditions?.src_or_dst_addr,
      protocol: triggerData.conditions?.protocol?.toString(),
      action_type: triggerData.action?.type || 'log',
      action_message: triggerData.action?.message,
      rate_limit_kbps: triggerData.action?.rate_limit_kbps?.toString()
    };

    console.log('[handleSubmitTrigger] Payload:', payload);

    if (editingTriggerId) {
      // Update existing trigger
      const url = `${containerManagerUrl}/topologies/${selectedTopologyName}/triggers/${editingTriggerId}`;
      console.log('[handleSubmitTrigger] PUT to:', url);
      await fetchWrapper(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      // Create new trigger
      const url = `${containerManagerUrl}/topologies/${selectedTopologyName}/triggers`;
      console.log('[handleSubmitTrigger] POST to:', url);
      await fetchWrapper(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    console.log('[handleSubmitTrigger] Success, refreshing topology details');
    // Refresh topology details to show updated trigger
    await loadTopologyDetails(selectedTopologyName);
  }, [selectedTopologyName, containerManagerUrl, loadTopologyDetails]);

  return {
    // State
    appConfig,
    topologies,
    activeTopology,
    topologyDetails,
    isLoadingTopologies,
    isLoadingDetails,
    isActivating,
    error,
    detailsError,
    successMessage,
    labFeedback,
    daemonsWithInterfaces,
    monitoring,

    // Operations
    loadTopologies,
    loadTopologyDetails,
    createTopology: createBackendTopology,
    activateTopology: activateBackendTopology,
    deleteTopology: deleteBackendTopology,
    clearErrors,
    clearSuccess,
    clearLabFeedback,
    refetchConfig,
    handleAddNetwork,
    handleDeleteNode,
    handleDeleteLink,
    handleNodeDragEnd,
    handleSaveDaemon,
    handleSaveHost,
    handleSubmitTrigger
  };
};
