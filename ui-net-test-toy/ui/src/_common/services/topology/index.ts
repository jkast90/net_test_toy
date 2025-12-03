/**
 * Topology Service Module
 * Central export point for all topology-related functionality
 */

// Service
export { topologyService, default as TopologyService } from './topologyService';

// Mutations
export {
  topologyMutations,
  topologyManagementMutations,
  topologyNodeMutations,
  topologyEdgeMutations,
  topologyDiscoveryMutations,
  topologyVisualizationMutations,
  topologyMultiClientMutations
} from './topologyMutations';

// Types
export * from './types';

// Re-export common types for convenience
export type {
  TopologyDefinition,
  TopologyNode,
  TopologyEdge,
  TopologyDiscovery,
  TopologyValidation,
  TopologyVisualization,
  TopologySnapshot,
  TopologyDiff,
  TopologyStats,
  TopologyFilter,
  TopologyLayout,
  TopologySimulation,
  TopologyExportOptions,
  TopologyMutationResult
} from './types';