// src/utils/index.ts
// Centralized utility exports

export { default as logger } from "./logger.ts";
export { generateUUID } from "./uuid.js";
export {
  handleApiError,
  withErrorHandling,
  validateRequiredFields,
} from "./errorUtils.js";
export {
  setStorageItem,
  getStorageItem,
  removeStorageItem,
  clearStorageItems,
  getStoredWorkspace,
  setStoredWorkspace,
} from "./storageUtils.ts";

// Re-export types for convenience
export type { LogLevel } from "./logger.ts";
export type { StoredWorkspace, RawStoredWorkspace } from "./storageUtils.ts";
export type { ThemeName, ThemeInfo } from "./themeManager.js";
