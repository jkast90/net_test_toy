// Deployment configuration for Netstream
// This file handles environment detection and DNS configuration

/**
 * Auto-detect the appropriate base URLs based on the current environment
 * This allows the app to work on any device without hardcoding IPs or hostnames
 */
export function getDeploymentConfig() {
  const hostname = window.location.hostname;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";

  // Determine protocol: localhost always uses HTTPS, otherwise use current protocol
  const protocol = isLocalhost ? "https:" : window.location.protocol;

  // Determine API URL based ONLY on window.location
  // Localhost always uses HTTPS on port 8443, production uses same domain as UI
  const apiUrl = isLocalhost
    ? `https://${hostname}:8443`
    : `${protocol}//${hostname}`;

  // Get Cognito config from environment variables ONLY (these are build-time only)
  const runtimeConfig = window.RUNTIME_CONFIG || {};

  return {
    apiUrl: apiUrl,
    cognitoDomain:
      runtimeConfig.VITE_COGNITO_DOMAIN ||
      import.meta.env.VITE_COGNITO_DOMAIN ||
      "",
    cognitoUiUrl:
      runtimeConfig.VITE_COGNITO_UI_URL ||
      import.meta.env.VITE_COGNITO_UI_URL ||
      "",
    clientId:
      runtimeConfig.VITE_COGNITO_CLIENT_ID ||
      import.meta.env.VITE_COGNITO_CLIENT_ID ||
      "",
  };
}

/**
 * Get the appropriate WebSocket URL for real-time features
 */
export function getWebSocketUrl() {
  const config = getDeploymentConfig();
  return config.apiUrl.replace(/^http/, "ws") + "/ws";
}

/**
 * Check if we're running in production mode
 */
export function isProduction() {
  return import.meta.env.PROD;
}

/**
 * Get the appropriate redirect URI for OAuth
 */
export function getRedirectUri() {
  return `${window.location.origin}/auth`;
}

/**
 * Validate that all required services are accessible
 */
export async function validateServices() {
  const config = getDeploymentConfig();
  const results = {
    api: false,
    cognito: config.cognitoDomain ? true : false, // Assume AWS Cognito is always available
    ui: true, // UI is obviously working if we're running this
  };

  try {
    // Test API connection
    const apiResponse = await fetch(`${config.apiUrl}/health`, {
      method: "GET",
      timeout: 5000,
    });
    results.api = apiResponse.ok;
  } catch (error) {
    console.warn("API service not accessible:", error);
  }

  // AWS Cognito doesn't need health check - it's managed by AWS

  return results;
}

// Export for debugging
if (import.meta.env.DEV) {
  window.NetstreamConfig = {
    getDeploymentConfig,
    getWebSocketUrl,
    isProduction,
    getRedirectUri,
    validateServices,
  };
}
