/**
 * Topology Canvas State Management Hook
 * Manages nodes, links, networks, and canvas interactions
 */

import { useState, useCallback } from 'react';
import { TopologyNode, TopologyLink, TopologyNetwork, InteractionMode } from '../types/topology';
import { isDuplicateNode } from '../utils/topologyUtils';

export const useTopologyCanvas = () => {
  // Canvas state
  const [nodes, setNodes] = useState<TopologyNode[]>([]);
  const [links, setLinks] = useState<TopologyLink[]>([]);
  const [networks, setNetworks] = useState<TopologyNetwork[]>([]);

  // Selection state
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedLink, setSelectedLink] = useState<string | null>(null);
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);

  // Interaction state
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('select');
  const [firstSelectedForLink, setFirstSelectedForLink] = useState<string | null>(null);

  // Node operations
  const addNode = useCallback((node: TopologyNode) => {
    if (isDuplicateNode(nodes, node.type, node.data)) {
      return { success: false, error: `This ${node.type} is already on the topology. Cannot add duplicates.` };
    }
    setNodes(prev => [...prev, node]);
    return { success: true };
  }, [nodes]);

  const deleteNode = useCallback((nodeId: string) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setLinks(prev => prev.filter(l => l.source !== nodeId && l.target !== nodeId));
    if (selectedNode === nodeId) setSelectedNode(null);
  }, [selectedNode]);

  const updateNodePosition = useCallback((nodeId: string, position: { x: number; y: number }) => {
    setNodes(prev => prev.map(node =>
      node.id === nodeId ? { ...node, position } : node
    ));
  }, []);

  // Link operations
  const addLink = useCallback((link: TopologyLink) => {
    setLinks(prev => [...prev, link]);
  }, []);

  const deleteLink = useCallback((linkId: string) => {
    setLinks(prev => prev.filter(l => l.id !== linkId));
    if (selectedLink === linkId) setSelectedLink(null);
  }, [selectedLink]);

  const updateLinkArc = useCallback((linkId: string, arc: number) => {
    setLinks(prev => prev.map(link =>
      link.id === linkId ? { ...link, arc } : link
    ));
  }, []);

  // Network operations
  const addNetwork = useCallback((network: TopologyNetwork) => {
    setNetworks(prev => [...prev, network]);
  }, []);

  // Clear all
  const clearTopology = useCallback(() => {
    setNodes([]);
    setLinks([]);
    setNetworks([]);
    setSelectedNode(null);
    setSelectedLink(null);
    setFirstSelectedForLink(null);
  }, []);

  // Mode operations
  const changeMode = useCallback((mode: InteractionMode) => {
    setInteractionMode(mode);
    setFirstSelectedForLink(null);
    setSelectedLink(null);
  }, []);

  // Save/Load operations
  const saveTopologyToStorage = useCallback((name: string) => {
    const topology = {
      nodes,
      links,
      networks,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem(`topology-${name}`, JSON.stringify(topology));
  }, [nodes, links, networks]);

  const loadTopologyFromStorage = useCallback((name: string) => {
    const saved = localStorage.getItem(`topology-${name}`);
    if (saved) {
      const topology = JSON.parse(saved);
      setNodes(topology.nodes || []);
      setLinks(topology.links || []);
      setNetworks(topology.networks || []);
      return true;
    }
    return false;
  }, []);

  const getSavedTopologies = useCallback((): string[] => {
    const saved: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('topology-')) {
        saved.push(key.replace('topology-', ''));
      }
    }
    return saved;
  }, []);

  const deleteStoredTopology = useCallback((name: string) => {
    localStorage.removeItem(`topology-${name}`);
  }, []);

  // Find node/link helpers
  const findNode = useCallback((nodeId: string) => {
    return nodes.find(n => n.id === nodeId);
  }, [nodes]);

  const findLink = useCallback((linkId: string) => {
    return links.find(l => l.id === linkId);
  }, [links]);

  return {
    // State
    nodes,
    links,
    networks,
    selectedNode,
    hoveredNode,
    selectedLink,
    hoveredLink,
    interactionMode,
    firstSelectedForLink,

    // Setters (for direct state manipulation)
    setNodes,
    setLinks,
    setNetworks,
    setSelectedNode,
    setHoveredNode,
    setSelectedLink,
    setHoveredLink,
    setFirstSelectedForLink,

    // Actions
    addNode,
    deleteNode,
    updateNodePosition,
    addLink,
    deleteLink,
    updateLinkArc,
    addNetwork,
    clearTopology,
    changeMode,

    // Storage operations
    saveTopologyToStorage,
    loadTopologyFromStorage,
    getSavedTopologies,
    deleteStoredTopology,

    // Helpers
    findNode,
    findLink
  };
};
