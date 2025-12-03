/**
 * NetFlow Service Module
 * Central export point for all NetFlow-related functionality
 */

// Service
export { netflowService, default as NetFlowService } from './netflowService';

// Mutations
export {
  netflowMutations,
  netflowCollectorMutations,
  netflowAlertMutations,
  netflowDataMutations,
  netflowMultiClientMutations
} from './netflowMutations';

// Types
export * from './types';

// Re-export common types for convenience
export type {
  NetFlowRecord,
  NetFlowStats,
  NetFlowExporter,
  NetFlowAlert,
  NetFlowCollectorConfig,
  NetFlowFilter,
  NetFlowAggregation,
  NetFlowAnalysis,
  NetFlowData,
  NetFlowTimeSeriesData,
  NetFlowTopTalker,
  NetFlowProtocolStats,
  NetFlowConversation,
  NetFlowMutationResult
} from './types';