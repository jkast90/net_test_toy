// src/constants/index.ts
// Centralized constants and configuration for Netstream

// Storage Keys
export const STORAGE_KEYS = {
  THEME: "theme",
  AUTH_ACCESS_TOKEN: "auth_access_token",
  AUTH_ID_TOKEN: "auth_id_token",
  AUTH_REFRESH_TOKEN: "auth_refresh_token",
  USER_EMAIL: "userEmail",
  LAST_VISITED_ROUTE: "lastVisitedRoute",
  API_URL: "apiUrl",
} as const;

// Theme Options
export const THEMES = {
  LIGHT: "light",
  DARK: "dark",
} as const;

// UI Constants
export const UI_CONSTANTS = {
  COLLAPSED_LABEL: "▶",
  EXPANDED_LABEL: "▼",
  MAX_RETRIES: 3,
  DEFAULT_TIMEOUT: 5000,
} as const;

// Validation Rules
export const VALIDATION = {
  MIN_NAME_LENGTH: 1,
  MAX_NAME_LENGTH: 100,
  MIN_URL_LENGTH: 1,
  MAX_DESCRIPTION_LENGTH: 500,
} as const;

// HTTP Methods
export const HTTP_METHODS = {
  GET: "GET",
  POST: "POST",
  PUT: "PUT",
  PATCH: "PATCH",
  DELETE: "DELETE",
} as const;

// Type definitions for constants
export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
export type ThemeOption = (typeof THEMES)[keyof typeof THEMES];
export type HttpMethod = (typeof HTTP_METHODS)[keyof typeof HTTP_METHODS];

// Legacy exports for compatibility
export type ApiEndpoint = string;
export type GroupType = string;
