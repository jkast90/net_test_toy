/**
 * Centralized fetch wrapper for all API calls
 * All fetch calls in the application should use this wrapper for consistent logging
 */
import { logApiCall } from './apiLogger';

interface FetchOptions extends RequestInit {
  signal?: AbortSignal;
  /**
   * Whether to suppress console logs for this request
   * Useful for polling operations to reduce noise
   * @default false
   */
  suppressLogs?: boolean;
  /**
   * Expected response type
   * @default 'json'
   */
  responseType?: 'json' | 'blob';
  /**
   * Request timeout in milliseconds
   * If not specified, defaults to 30 seconds to prevent connection exhaustion
   * @default 30000
   */
  timeout?: number;
}

/**
 * Centralized fetch wrapper that all API calls must use
 * Provides consistent error handling and logging
 */
export async function fetchWrapper<T = any>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const startTime = Date.now();

  // Set up timeout with AbortController
  // Default to 30 seconds to prevent connection exhaustion from hanging requests
  const timeout = options.timeout ?? 30000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  // Combine user signal with timeout signal
  const signal = options.signal
    ? AbortSignal.any([options.signal, controller.signal])
    : controller.signal;

  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
    signal,
  };

  // Extract endpoint from URL (path after domain)
  const endpoint = url.replace(/^https?:\/\/[^\/]+/, '');

  // console.log(`[fetchWrapper] ${config.method || 'GET'} ${url}`, options.body ? JSON.parse(options.body as string) : undefined);

  try {
    const response = await fetch(url, config);
    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;

    // if HTTP error status, try to read text and throw
    if (!response.ok) {
      let errMsg = response.statusText;
      try {
        const text = await response.text();
        if (text) errMsg = text;
      } catch {}

      // Log failed API call
      if (!options.suppressLogs) {
        logApiCall({
          url,
          endpoint,
          method: config.method || 'GET',
          headers: config.headers as Record<string, string>,
          body: options.body ? JSON.parse(options.body as string) : undefined,
          status: response.status,
          statusText: response.statusText,
          duration,
          error: {
            name: 'HTTP Error',
            message: errMsg
          }
        });
      }

      // Include status code in error message for better error handling (e.g., backoff logic)
      throw new Error(`${response.status} ${errMsg}`);
    }

    // No Content
    if (response.status === 204) {
      // Log successful API call
      if (!options.suppressLogs) {
        logApiCall({
          url,
          endpoint,
          method: config.method || 'GET',
          headers: config.headers as Record<string, string>,
          body: options.body ? JSON.parse(options.body as string) : undefined,
          status: response.status,
          statusText: response.statusText,
          response: null,
          duration
        });
      }

      return null as T;
    }

    // Handle blob responses
    if (options.responseType === 'blob') {
      const blob = await response.blob();

      // Log successful API call (without logging the blob data itself)
      if (!options.suppressLogs) {
        logApiCall({
          url,
          endpoint,
          method: config.method || 'GET',
          headers: config.headers as Record<string, string>,
          body: options.body ? JSON.parse(options.body as string) : undefined,
          status: response.status,
          statusText: response.statusText,
          response: { type: 'blob', size: blob.size },
          duration
        });
      }

      return blob as T;
    }

    // read as text first, then parse only if non-empty (default JSON handling)
    const text = await response.text();
    const responseData = text ? JSON.parse(text) : null;

    // Log successful API call
    if (!options.suppressLogs) {
      logApiCall({
        url,
        endpoint,
        method: config.method || 'GET',
        headers: config.headers as Record<string, string>,
        body: options.body ? JSON.parse(options.body as string) : undefined,
        status: response.status,
        statusText: response.statusText,
        response: responseData,
        duration
      });
    }

    return responseData;
  } catch (err) {
    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;

    // Convert abort errors to timeout errors for better error messages
    if (err instanceof Error && err.name === 'AbortError') {
      const timeoutError = new Error(`Request timed out after ${timeout}ms`);
      timeoutError.name = 'TimeoutError';
      if (!options.suppressLogs) {
        console.error(`[fetchWrapper] Request timed out: ${config.method || 'GET'} ${url}`);
        logApiCall({
          url,
          endpoint,
          method: config.method || 'GET',
          headers: config.headers as Record<string, string>,
          body: options.body ? JSON.parse(options.body as string) : undefined,
          duration,
          error: {
            name: 'TimeoutError',
            message: `Request timed out after ${timeout}ms`
          }
        });
      }
      throw timeoutError;
    }

    if (!options.suppressLogs) {
      console.error(`[fetchWrapper] Request failed: ${config.method || 'GET'} ${url}`, err);
    }

    // Log failed API call (if not already logged above)
    if (!options.suppressLogs && !(err instanceof Error && err.message.includes('HTTP'))) {
      logApiCall({
        url,
        endpoint,
        method: config.method || 'GET',
        headers: config.headers as Record<string, string>,
        body: options.body ? JSON.parse(options.body as string) : undefined,
        duration,
        error: err instanceof Error ? {
          name: err.name,
          message: err.message,
          stack: err.stack
        } : {
          name: 'Error',
          message: String(err)
        }
      });
    }

    throw err;
  }
}
