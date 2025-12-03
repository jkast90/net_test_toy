/**
 * @fileoverview Error Handling and User Feedback Utilities
 *
 * Provides standardized error handling patterns for the application,
 * ensuring consistent user feedback and error logging across all components.
 *
 * Features:
 * - Centralized API error handling with user-friendly messages
 * - Higher-order function wrapper for consistent error handling
 * - Form validation with automatic user feedback
 * - Integration with banner system for user notifications
 * - Comprehensive error logging for debugging
 *
 * Usage:
 *   const operation = withErrorHandling(
 *     async () => await apiCall(),
 *     showBanner,
 *     'Data loading'
 *   );
 */

import logger from "./logger.ts";

type ShowBannerFunction = (message: string) => void;

/**
 * Handle API errors with consistent user feedback
 */
export function handleApiError(
  error: Error,
  showBanner: ShowBannerFunction,
  context: string,
  userMessage?: string,
): void {
  // Log the full error with stack trace
  logger.error(`${context} error:`, error);

  // Extract more details from the error
  const errorDetails: string[] = [error.message];

  // Check if it's a Response error with status
  if ((error as any).response) {
    const response = (error as any).response;
    errorDetails.push(`Status: ${response.status}`);
    if (response.statusText) {
      errorDetails.push(response.statusText);
    }
  }

  // Check if it's a fetch error with URL
  if ((error as any).url) {
    errorDetails.push(`URL: ${(error as any).url}`);
  }

  const message =
    userMessage || "An unexpected error occurred. Please try again.";
  showBanner(`${message}: ${errorDetails.join(" - ")}`);
}

/**
 * Wrap async operations with standardized error handling
 */
export function withErrorHandling<T extends any[], R>(
  asyncFn: (...args: T) => Promise<R>,
  showBanner: ShowBannerFunction,
  context: string,
  successMessage?: string,
) {
  return async (...args: T): Promise<R> => {
    try {
      const result = await asyncFn(...args);
      if (successMessage) {
        showBanner(successMessage);
      }
      return result;
    } catch (error) {
      handleApiError(error as Error, showBanner, context);
      throw error; // Re-throw to allow caller to handle if needed
    }
  };
}

/**
 * Validate required fields and show user-friendly errors
 */
export function validateRequiredFields(
  data: Record<string, any>,
  requiredFields: string[],
  showBanner: ShowBannerFunction,
): boolean {
  const missingFields = requiredFields.filter(
    (field) => !data[field]?.trim?.(),
  );

  if (missingFields.length > 0) {
    const fieldNames = missingFields.join(", ");
    showBanner(`Please fill in the following required fields: ${fieldNames}`);
    return false;
  }

  return true;
}
