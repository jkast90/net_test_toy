/**
 * @fileoverview Centralized API service layer for UI application
 *
 * This module provides a unified API client with consistent error handling,
 * logging, and request/response processing across the entire UI application.
 *
 * Features:
 * - Centralized HTTP client with automatic error handling
 * - Consistent request logging and debugging
 * - Automatic JSON serialization/deserialization
 * - Configurable base URL for different environments
 * - Integration with UI error handling utilities
 *
 * Usage:
 *   import { apiClient } from '../services/api.ts';
 *   const users = await apiClient.get('/users');
 *   const newUser = await apiClient.post('/users', userData);
 */

import { getWorkspaceApiBaseUrl } from "../settings.ts";
import { logger } from "../utils/logger.ts";
import { HTTP_METHODS } from "../constants/index.ts";
import { logApiCall } from "../utils/apiLogger";
import { logTelemetryEvent, TELEMETRY_EVENTS } from "../utils/telemetry";
import { store } from "../store/store";
import { setCurrentBanner, addBanner } from "@common/store/slices/bannerSlice";
import { fetchWrapper } from "../utils/fetchWrapper";

// Type definitions
export interface ApiResponse<T = any> {
  data?: T;
  status: number;
  statusText: string;
}

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}

export interface RequestParams {
  [key: string]: string | number | boolean | undefined | string[];
}

export interface AuthTokens {
  access_token: string;
  id_token: string;
  refresh_token?: string;
}

/**
 * Base API client providing HTTP operations with consistent error handling.
 *
 * This class encapsulates all HTTP communication with the backend API,
 * providing a clean interface for making requests while handling common
 * concerns like error processing, logging, and response formatting.
 */
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || this.getDefaultBaseUrl();
  }

  private getDefaultBaseUrl(): string {
    try {
      return getWorkspaceApiBaseUrl();
    } catch (error) {
      // Fallback for testing or when settings are not available
      // Use current protocol and hostname with appropriate port
      // const protocol = window.location.protocol;
      const protocol = "https:"
      const hostname = window.location.hostname;
      const port = protocol === "https:" ? "8443" : "8000";
      return `${protocol}//${hostname}:${port}/api`;
    }
  }

  async request<T = any>(
    endpoint: string,
    options: RequestOptions = {},
  ): Promise<T> {
    // Always get the latest base URL from settings/localStorage on every request
    const baseUrl = this.getDefaultBaseUrl();
    const url = `${baseUrl}${endpoint}`;
    const startTime = Date.now();

    // Get auth token from localStorage
    const accessToken = localStorage.getItem("auth_access_token");

    const config: RequestInit = {
      headers: {
        "Content-Type": "application/json",
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
        ...options.headers,
      },
      ...options,
    };

    logger.api(
      `${config.method || "GET"} ${url}`,
      options.body ? JSON.parse(options.body) : undefined,
    );

    // Detailed pre-fetch logging for debugging
    try {
      console.error("[API Request Details]", {
        url,
        method: config.method || "GET",
        headers: config.headers,
        body: options.body
          ? typeof options.body === "string"
            ? JSON.parse(options.body)
            : options.body
          : undefined,
        protocol: new URL(url).protocol,
        hasTrailingSlash: url.endsWith("/"),
      });
    } catch (logErr) {
      console.error("[API Request Details] (raw)", {
        url,
        method: config.method || "GET",
        headers: config.headers,
        bodyRaw: options.body,
        protocol: new URL(url).protocol,
        hasTrailingSlash: url.endsWith("/"),
      });
    }

    try {
      // Try the initial request
      try {
        const responseData = await fetchWrapper<T>(url, config);

        // Log telemetry for API response time
        const duration = Date.now() - startTime;
        logTelemetryEvent(TELEMETRY_EVENTS.API_RESPONSE_TIME, {
          category: "performance",
          action: "api_call",
          label: endpoint,
          value: duration,
          metadata: {
            method: config.method || "GET",
            status: 200,
          },
        });

        if (endpoint.includes("/preferences")) {
          console.log("[ApiClient] Preferences response:", {
            endpoint,
            data: responseData,
            status: 200,
          });
        }

        return responseData;
      } catch (fetchError: any) {
        // Check if this is a 401 error by examining the error message
        const is401 = fetchError.message?.includes("401") || fetchError.message?.includes("Unauthorized");

        // If we get a 401 Unauthorized, try to refresh the token
        if (is401 && accessToken) {
          logger.info("API request got 401, attempting token refresh...");

          const refreshToken = localStorage.getItem("auth_refresh_token");
          if (refreshToken) {
            try {
              const refreshed = await this.refreshToken(refreshToken);
              if (refreshed) {
                // Retry the original request with new token
                const newAccessToken = localStorage.getItem("auth_access_token");
                const retryConfig: RequestInit = {
                  ...config,
                  headers: {
                    ...config.headers,
                    Authorization: `Bearer ${newAccessToken}`,
                  },
                };

                logger.info("Retrying original request with refreshed token...");
                const retryResponseData = await fetchWrapper<T>(url, retryConfig);

                // Log telemetry for successful retry
                const duration = Date.now() - startTime;
                logTelemetryEvent(TELEMETRY_EVENTS.API_RESPONSE_TIME, {
                  category: "performance",
                  action: "api_call",
                  label: endpoint,
                  value: duration,
                  metadata: {
                    method: config.method || "GET",
                    status: 200,
                    retried: true,
                  },
                });

                return retryResponseData;
              }
            } catch (refreshError) {
              logger.error("Token refresh failed:", refreshError);
              // Clear tokens and redirect to login
              this.clearAuthAndRedirect();
              throw new Error("Authentication expired. Please log in again.");
            }
          }

          // No refresh token available
          this.clearAuthAndRedirect();
          throw new Error("Authentication expired. Please log in again.");
        }

        // Handle 503 Service Unavailable errors with banner
        const is503 = fetchError.message?.includes("503");
        if (is503) {
          const banner = {
            id: `503-${Date.now()}`,
            message: "The service is temporarily unavailable. Please try again in a few moments.",
            type: "error" as const,
            timestamp: new Date().toISOString(),
            dismissible: true,
            autoHide: true,
            duration: 5000,
          };
          store.dispatch(addBanner(banner));
          store.dispatch(setCurrentBanner(banner));
        }

        // Re-throw the error
        throw fetchError;
      }
    } catch (error) {
      const duration = Date.now() - startTime;

      // Log telemetry for API error (fetchWrapper already logs to apiLogger)
      logTelemetryEvent(TELEMETRY_EVENTS.API_ERROR, {
        category: "error",
        action: "api_call_failed",
        label: endpoint,
        metadata: {
          method: config.method || "GET",
          error: error instanceof Error ? error.message : String(error),
          duration,
        },
      });

      // Re-throw error (fetchWrapper already logged it)
      throw error;
    }
  }

  private async refreshToken(refreshToken: string): Promise<boolean> {
    try {
      // Import here to avoid circular dependency
      const { getCognitoDomain, getCognitoClientId } = await import(
        "../settings.ts"
      );

      const tokenUrl = `${getCognitoDomain()}/oauth2/token`;
      const clientId = getCognitoClientId();

      const body = new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        refresh_token: refreshToken,
      });

      const tokens = await fetchWrapper<AuthTokens>(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      // Store the new tokens
      localStorage.setItem("auth_access_token", tokens.access_token);
      localStorage.setItem("auth_id_token", tokens.id_token);
      if (tokens.refresh_token) {
        localStorage.setItem("auth_refresh_token", tokens.refresh_token);
      }

      logger.info("Token refreshed successfully in API client");
      return true;
    } catch (error) {
      logger.error("API client token refresh failed:", error);
      return false;
    }
  }

  private clearAuthAndRedirect(): void {
    // Clear all auth tokens and related data
    const keysToRemove = [
      "auth_access_token",
      "auth_id_token",
      "auth_refresh_token",
      "userEmail",
      "lastVisitedRoute",
      "selectedWorkspace",
    ];

    keysToRemove.forEach((key) => {
      localStorage.removeItem(key);
    });

    // Clear session storage as well
    sessionStorage.clear();

    // Force reload to ensure clean state
    window.location.replace("/");
  }

  // HTTP method helpers
  async get<T = any>(endpoint: string, params: RequestParams = {}): Promise<T> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach((v) => query.append(key, String(v)));
        } else {
          query.append(key, String(value));
        }
      }
    });
    const queryString = query.toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return this.request<T>(url, { method: HTTP_METHODS.GET });
  }

  async post<T = any>(endpoint: string, data: any = {}): Promise<T> {
    console.error("[ApiClient.post] Called with:", { endpoint, data });
    return this.request<T>(endpoint, {
      method: HTTP_METHODS.POST,
      body: JSON.stringify(data),
    });
  }

  async put<T = any>(endpoint: string, data: any = {}): Promise<T> {
    return this.request<T>(endpoint, {
      method: HTTP_METHODS.PUT,
      body: JSON.stringify(data),
    });
  }

  async patch<T = any>(endpoint: string, data: any = {}): Promise<T> {
    return this.request<T>(endpoint, {
      method: HTTP_METHODS.PATCH,
      body: JSON.stringify(data),
    });
  }

  async delete<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: HTTP_METHODS.DELETE });
  }
}

// Create singleton instance
export const apiClient = new ApiClient();
