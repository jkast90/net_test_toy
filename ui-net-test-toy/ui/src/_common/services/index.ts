// src/services/index.ts
// Centralized service exports for Netstream

import { apiClient } from "./api.ts";

// Re-export individual services
export { apiClient };

// Convenience object for accessing all services
export const services = {
  api: apiClient,
};

// Re-export types for convenience
export type {
  ApiResponse,
  RequestOptions,
  RequestParams,
  AuthTokens,
} from "./api.ts";