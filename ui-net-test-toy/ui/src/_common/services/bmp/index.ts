/**
 * BMP Service Module
 * Central export point for all BMP-related functionality
 */

// Service
export { bmpService, default as BMPService } from './bmpService';

// Mutations
export { bmpMutations, bmpServerMutations, bmpFlowSpecMutations, bmpDataMutations, bmpMultiClientMutations } from './bmpMutations';

// Types
export * from './types';

// Re-export common types for convenience
export type {
  BMPPeer,
  BMPRoute,
  BMPFlowSpecRule,
  BMPMessage,
  BMPStats,
  BMPServerConfig,
  BMPData,
  BMPFilter,
  BMPMutationResult
} from './types';