/**
 * Topology Hooks
 * Custom React hooks for topology operations
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store/store';
import {
  fetchTopology,
  createTopology,
  updateTopology,
  deleteTopology,
  runDiscovery,
  getDiscoveryHistory,
  validateTopology,
  getValidationHistory,
  generateVisualization,
  createSnapshot,
  getSnapshots,
  restoreSnapshot,
  compareTopologies,
  startSimulation,
  stopSimulation,
  exportTopology,
  importTopology,
  fetchMultiClientTopologies,
  setSelectedNodes,
  addSelectedNode,
  removeSelectedNode,
  setSelectedEdges,
  addSelectedEdge,
  removeSelectedEdge,
  setFilter,
  setLayout,
  setWsConnected,
  setWsAutoReconnect,
  clearErrors,
  clearTopologyData,
  resetState,
  handleTopologyUpdate,
  handleDiscoveryUpdate,
  handleValidationUpdate,
  handleSimulationUpdate
} from '../store/slices/topologySlice';
import { topologyMutations } from '../services/topology/topologyMutations';
import {
  TopologyDefinition,
  TopologyNode,
  TopologyEdge,
  TopologyFilter,
  TopologyLayout,
  TopologyDiscovery,
  TopologyValidation,
  TopologySimulation
} from '../services/topology/types';

/**
 * Main topology hook
 * Provides comprehensive topology management functionality
 */
export function useTopology(clientUrl?: string) {
  const dispatch = useDispatch<AppDispatch>();
  const topologyState = useSelector((state: RootState) => state.topology);

  // Fetch operations
  const loadTopology = useCallback(
    (topologyId?: string) => {
      return dispatch(fetchTopology({ topologyId, clientUrl }));
    },
    [dispatch, clientUrl]
  );

  const loadMultiClientTopologies = useCallback(
    (clientUrls: string[]) => {
      return dispatch(fetchMultiClientTopologies({ clientUrls }));
    },
    [dispatch]
  );

  // CRUD operations
  const create = useCallback(
    (topology: Partial<TopologyDefinition>) => {
      return dispatch(createTopology({ topology, clientUrl }));
    },
    [dispatch, clientUrl]
  );

  const update = useCallback(
    (topologyId: string, updates: Partial<TopologyDefinition>) => {
      return dispatch(updateTopology({ topologyId, updates, clientUrl }));
    },
    [dispatch, clientUrl]
  );

  const remove = useCallback(
    (topologyId: string) => {
      return dispatch(deleteTopology({ topologyId, clientUrl }));
    },
    [dispatch, clientUrl]
  );

  // Discovery operations
  const discover = useCallback(
    (method: TopologyDiscovery['method'], options?: any) => {
      return dispatch(runDiscovery({ method, options, clientUrl }));
    },
    [dispatch, clientUrl]
  );

  const loadDiscoveryHistory = useCallback(
    (limit?: number) => {
      return dispatch(getDiscoveryHistory({ limit, clientUrl }));
    },
    [dispatch, clientUrl]
  );

  // Validation operations
  const validate = useCallback(
    (topologyId?: string) => {
      return dispatch(validateTopology({ topologyId, clientUrl }));
    },
    [dispatch, clientUrl]
  );

  const loadValidationHistory = useCallback(
    (topologyId: string) => {
      return dispatch(getValidationHistory({ topologyId, clientUrl }));
    },
    [dispatch, clientUrl]
  );

  // Visualization operations
  const visualize = useCallback(
    (topologyId?: string, layout?: TopologyLayout, options?: any) => {
      return dispatch(generateVisualization({ topologyId, layout, options, clientUrl }));
    },
    [dispatch, clientUrl]
  );

  // Snapshot operations
  const snapshot = useCallback(
    (name: string, description?: string) => {
      return dispatch(createSnapshot({ name, description, clientUrl }));
    },
    [dispatch, clientUrl]
  );

  const loadSnapshots = useCallback(
    () => {
      return dispatch(getSnapshots({ clientUrl }));
    },
    [dispatch, clientUrl]
  );

  const restore = useCallback(
    (snapshotId: string) => {
      return dispatch(restoreSnapshot({ snapshotId, clientUrl }));
    },
    [dispatch, clientUrl]
  );

  // Comparison operations
  const compare = useCallback(
    (topologyId1: string, topologyId2: string) => {
      return dispatch(compareTopologies({ topologyId1, topologyId2, clientUrl }));
    },
    [dispatch, clientUrl]
  );

  // Simulation operations
  const simulate = useCallback(
    (type: TopologySimulation['type'], parameters?: any) => {
      return dispatch(startSimulation({ type, parameters, clientUrl }));
    },
    [dispatch, clientUrl]
  );

  const stopSim = useCallback(
    (simulationId: string) => {
      return dispatch(stopSimulation({ simulationId, clientUrl }));
    },
    [dispatch, clientUrl]
  );

  // Export/Import operations
  const exportTopo = useCallback(
    (format: 'json' | 'graphml' | 'dot' | 'gml', options?: any) => {
      return dispatch(exportTopology({ format, options, clientUrl }));
    },
    [dispatch, clientUrl]
  );

  const importTopo = useCallback(
    (format: 'json' | 'graphml' | 'dot' | 'gml', data: string) => {
      return dispatch(importTopology({ format, data, clientUrl }));
    },
    [dispatch, clientUrl]
  );

  // Selection operations
  const selectNodes = useCallback(
    (nodeIds: string[]) => {
      dispatch(setSelectedNodes(nodeIds));
    },
    [dispatch]
  );

  const selectNode = useCallback(
    (nodeId: string) => {
      dispatch(addSelectedNode(nodeId));
    },
    [dispatch]
  );

  const deselectNode = useCallback(
    (nodeId: string) => {
      dispatch(removeSelectedNode(nodeId));
    },
    [dispatch]
  );

  const selectEdges = useCallback(
    (edgeIds: string[]) => {
      dispatch(setSelectedEdges(edgeIds));
    },
    [dispatch]
  );

  const selectEdge = useCallback(
    (edgeId: string) => {
      dispatch(addSelectedEdge(edgeId));
    },
    [dispatch]
  );

  const deselectEdge = useCallback(
    (edgeId: string) => {
      dispatch(removeSelectedEdge(edgeId));
    },
    [dispatch]
  );

  // Filter and layout
  const applyFilter = useCallback(
    (filter: TopologyFilter | null) => {
      dispatch(setFilter(filter));
    },
    [dispatch]
  );

  const changeLayout = useCallback(
    (layout: TopologyLayout) => {
      dispatch(setLayout(layout));
    },
    [dispatch]
  );

  // Clear operations
  const clear = useCallback(() => {
    dispatch(clearTopologyData());
  }, [dispatch]);

  const clearAllErrors = useCallback(() => {
    dispatch(clearErrors());
  }, [dispatch]);

  const reset = useCallback(() => {
    dispatch(resetState());
  }, [dispatch]);

  // Mutations
  const mutations = useMemo(
    () => topologyMutations,
    []
  );

  return {
    // State
    ...topologyState,

    // Operations
    loadTopology,
    loadMultiClientTopologies,
    create,
    update,
    remove,
    discover,
    loadDiscoveryHistory,
    validate,
    loadValidationHistory,
    visualize,
    snapshot,
    loadSnapshots,
    restore,
    compare,
    simulate,
    stopSim,
    exportTopo,
    importTopo,

    // Selection
    selectNodes,
    selectNode,
    deselectNode,
    selectEdges,
    selectEdge,
    deselectEdge,

    // UI
    applyFilter,
    changeLayout,

    // Utility
    clear,
    clearAllErrors,
    reset,

    // Mutations
    mutations
  };
}

/**
 * Hook for topology filtering
 * Provides client-side filtering of topology data
 */
export function useFilteredTopology(filter?: TopologyFilter) {
  const { currentTopology, filter: globalFilter } = useSelector((state: RootState) => state.topology);
  const activeFilter = filter || globalFilter;

  const filteredTopology = useMemo(() => {
    if (!currentTopology || !activeFilter) {
      return currentTopology;
    }

    const filtered: TopologyDefinition = {
      ...currentTopology,
      nodes: [],
      edges: []
    };

    // Filter nodes
    filtered.nodes = currentTopology.nodes.filter(node => {
      // Filter by type
      if (activeFilter.node_types && !activeFilter.node_types.includes(node.type)) {
        return false;
      }

      // Filter by status
      if (activeFilter.node_status && node.status !== activeFilter.node_status) {
        return false;
      }

      // Filter by tags
      if (activeFilter.tags && activeFilter.tags.length > 0) {
        const nodeTags = node.metadata?.tags as string[] || [];
        if (!activeFilter.tags.some(tag => nodeTags.includes(tag))) {
          return false;
        }
      }

      // Filter by search query
      if (activeFilter.search_query) {
        const query = activeFilter.search_query.toLowerCase();
        const searchFields = [
          node.name,
          node.label,
          node.description,
          node.type,
          JSON.stringify(node.metadata)
        ].filter(Boolean).join(' ').toLowerCase();

        if (!searchFields.includes(query)) {
          return false;
        }
      }

      return true;
    });

    // Get filtered node IDs
    const filteredNodeIds = new Set(filtered.nodes.map(n => n.id));

    // Filter edges (only include edges where both nodes are in filtered set)
    filtered.edges = currentTopology.edges.filter(edge => {
      // Check if both nodes exist
      if (!filteredNodeIds.has(edge.source) || !filteredNodeIds.has(edge.target)) {
        return activeFilter.include_orphan_edges || false;
      }

      // Filter by edge type
      if (activeFilter.edge_types && !activeFilter.edge_types.includes(edge.type)) {
        return false;
      }

      return true;
    });

    return filtered;
  }, [currentTopology, activeFilter]);

  return filteredTopology;
}

/**
 * Hook for topology WebSocket updates
 * Handles real-time topology changes
 */
export function useTopologyWebSocket(
  url?: string,
  autoConnect: boolean = true
) {
  const dispatch = useDispatch<AppDispatch>();
  const { wsConnected, wsAutoReconnect } = useSelector((state: RootState) => state.topology);
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    if (!autoConnect || !url) {
      return;
    }

    const connectWebSocket = () => {
      const websocket = new WebSocket(url);

      websocket.onopen = () => {
        console.log('Topology WebSocket connected');
        dispatch(setWsConnected(true));
      };

      websocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          switch (message.type) {
            case 'topology_update':
              dispatch(handleTopologyUpdate(message.data));
              break;
            case 'discovery_update':
              dispatch(handleDiscoveryUpdate(message.data));
              break;
            case 'validation_update':
              dispatch(handleValidationUpdate(message.data));
              break;
            case 'simulation_update':
              dispatch(handleSimulationUpdate(message.data));
              break;
            default:
              console.warn('Unknown topology WebSocket message type:', message.type);
          }
        } catch (error) {
          console.error('Failed to parse topology WebSocket message:', error);
        }
      };

      websocket.onerror = (error) => {
        console.error('Topology WebSocket error:', error);
      };

      websocket.onclose = () => {
        console.log('Topology WebSocket disconnected');
        dispatch(setWsConnected(false));
        setWs(null);

        // Auto-reconnect if enabled
        if (wsAutoReconnect) {
          setTimeout(connectWebSocket, 5000);
        }
      };

      setWs(websocket);
    };

    connectWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [url, autoConnect, wsAutoReconnect, dispatch]);

  const disconnect = useCallback(() => {
    if (ws) {
      dispatch(setWsAutoReconnect(false));
      ws.close();
      setWs(null);
    }
  }, [ws, dispatch]);

  const reconnect = useCallback(() => {
    disconnect();
    dispatch(setWsAutoReconnect(true));
  }, [disconnect, dispatch]);

  return {
    connected: wsConnected,
    disconnect,
    reconnect
  };
}

/**
 * Hook for topology visualization
 * Provides visualization-specific functionality
 */
export function useTopologyVisualization() {
  const dispatch = useDispatch<AppDispatch>();
  const { visualization, layout, loading } = useSelector((state: RootState) => state.topology);

  const updateLayout = useCallback(
    (newLayout: TopologyLayout) => {
      dispatch(setLayout(newLayout));
    },
    [dispatch]
  );

  const calculateNodePositions = useCallback(
    (nodes: TopologyNode[], edges: TopologyEdge[], layoutType?: TopologyLayout) => {
      const activeLayout = layoutType || layout;

      switch (activeLayout) {
        case 'force-directed':
          // Implement force-directed layout algorithm
          return nodes.map(node => ({
            ...node,
            position: { x: Math.random() * 800, y: Math.random() * 600 }
          }));

        case 'hierarchical':
          // Implement hierarchical layout algorithm
          const levels = new Map<string, number>();
          const visited = new Set<string>();

          // BFS to assign levels
          const queue: string[] = [];
          nodes.forEach(node => {
            if (!edges.some(e => e.target === node.id)) {
              queue.push(node.id);
              levels.set(node.id, 0);
              visited.add(node.id);
            }
          });

          while (queue.length > 0) {
            const current = queue.shift()!;
            const currentLevel = levels.get(current)!;

            edges.filter(e => e.source === current).forEach(edge => {
              if (!visited.has(edge.target)) {
                visited.add(edge.target);
                levels.set(edge.target, currentLevel + 1);
                queue.push(edge.target);
              }
            });
          }

          return nodes.map(node => {
            const level = levels.get(node.id) || 0;
            const nodesAtLevel = nodes.filter(n => levels.get(n.id) === level);
            const index = nodesAtLevel.findIndex(n => n.id === node.id);

            return {
              ...node,
              position: {
                x: (index + 1) * (800 / (nodesAtLevel.length + 1)),
                y: (level + 1) * 150
              }
            };
          });

        case 'circular':
          // Implement circular layout
          const radius = 250;
          const centerX = 400;
          const centerY = 300;
          const angleStep = (2 * Math.PI) / nodes.length;

          return nodes.map((node, index) => ({
            ...node,
            position: {
              x: centerX + radius * Math.cos(index * angleStep),
              y: centerY + radius * Math.sin(index * angleStep)
            }
          }));

        case 'grid':
          // Implement grid layout
          const columns = Math.ceil(Math.sqrt(nodes.length));
          const cellWidth = 800 / columns;
          const cellHeight = 600 / Math.ceil(nodes.length / columns);

          return nodes.map((node, index) => ({
            ...node,
            position: {
              x: (index % columns) * cellWidth + cellWidth / 2,
              y: Math.floor(index / columns) * cellHeight + cellHeight / 2
            }
          }));

        default:
          return nodes;
      }
    },
    [layout]
  );

  return {
    visualization,
    layout,
    loading: loading.visualization,
    updateLayout,
    calculateNodePositions
  };
}

/**
 * Hook for topology simulation
 * Manages simulation state and operations
 */
export function useTopologySimulation() {
  const dispatch = useDispatch<AppDispatch>();
  const { simulations, activeSimulation, loading } = useSelector((state: RootState) => state.topology);

  const startFailureSimulation = useCallback(
    (nodeIds: string[], clientUrl?: string) => {
      return dispatch(startSimulation({
        type: 'failure',
        parameters: { node_ids: nodeIds },
        clientUrl
      }));
    },
    [dispatch]
  );

  const startTrafficSimulation = useCallback(
    (flowRate: number, duration: number, clientUrl?: string) => {
      return dispatch(startSimulation({
        type: 'traffic',
        parameters: { flow_rate: flowRate, duration },
        clientUrl
      }));
    },
    [dispatch]
  );

  const startLoadSimulation = useCallback(
    (loadProfile: any, clientUrl?: string) => {
      return dispatch(startSimulation({
        type: 'load',
        parameters: loadProfile,
        clientUrl
      }));
    },
    [dispatch]
  );

  const stop = useCallback(
    (simulationId: string, clientUrl?: string) => {
      return dispatch(stopSimulation({ simulationId, clientUrl }));
    },
    [dispatch]
  );

  return {
    simulations,
    activeSimulation,
    loading: loading.simulation,
    startFailureSimulation,
    startTrafficSimulation,
    startLoadSimulation,
    stop
  };
}

// Export convenience
export default useTopology;