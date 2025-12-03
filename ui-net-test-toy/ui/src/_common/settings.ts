import { getDeploymentConfig } from "@deployment-config";

export function getWorkspaceApiBaseUrl(): string {
  // Prioritize user-configured localStorage over auto-detected values
  let url = "";
  const currentHostname = window.location.hostname;
  const isCurrentHostLocalhost = currentHostname === "localhost" || currentHostname === "127.0.0.1";

  // First check localStorage for user override
  try {
    const ls = window.localStorage.getItem("dashboard_api_url");
    if (ls) {
      // If we're NOT on localhost but localStorage has a localhost URL, clear it
      const isStoredUrlLocalhost = ls.includes("localhost") || ls.includes("127.0.0.1");
      if (!isCurrentHostLocalhost && isStoredUrlLocalhost) {
        console.log('[settings] Clearing stale localhost API URL from localStorage');
        window.localStorage.removeItem("dashboard_api_url");
      } else {
        url = ls;
      }
    }
  } catch {
    /* ignore */
  }

  // If no localStorage value, fall back to deployment config (env vars or auto-detection)
  if (!url || url === "") {
    const deploymentConfig = getDeploymentConfig();
    url = deploymentConfig.apiUrl;
  }

  // Force HTTPS if the page is loaded over HTTPS (except for localhost)
  const isLocalhost = url.includes("localhost") || url.includes("127.0.0.1");
  if (window.location.protocol === "https:" && url.startsWith("http://") && !isLocalhost) {
    url = url.replace("http://", "https://");
  }

  // Ensure /api suffix is present
  if (!url.endsWith("/api")) {
    url = url + "/api";
  }

  return url;
}

export function getCognitoDomain(): string {
  // Prioritize environment variables over localStorage to prevent stale values
  const envValue = getDeploymentConfig().cognitoDomain;
  if (envValue) return envValue;

  try {
    const ls = window.localStorage.getItem("cognito_domain");
    if (ls) return ls;
  } catch {
    /* ignore */
  }
  return "";
}

export function getCognitoClientId(): string {
  // Prioritize environment variables over localStorage to prevent stale values
  const envValue = getDeploymentConfig().clientId;
  if (envValue) return envValue;

  try {
    const ls = window.localStorage.getItem("cognito_client_id");
    if (ls) return ls;
  } catch {
    /* ignore */
  }
  return "";
}

// Additional helper functions for deployment
export function getCognitoUIUrl(): string {
  return getDeploymentConfig().cognitoUiUrl;
}

// Auth settings
export function getAuthEnabled(): boolean {
  // Check runtime config first (for Docker environment with DISABLE_AUTH)
  const runtimeConfig = (window as any).RUNTIME_CONFIG;
  if (runtimeConfig && runtimeConfig.DISABLE_AUTH !== undefined) {
    // DISABLE_AUTH is true when auth should be disabled
    return runtimeConfig.DISABLE_AUTH !== "true";
  }

  try {
    const ls = window.localStorage.getItem("auth_enabled");
    return ls === null ? true : ls === "true"; // Default to enabled
  } catch {
    return true;
  }
}

export function setAuthEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem("auth_enabled", enabled.toString());
  } catch {
    /* ignore */
  }
}

export function getBypassEmail(): string {
  try {
    const ls = window.localStorage.getItem("bypass_email");
    return ls || "";
  } catch {
    return "";
  }
}

export function setBypassEmail(email: string): void {
  try {
    window.localStorage.setItem("bypass_email", email);
  } catch {
    /* ignore */
  }
}
