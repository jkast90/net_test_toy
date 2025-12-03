/**
 * Testing Service Module
 * Central export point for all container-based testing functionality
 */

// Service
export { testingService, default as TestingService } from './testingService';

// Types
export * from './types';

// Re-export common types for convenience
export type {
  ContainerTest,
  TestParameters,
  TestServer,
  ServerConfig,
  TestExecution,
  TestResult,
  TestMetrics,
  TestContainer,
  TestCapabilities,
  TestProfile,
  TestPreset,
  TestHistory,
  TestSummary,
  TestMutationResult,
  TestStreamMessage,
  BatchTest
} from './types';