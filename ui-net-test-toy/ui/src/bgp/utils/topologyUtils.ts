/**
 * Topology Builder Utilities
 * Pure functions for topology visualization and layout
 */

import { TopologyNode, TopologyNetwork, InteractionMode } from '../types/topology';

// ===========================
// Color Utilities
// ===========================

/**
 * Get daemon color based on type
 * Re-exported from colorPalette for backwards compatibility
 */
export { getDaemonColor, getDefaultColor, COLOR_PALETTE, DEFAULT_COLORS } from './colorPalette';

// ===========================
// Layout Utilities
// ===========================

/**
 * Auto-layout algorithm for topology nodes
 * Positions networks at top, daemons in middle, hosts at bottom
 */
export const autoLayoutNodes = (
  nodes: TopologyNode[],
  canvasWidth: number,
  canvasHeight: number
): TopologyNode[] => {
  const nodesCopy = [...nodes];
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;

  // Separate nodes by type
  const networkNodes = nodesCopy.filter(n => n.type === 'network');
  const daemonNodes = nodesCopy.filter(n => n.type === 'daemon');
  const hostNodes = nodesCopy.filter(n => n.type === 'host');
  const externalNodes = nodesCopy.filter(n => n.type === 'external_node');

  // Position networks at the top
  networkNodes.forEach((network, index) => {
    network.position = {
      x: (canvasWidth / (networkNodes.length + 1)) * (index + 1),
      y: 100
    };
  });

  // Position daemons in the middle-left
  daemonNodes.forEach((daemon, index) => {
    daemon.position = {
      x: (canvasWidth / (daemonNodes.length + 1)) * (index + 1),
      y: centerY
    };
  });

  // Position external nodes on the right side
  externalNodes.forEach((externalNode, index) => {
    externalNode.position = {
      x: canvasWidth - 150,
      y: 150 + (index * 120)
    };
  });

  // Position hosts at the bottom
  hostNodes.forEach((host, index) => {
    host.position = {
      x: (canvasWidth / (hostNodes.length + 1)) * (index + 1),
      y: canvasHeight - 150
    };
  });

  return nodesCopy;
};

// ===========================
// Network Utilities
// ===========================

/**
 * Get common networks between two nodes
 */
export const getCommonNetworks = (
  sourceNode: TopologyNode | undefined,
  targetNode: TopologyNode | undefined
): string[] => {
  if (!sourceNode || !targetNode) return [];

  const sourceNetworks = (sourceNode.data.networks || []).map((n: any) =>
    typeof n === 'string' ? n : n.name
  );
  const targetNetworks = (targetNode.data.networks || []).map((n: any) =>
    typeof n === 'string' ? n : n.name
  );

  return sourceNetworks.filter((net: string) => targetNetworks.includes(net));
};

/**
 * Get all available networks from various sources
 */
export const getAllAvailableNetworks = (
  topologyNetworks: TopologyNetwork[],
  canvasNodes: TopologyNode[],
  topologyDetailsNetworks?: any[]
): string[] => {
  const allNetworks = new Set<string>();

  // Add networks from topology details
  if (topologyDetailsNetworks) {
    topologyDetailsNetworks.forEach((net: any) => allNetworks.add(net.name));
  }

  // Add local networks from state
  topologyNetworks.forEach(net => allNetworks.add(net.name));

  // Add networks from nodes on canvas
  canvasNodes.filter(n => n.type === 'network').forEach(n => allNetworks.add(n.label));

  return Array.from(allNetworks);
};

/**
 * Get networks from a specific node's data
 */
export const getNodeNetworks = (node: TopologyNode | undefined): string[] => {
  if (!node) return [];

  return (node.data.networks || []).map((n: any) =>
    typeof n === 'string' ? n : n.name
  );
};

// ===========================
// Node Style Utilities
// ===========================

export interface NodeStyleOptions {
  isSelected: boolean;
  isHovered: boolean;
  isFirstSelected: boolean;
  interactionMode: InteractionMode;
}

/**
 * Calculate node style based on state
 */
export const getNodeStyle = (
  node: TopologyNode,
  options: NodeStyleOptions
): React.CSSProperties => {
  const { isSelected, isHovered, isFirstSelected, interactionMode } = options;

  // Network nodes are smaller (80x40), others are 100x70
  const isNetwork = node.type === 'network';
  const halfWidth = isNetwork ? 40 : 50;
  const halfHeight = isNetwork ? 20 : 35;

  return {
    position: 'absolute',
    left: node.position.x - halfWidth,
    top: node.position.y - halfHeight,
    width: isNetwork ? '80px' : '100px',
    height: isNetwork ? '40px' : '70px',
    backgroundColor: node.color || (
      node.type === 'daemon' ? '#2196F3' :
      node.type === 'host' ? '#4CAF50' :
      node.type === 'external_node' ? '#FF5722' :
      '#9C27B0'
    ),
    border: `3px solid ${
      isFirstSelected ? '#FF9800' :
      isSelected ? '#FFC107' :
      isHovered ? 'rgba(255,255,255,0.8)' :
      'rgba(255,255,255,0.3)'
    }`,
    borderRadius: node.type === 'network' ? '4px' :
                  node.type === 'daemon' ? '8px' :
                  node.type === 'external_node' ? '8px' :
                  '50%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: interactionMode === 'select' ? 'move' : 'pointer',
    userSelect: 'none',
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'white',
    boxShadow: isHovered || isSelected ? '0 6px 20px rgba(0,0,0,0.3)' : '0 3px 10px rgba(0,0,0,0.2)',
    transition: 'all 0.2s',
    zIndex: isSelected ? 10 : 1
  };
};

// ===========================
// Validation Utilities
// ===========================

/**
 * Check if a node is a duplicate
 */
export const isDuplicateNode = (
  nodes: TopologyNode[],
  nodeType: 'daemon' | 'host' | 'network',
  nodeData: any
): boolean => {
  return nodes.some(node =>
    node.type === nodeType &&
    node.data.id === nodeData.id &&
    node.data.name === nodeData.name
  );
};
