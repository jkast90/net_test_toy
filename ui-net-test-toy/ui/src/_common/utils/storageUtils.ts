// src/utils/storageUtils.ts
// Centralized localStorage operations with error handling

import logger from "./logger.ts";

/**
 * Safe JSON parsing with fallback
 */
function safeJSONParse<T = any>(
  jsonString: string | null | undefined,
  fallback: T | string | null = null,
): T | string | null {
  try {
    if (!jsonString) return fallback;

    // If the string doesn't start with { or [ or ", it's likely a plain string value
    // Return it as-is instead of trying to parse as JSON
    const trimmed = jsonString.trim();
    if (
      !trimmed.startsWith("{") &&
      !trimmed.startsWith("[") &&
      !trimmed.startsWith('"')
    ) {
      return trimmed;
    }

    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.warn("Failed to parse JSON:", jsonString, error);
    return fallback;
  }
}

// Type definitions
export interface StoredWorkspace {
  id: number;
  name: string;
  view?: string;
  workspace_id?: number;
  workspace_name?: string;
}

export interface RawStoredWorkspace {
  id?: number;
  workspace_id?: number;
  name?: string;
  workspace_name?: string;
  view?: string;
  [key: string]: any;
}

/**
 * Set item in localStorage with JSON serialization
 */
export function setStorageItem<T = any>(key: string, value: T): void {
  try {
    const serialized =
      typeof value === "string" ? value : JSON.stringify(value);
    localStorage.setItem(key, serialized);
  } catch (error) {
    logger.warn(`Failed to set localStorage item "${key}":`, error);
  }
}

/**
 * Get item from localStorage with JSON parsing
 */
export function getStorageItem<T = any>(
  key: string,
  fallback: T | null = null,
): T | null {
  try {
    const item = localStorage.getItem(key);
    return item ? (safeJSONParse(item, item) as T) : fallback;
  } catch (error) {
    logger.warn(`Failed to get localStorage item "${key}":`, error);
    return fallback;
  }
}

/**
 * Remove item from localStorage
 */
export function removeStorageItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    logger.warn(`Failed to remove localStorage item "${key}":`, error);
  }
}

/**
 * Clear multiple storage keys
 */
export function clearStorageItems(keys: string[]): void {
  keys.forEach((key) => removeStorageItem(key));
}

/**
 * Get stored workspace with validation
 */
export function getStoredWorkspace(): StoredWorkspace | null {
  const stored = getStorageItem<RawStoredWorkspace>("selectedWorkspace");

  if (!stored || typeof stored !== "object") {
    // Clean up invalid data
    removeStorageItem("selectedWorkspace");
    return null;
  }

  // Accept both id formats (could be number or string)
  if (!stored.id && !stored.workspace_id) {
    removeStorageItem("selectedWorkspace");
    return null;
  }

  // Normalize the workspace object
  return {
    id: stored.workspace_id || stored.id!,
    name: stored.workspace_name || stored.name!,
    view: stored.view,
  };
}

/**
 * Store workspace selection
 */
export function setStoredWorkspace(
  workspace: StoredWorkspace | RawStoredWorkspace,
): void {
  if (workspace && (workspace.id || workspace.workspace_id)) {
    setStorageItem("selectedWorkspace", workspace);
  }
}

// Aliases for tests
export const saveToStorage = setStorageItem;
export const loadFromStorage = getStorageItem;
export const removeFromStorage = removeStorageItem;

/**
 * Clear all localStorage
 */
export function clearStorage(): void {
  try {
    localStorage.clear();
  } catch (error) {
    logger.warn("Failed to clear localStorage:", error);
  }
}
