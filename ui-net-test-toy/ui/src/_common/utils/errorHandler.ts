/**
 * Centralized error handling utilities
 * Consolidates repeated error handling patterns across the codebase
 */

// Type definitions
export interface LogData {
  context: string;
  message: string;
  timestamp: string;
  stack?: string;
  [key: string]: any;
}

export interface ErrorHandlerOptions {
  logArgs?: boolean;
  details?: Record<string, any>;
  level?: LogLevel;
  rethrow?: boolean;
  fallback?: any;
}

export interface SafePromiseOptions {
  details?: Record<string, any>;
  level?: LogLevel;
  fallback?: any;
}

export interface SafePromiseResult<T> {
  success: boolean;
  data: T | null;
  error: Error | null;
}

export type LogLevel = "error" | "warn" | "info" | "debug";

/**
 * Log levels for different types of errors
 */
export const LOG_LEVELS = Object.freeze({
  ERROR: "error" as const,
  WARN: "warn" as const,
  INFO: "info" as const,
  DEBUG: "debug" as const,
} as const);

/**
 * Handles errors with consistent logging and optional reporting
 */
export const handleError = (
  context: string,
  error: Error | string,
  details: Record<string, any> = {},
  level: LogLevel = LOG_LEVELS.ERROR,
): void => {
  const timestamp = new Date().toISOString();
  const errorMessage = error instanceof Error ? error.message : error;
  const errorStack = error instanceof Error ? error.stack : undefined;

  const logData: LogData = {
    context,
    message: errorMessage,
    timestamp,
    ...details,
    ...(errorStack && { stack: errorStack }),
  };

  // Log to console based on level
  switch (level) {
    case LOG_LEVELS.ERROR:
      console.error(`[${context}] Error:`, logData);
      break;
    case LOG_LEVELS.WARN:
      console.warn(`[${context}] Warning:`, logData);
      break;
    case LOG_LEVELS.INFO:
      console.info(`[${context}] Info:`, logData);
      break;
    case LOG_LEVELS.DEBUG:
      console.debug(`[${context}] Debug:`, logData);
      break;
    default:
      console.log(`[${context}] ${level}:`, logData);
  }

  // TODO: Add error reporting service integration here
  // if (shouldReport(level)) {
  //   errorReportingService.report(logData);
  // }
};

/**
 * Higher-order function that wraps async functions with error handling
 */
export const withErrorHandler = <TArgs extends any[], TReturn>(
  asyncFn: (...args: TArgs) => Promise<TReturn>,
  context: string,
  options: ErrorHandlerOptions = {},
) => {
  return async (...args: TArgs): Promise<TReturn | any> => {
    try {
      return await asyncFn(...args);
    } catch (error) {
      const details = {
        functionName: asyncFn.name,
        args: options.logArgs ? args : "[args hidden]",
        ...options.details,
      };

      handleError(context, error as Error, details, options.level);

      if (options.rethrow !== false) {
        throw error;
      }

      return options.fallback;
    }
  };
};

/**
 * Wraps a function with try-catch and error handling
 */
export const withTryCatch = <TArgs extends any[], TReturn>(
  fn: (...args: TArgs) => TReturn,
  context: string,
  options: ErrorHandlerOptions = {},
) => {
  return (...args: TArgs): TReturn | any => {
    try {
      return fn(...args);
    } catch (error) {
      const details = {
        functionName: fn.name,
        args: options.logArgs ? args : "[args hidden]",
        ...options.details,
      };

      handleError(context, error as Error, details, options.level);

      if (options.rethrow !== false) {
        throw error;
      }

      return options.fallback;
    }
  };
};

/**
 * Creates a promise that handles errors gracefully
 */
export const safePromise = async <T>(
  promise: Promise<T>,
  context: string,
  options: SafePromiseOptions = {},
): Promise<SafePromiseResult<T>> => {
  try {
    const result = await promise;
    return { success: true, data: result, error: null };
  } catch (error) {
    handleError(context, error as Error, options.details, options.level);
    return {
      success: false,
      data: options.fallback || null,
      error: error as Error,
    };
  }
};

/**
 * Validates required parameters and throws descriptive errors
 */
export const validateRequired = (
  params: Record<string, any>,
  required: string[],
  context: string,
): void => {
  const missing = required.filter((key) => params[key] == null);
  if (missing.length > 0) {
    throw new Error(
      `[${context}] Missing required parameters: ${missing.join(", ")}`,
    );
  }
};

/**
 * Safe JSON parsing with fallback
 */
export function safeJsonParse<T = any>(
  jsonString: string | null | undefined,
  fallback: T | null = null,
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
