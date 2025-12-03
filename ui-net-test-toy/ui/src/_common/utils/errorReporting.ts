// src/utils/errorReporting.ts
// Enhanced error reporting utilities

// Type definitions
export interface EnhancedError extends Error {
  originalError?: Error;
  functionName?: string;
  componentName?: string;
}

/**
 * Add function names to error stack traces for better debugging
 */
export function withFunctionName<T extends (...args: any[]) => any>(
  fn: T,
  name: string,
): T {
  // Create a named function wrapper
  const namedFunction = {
    [name]: function (this: any, ...args: Parameters<T>): ReturnType<T> {
      return fn.apply(this, args);
    },
  }[name] as T;

  // Copy properties
  Object.defineProperty(namedFunction, "name", { value: name });

  return namedFunction;
}

/**
 * Enhanced async error wrapper with better stack traces
 */
export function wrapAsyncFunction<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  functionName: string,
  componentName: string = "",
): T {
  const wrappedFunction = async function (this: any, ...args: Parameters<T>) {
    try {
      return await fn.apply(this, args);
    } catch (error: any) {
      // Enhance error with context
      const enhancedError = new Error(
        `${componentName ? `[${componentName}] ` : ""}${functionName}: ${
          error.message
        }`,
      ) as EnhancedError;
      enhancedError.originalError = error;
      enhancedError.functionName = functionName;
      enhancedError.componentName = componentName;
      enhancedError.stack = error.stack;

      console.group(`🚨 Enhanced Error in ${functionName}`);
      console.error("Function:", functionName);
      console.error("Component:", componentName);
      console.error("Original Error:", error);
      console.error("Enhanced Error:", enhancedError);
      console.groupEnd();

      throw enhancedError;
    }
  };

  return withFunctionName(wrappedFunction, functionName) as T;
}

/**
 * Global error handler setup
 */
export function setupGlobalErrorHandling(): void {
  // Catch unhandled promise rejections
  window.addEventListener(
    "unhandledrejection",
    function (event: PromiseRejectionEvent) {
      console.group("🚨 Unhandled Promise Rejection");
      console.error("Promise:", event.promise);
      console.error("Reason:", event.reason);
      console.error("Stack:", event.reason?.stack);
      console.groupEnd();

      // Prevent default browser handling
      event.preventDefault();
    },
  );

  // Catch JavaScript errors
  window.addEventListener("error", function (event: ErrorEvent) {
    console.group("🚨 JavaScript Error");
    console.error("Message:", event.message);
    console.error("Source:", event.filename);
    console.error("Line:", event.lineno);
    console.error("Column:", event.colno);
    console.error("Error:", event.error);
    console.groupEnd();
  });
}

/**
 * Component method wrapper for better error reporting
 */
export function enhanceComponent<T extends object>(
  component: T,
  componentName: string,
): T {
  const originalMethods: Record<string, Function> = {};

  // Wrap all methods
  Object.getOwnPropertyNames(Object.getPrototypeOf(component)).forEach(
    (methodName) => {
      const method = (component as any)[methodName];
      if (typeof method === "function" && methodName !== "constructor") {
        originalMethods[methodName] = method;
        (component as any)[methodName] = wrapAsyncFunction(
          originalMethods[methodName].bind(component),
          methodName,
          componentName,
        );
      }
    },
  );

  return component;
}
