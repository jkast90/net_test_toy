/**
 * Topology Mutations
 * Centralized mutation functions for topology operations
 */

import { topologyService } from './topologyService';
import {
  TopologyDefinition,
  TopologyNode,
  TopologyEdge,
  TopologyDiscovery,
  TopologyValidation,
  TopologySimulation,
  TopologySnapshot,
  TopologyMutationResult,
  TopologyLayout,
  TopologyExportOptions,
  TopologyFilter
} from './types';

/**
 * Topology Management Mutations
 */
export const topologyManagementMutations = {
  /**
   * Create a new topology from scratch
   */
  async createEmpty(name: string, description?: string, clientUrl?: string): Promise<TopologyMutationResult<TopologyDefinition>> {
    try {
      const topology: Partial<TopologyDefinition> = {
        name,
        description,
        nodes: [],
        edges: [],
        metadata: {
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          source: 'manual',
          version: '1.0.0'
        }
      };

      return await topologyService.createTopology(topology, clientUrl);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create empty topology',
        timestamp: new Date().toISOString()
      };
    }
  },

  /**
   * Create topology from discovery
   */
  async createFromDiscovery(discoveryId: string, name?: string, clientUrl?: string): Promise<TopologyMutationResult<TopologyDefinition>> {
    try {
      // First get the discovery results
      const discoveries = await topologyService.getDiscoveryHistory(1, clientUrl);
      const discovery = discoveries.find(d => d.id === discoveryId);

      if (!discovery) {
        throw new Error('Discovery not found');
      }

      const topology: Partial<TopologyDefinition> = {
        name: name || `Topology from ${discovery.method} discovery`,
        description: `Created from discovery ${discoveryId}`,
        nodes: discovery.discovered_nodes || [],
        edges: discovery.discovered_edges || [],
        metadata: {
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          source: 'discovery',
          discovery_id: discoveryId,
          version: '1.0.0'
        }
      };

      return await topologyService.createTopology(topology, clientUrl);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create topology from discovery',
        timestamp: new Date().toISOString()
      };
    }
  },

  /**
   * Merge multiple topologies
   */
  async mergeTopologies(
    topologyIds: string[],
    name: string,
    strategy: 'union' | 'intersection' = 'union',
    clientUrl?: string
  ): Promise<TopologyMutationResult<TopologyDefinition>> {
    try {
      const topologies = await Promise.all(
        topologyIds.map(id => topologyService.getTopology(id, clientUrl))
      );

      const mergedNodes: TopologyNode[] = [];
      const mergedEdges: TopologyEdge[] = [];
      const nodeIdMap = new Map<string, TopologyNode>();
      const edgeIdMap = new Map<string, TopologyEdge>();

      if (strategy === 'union') {
        // Union: Include all nodes and edges
        topologies.forEach(topology => {
          if (topology) {
            topology.nodes.forEach(node => {
              if (!nodeIdMap.has(node.id)) {
                nodeIdMap.set(node.id, node);
                mergedNodes.push(node);
              }
            });

            topology.edges.forEach(edge => {
              const edgeKey = `${edge.source}-${edge.target}`;
              if (!edgeIdMap.has(edgeKey)) {
                edgeIdMap.set(edgeKey, edge);
                mergedEdges.push(edge);
              }
            });
          }
        });
      } else {
        // Intersection: Only include nodes/edges present in all topologies
        if (topologies.length > 0 && topologies[0]) {
          topologies[0].nodes.forEach(node => {
            if (topologies.every(t => t?.nodes.some(n => n.id === node.id))) {
              mergedNodes.push(node);
            }
          });

          topologies[0].edges.forEach(edge => {
            if (topologies.every(t => t?.edges.some(e =>
              e.source === edge.source && e.target === edge.target
            ))) {
              mergedEdges.push(edge);
            }
          });
        }
      }

      const mergedTopology: Partial<TopologyDefinition> = {
        name,
        description: `Merged from ${topologyIds.length} topologies (${strategy})`,
        nodes: mergedNodes,
        edges: mergedEdges,
        metadata: {
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          source: 'merge',
          merge_strategy: strategy,
          source_topologies: topologyIds,
          version: '1.0.0'
        }
      };

      return await topologyService.createTopology(mergedTopology, clientUrl);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to merge topologies',
        timestamp: new Date().toISOString()
      };
    }
  },

  /**
   * Clone an existing topology
   */
  async clone(topologyId: string, newName: string, clientUrl?: string): Promise<TopologyMutationResult<TopologyDefinition>> {
    try {
      const original = await topologyService.getTopology(topologyId, clientUrl);
      if (!original) {
        throw new Error('Original topology not found');
      }

      const cloned: Partial<TopologyDefinition> = {
        ...original,
        id: undefined, // Let the backend generate a new ID
        name: newName,
        description: `Clone of ${original.name}`,
        metadata: {
          ...original.metadata,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          source: 'clone',
          original_topology_id: topologyId
        }
      };

      return await topologyService.createTopology(cloned, clientUrl);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clone topology',
        timestamp: new Date().toISOString()
      };
    }
  }
};

/**
 * Node Management Mutations
 */
export const topologyNodeMutations = {
  /**
   * Add a new node to the topology
   */
  async addNode(
    topologyId: string,
    node: Omit<TopologyNode, 'id'>,
    clientUrl?: string
  ): Promise<TopologyMutationResult<TopologyDefinition>> {
    try {
      const topology = await topologyService.getTopology(topologyId, clientUrl);
      if (!topology) {
        throw new Error('Topology not found');
      }

      const newNode: TopologyNode = {
        ...node,
        id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };

      const updated = {
        nodes: [...topology.nodes, newNode]
      };

      return await topologyService.updateTopology(topologyId, updated, clientUrl);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add node',
        timestamp: new Date().toISOString()
      };
    }
  },

  /**
   * Update an existing node
   */
  async updateNode(
    topologyId: string,
    nodeId: string,
    updates: Partial<TopologyNode>,
    clientUrl?: string
  ): Promise<TopologyMutationResult<TopologyDefinition>> {
    try {
      const topology = await topologyService.getTopology(topologyId, clientUrl);
      if (!topology) {
        throw new Error('Topology not found');
      }

      const updatedNodes = topology.nodes.map(node =>
        node.id === nodeId ? { ...node, ...updates, id: nodeId } : node
      );

      return await topologyService.updateTopology(topologyId, { nodes: updatedNodes }, clientUrl);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update node',
        timestamp: new Date().toISOString()
      };
    }
  },

  /**
   * Remove a node and its connected edges
   */
  async removeNode(
    topologyId: string,
    nodeId: string,
    clientUrl?: string
  ): Promise<TopologyMutationResult<TopologyDefinition>> {
    try {
      const topology = await topologyService.getTopology(topologyId, clientUrl);
      if (!topology) {
        throw new Error('Topology not found');
      }

      const updatedNodes = topology.nodes.filter(node => node.id !== nodeId);
      const updatedEdges = topology.edges.filter(
        edge => edge.source !== nodeId && edge.target !== nodeId
      );

      return await topologyService.updateTopology(
        topologyId,
        { nodes: updatedNodes, edges: updatedEdges },
        clientUrl
      );
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove node',
        timestamp: new Date().toISOString()
      };
    }
  },

  /**
   * Batch add multiple nodes
   */
  async addMultipleNodes(
    topologyId: string,
    nodes: Array<Omit<TopologyNode, 'id'>>,
    clientUrl?: string
  ): Promise<TopologyMutationResult<TopologyDefinition>> {
    try {
      const topology = await topologyService.getTopology(topologyId, clientUrl);
      if (!topology) {
        throw new Error('Topology not found');
      }

      const newNodes = nodes.map((node, index) => ({
        ...node,
        id: `node-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`
      }));

      const updated = {
        nodes: [...topology.nodes, ...newNodes]
      };

      return await topologyService.updateTopology(topologyId, updated, clientUrl);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add multiple nodes',
        timestamp: new Date().toISOString()
      };
    }
  }
};

/**
 * Edge Management Mutations
 */
export const topologyEdgeMutations = {
  /**
   * Add a new edge to the topology
   */
  async addEdge(
    topologyId: string,
    edge: Omit<TopologyEdge, 'id'>,
    clientUrl?: string
  ): Promise<TopologyMutationResult<TopologyDefinition>> {
    try {
      const topology = await topologyService.getTopology(topologyId, clientUrl);
      if (!topology) {
        throw new Error('Topology not found');
      }

      // Validate that both nodes exist
      const sourceExists = topology.nodes.some(n => n.id === edge.source);
      const targetExists = topology.nodes.some(n => n.id === edge.target);

      if (!sourceExists || !targetExists) {
        throw new Error('Source or target node does not exist');
      }

      const newEdge: TopologyEdge = {
        ...edge,
        id: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };

      const updated = {
        edges: [...topology.edges, newEdge]
      };

      return await topologyService.updateTopology(topologyId, updated, clientUrl);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add edge',
        timestamp: new Date().toISOString()
      };
    }
  },

  /**
   * Update an existing edge
   */
  async updateEdge(
    topologyId: string,
    edgeId: string,
    updates: Partial<TopologyEdge>,
    clientUrl?: string
  ): Promise<TopologyMutationResult<TopologyDefinition>> {
    try {
      const topology = await topologyService.getTopology(topologyId, clientUrl);
      if (!topology) {
        throw new Error('Topology not found');
      }

      const updatedEdges = topology.edges.map(edge =>
        edge.id === edgeId ? { ...edge, ...updates, id: edgeId } : edge
      );

      return await topologyService.updateTopology(topologyId, { edges: updatedEdges }, clientUrl);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update edge',
        timestamp: new Date().toISOString()
      };
    }
  },

  /**
   * Remove an edge
   */
  async removeEdge(
    topologyId: string,
    edgeId: string,
    clientUrl?: string
  ): Promise<TopologyMutationResult<TopologyDefinition>> {
    try {
      const topology = await topologyService.getTopology(topologyId, clientUrl);
      if (!topology) {
        throw new Error('Topology not found');
      }

      const updatedEdges = topology.edges.filter(edge => edge.id !== edgeId);

      return await topologyService.updateTopology(topologyId, { edges: updatedEdges }, clientUrl);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove edge',
        timestamp: new Date().toISOString()
      };
    }
  },

  /**
   * Batch add multiple edges
   */
  async addMultipleEdges(
    topologyId: string,
    edges: Array<Omit<TopologyEdge, 'id'>>,
    clientUrl?: string
  ): Promise<TopologyMutationResult<TopologyDefinition>> {
    try {
      const topology = await topologyService.getTopology(topologyId, clientUrl);
      if (!topology) {
        throw new Error('Topology not found');
      }

      const newEdges = edges.map((edge, index) => ({
        ...edge,
        id: `edge-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`
      }));

      const updated = {
        edges: [...topology.edges, ...newEdges]
      };

      return await topologyService.updateTopology(topologyId, updated, clientUrl);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add multiple edges',
        timestamp: new Date().toISOString()
      };
    }
  }
};

/**
 * Discovery Mutations
 */
export const topologyDiscoveryMutations = {
  /**
   * Run container-based discovery
   */
  async discoverContainers(clientUrl?: string): Promise<TopologyMutationResult<TopologyDiscovery>> {
    try {
      return await topologyService.runDiscovery('container', {}, clientUrl);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to discover containers',
        timestamp: new Date().toISOString()
      };
    }
  },

  /**
   * Run BGP-based discovery
   */
  async discoverBGP(clientUrl?: string): Promise<TopologyMutationResult<TopologyDiscovery>> {
    try {
      return await topologyService.runDiscovery('bgp', {}, clientUrl);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to discover BGP topology',
        timestamp: new Date().toISOString()
      };
    }
  },

  /**
   * Run LLDP-based discovery
   */
  async discoverLLDP(interfaces?: string[], clientUrl?: string): Promise<TopologyMutationResult<TopologyDiscovery>> {
    try {
      return await topologyService.runDiscovery('lldp', { interfaces }, clientUrl);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to discover LLDP neighbors',
        timestamp: new Date().toISOString()
      };
    }
  },

  /**
   * Run network scan discovery
   */
  async discoverNetwork(subnet: string, clientUrl?: string): Promise<TopologyMutationResult<TopologyDiscovery>> {
    try {
      return await topologyService.runDiscovery('network_scan', { subnet }, clientUrl);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to scan network',
        timestamp: new Date().toISOString()
      };
    }
  }
};

/**
 * Visualization Mutations
 */
export const topologyVisualizationMutations = {
  /**
   * Generate visualization with auto-layout
   */
  async autoLayout(
    topologyId?: string,
    preferredLayout?: TopologyLayout,
    clientUrl?: string
  ): Promise<TopologyMutationResult> {
    try {
      const result = await topologyService.generateVisualization(
        topologyId,
        preferredLayout,
        { auto_layout: true },
        clientUrl
      );

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to auto-layout topology',
        timestamp: new Date().toISOString()
      };
    }
  },

  /**
   * Apply physics simulation to layout
   */
  async applyPhysics(
    topologyId?: string,
    iterations: number = 100,
    clientUrl?: string
  ): Promise<TopologyMutationResult> {
    try {
      const result = await topologyService.generateVisualization(
        topologyId,
        'force-directed',
        { iterations, physics: true },
        clientUrl
      );

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to apply physics simulation',
        timestamp: new Date().toISOString()
      };
    }
  },

  /**
   * Export visualization as image
   */
  async exportAsImage(
    format: 'png' | 'svg' | 'pdf',
    topologyId?: string,
    clientUrl?: string
  ): Promise<TopologyMutationResult<Blob>> {
    try {
      const options: TopologyExportOptions = {
        include_positions: true,
        include_styles: true,
        image_format: format
      };

      const blob = await topologyService.exportTopology('json', options, clientUrl);

      return {
        success: true,
        data: blob,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export visualization',
        timestamp: new Date().toISOString()
      };
    }
  }
};

/**
 * Multi-client Mutations
 */
export const topologyMultiClientMutations = {
  /**
   * Discover topology on multiple clients
   */
  async discoverOnMultiple(
    clientUrls: string[],
    method: TopologyDiscovery['method'],
    options?: any
  ): Promise<Record<string, TopologyMutationResult<TopologyDiscovery>>> {
    const results: Record<string, TopologyMutationResult<TopologyDiscovery>> = {};

    await Promise.all(
      clientUrls.map(async (url) => {
        results[url] = await topologyService.runDiscovery(method, options, url);
      })
    );

    return results;
  },

  /**
   * Validate topology on multiple clients
   */
  async validateOnMultiple(
    clientUrls: string[],
    topologyId?: string
  ): Promise<Record<string, TopologyMutationResult<TopologyValidation>>> {
    const results: Record<string, TopologyMutationResult<TopologyValidation>> = {};

    await Promise.all(
      clientUrls.map(async (url) => {
        results[url] = await topologyService.validateTopology(topologyId, url);
      })
    );

    return results;
  },

  /**
   * Create snapshot on multiple clients
   */
  async snapshotOnMultiple(
    clientUrls: string[],
    name: string,
    description?: string
  ): Promise<Record<string, TopologyMutationResult<TopologySnapshot>>> {
    const results: Record<string, TopologyMutationResult<TopologySnapshot>> = {};

    await Promise.all(
      clientUrls.map(async (url) => {
        results[url] = await topologyService.createSnapshot(name, description, url);
      })
    );

    return results;
  }
};

// Export all mutations
export const topologyMutations = {
  management: topologyManagementMutations,
  nodes: topologyNodeMutations,
  edges: topologyEdgeMutations,
  discovery: topologyDiscoveryMutations,
  visualization: topologyVisualizationMutations,
  multiClient: topologyMultiClientMutations
};

export default topologyMutations;