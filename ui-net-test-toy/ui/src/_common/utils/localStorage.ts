/**
 * Utility functions for localStorage JSON operations
 * Consolidates repeated JSON parsing/stringify patterns across the codebase
 */

/**
 * Safely retrieves and parses JSON data from localStorage
 */
export const getStoredJSON = <T = any>(
  key: string,
  defaultValue: T = [] as T,
): T => {
  try {
    const item = localStorage.getItem(key);
    if (item === null) {
      return defaultValue;
    }
    return JSON.parse(item);
  } catch (error) {
    console.warn(`Failed to parse localStorage key "${key}":`, error);
    return defaultValue;
  }
};

/**
 * Safely stringifies and stores JSON data to localStorage
 */
export const setStoredJSON = (key: string, value: any): boolean => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Failed to store localStorage key "${key}":`, error);
    return false;
  }
};

/**
 * Safely removes an item from localStorage
 */
export const removeStoredItem = (key: string): boolean => {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`Failed to remove localStorage key "${key}":`, error);
    return false;
  }
};

/**
 * Safely clears all localStorage data
 */
export const clearStorage = (): boolean => {
  try {
    localStorage.clear();
    return true;
  } catch (error) {
    console.error("Failed to clear localStorage:", error);
    return false;
  }
};

/**
 * Checks if localStorage is available and functional
 */
export const isStorageAvailable = (): boolean => {
  try {
    const test = "__storage_test__";
    localStorage.setItem(test, "test");
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
};

/**
 * Gets multiple JSON items from localStorage at once
 */
export const getMultipleStoredJSON = <T extends Record<string, any>>(
  keysWithDefaults: T,
): T => {
  const result = {} as T;
  Object.entries(keysWithDefaults).forEach(([key, defaultValue]) => {
    result[key as keyof T] = getStoredJSON(key, defaultValue);
  });
  return result;
};

/**
 * Sets multiple JSON items to localStorage at once
 */
export const setMultipleStoredJSON = (items: Record<string, any>): boolean => {
  let allSuccessful = true;
  Object.entries(items).forEach(([key, value]) => {
    if (!setStoredJSON(key, value)) {
      allSuccessful = false;
    }
  });
  return allSuccessful;
};
