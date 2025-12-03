// API Call History Logger
// Saves API calls to localStorage with URL, endpoint, body, query params, etc.

const API_HISTORY_KEY = "netstream_api_call_history";
const MAX_HISTORY_ENTRIES = 50;

export interface ApiCallEntry {
  id: number;
  timestamp: number;
  url: string;
  endpoint: string;
  method: string;
  headers?: Record<string, string>;
  body?: any;
  queryParams?: Record<string, any> | null;
  status?: number;
  statusText?: string;
  response?: any;
  duration?: number;
  error?: {
    message: string;
    stack?: string;
    name: string;
  } | null;
  success: boolean;
}

export interface ApiCallStats {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  averageDuration: number;
  methodCounts: Record<string, number>;
  statusCounts: Record<string, number>;
  endpointCounts: Record<string, number>;
  recentCallsLast24h: number;
  oldestCall: Date | null;
  newestCall: Date | null;
}

/**
 * Logs an API call to localStorage
 */
export function logApiCall(callData: Partial<ApiCallEntry>): void {
  try {
    // Get existing history
    const existingHistory = getApiCallHistory();

    // Create the new entry
    const newEntry: ApiCallEntry = {
      id: Date.now() + Math.random(),
      timestamp: callData.timestamp || Date.now(),
      url: callData.url || "",
      endpoint: callData.endpoint || "",
      method: callData.method || "GET",
      headers: callData.headers,
      body: callData.body,
      queryParams: callData.queryParams || null,
      status: callData.status,
      statusText: callData.statusText,
      response: callData.response,
      duration: callData.duration,
      error: callData.error || null,
      success:
        !callData.error &&
        !!callData.status &&
        callData.status >= 200 &&
        callData.status < 300,
    };

    // Add to beginning of array (most recent first)
    const updatedHistory = [newEntry, ...existingHistory];

    // Keep only the last MAX_HISTORY_ENTRIES entries
    const trimmedHistory = updatedHistory.slice(0, MAX_HISTORY_ENTRIES);

    // Save to localStorage
    localStorage.setItem(API_HISTORY_KEY, JSON.stringify(trimmedHistory));

    // Also log to console for debugging
    console.log("🌐 API Call Logged:", {
      method: newEntry.method,
      endpoint: newEntry.endpoint,
      status: newEntry.status,
      duration: newEntry.duration ? newEntry.duration + "ms" : "N/A",
      success: newEntry.success,
    });
  } catch (error) {
    console.error("Failed to log API call:", error);
  }
}

/**
 * Retrieves API call history from localStorage
 */
export function getApiCallHistory(): ApiCallEntry[] {
  try {
    const historyJson = localStorage.getItem(API_HISTORY_KEY);
    return historyJson ? JSON.parse(historyJson) : [];
  } catch (error) {
    console.error("Failed to retrieve API call history:", error);
    return [];
  }
}

/**
 * Clears API call history from localStorage
 */
export function clearApiCallHistory(): void {
  try {
    localStorage.removeItem(API_HISTORY_KEY);
    // console.log("API call history cleared");
  } catch (error) {
    console.error("Failed to clear API call history:", error);
  }
}

/**
 * Exports API call history as JSON for download
 */
export function exportApiCallHistory(): string {
  const history = getApiCallHistory();
  return JSON.stringify(history, null, 2);
}

/**
 * Downloads API call history as a JSON file
 */
export function downloadApiCallHistory(): void {
  try {
    const historyJson = exportApiCallHistory();
    const blob = new Blob([historyJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `netstream_api_history_${
      new Date().toISOString().split("T")[0]
    }.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
    // console.log("API call history downloaded");
  } catch (error) {
    console.error("Failed to download API call history:", error);
  }
}

/**
 * Gets statistics about API call history
 */
export function getApiCallStats(): ApiCallStats {
  const history = getApiCallHistory();

  const stats: ApiCallStats = {
    totalCalls: history.length,
    successfulCalls: history.filter((call) => call.success).length,
    failedCalls: history.filter((call) => !call.success).length,
    averageDuration: 0,
    methodCounts: {},
    statusCounts: {},
    endpointCounts: {},
    recentCallsLast24h: 0,
    oldestCall: null,
    newestCall: null,
  };

  if (history.length > 0) {
    // Calculate average duration
    const durationsSum = history
      .filter((call) => call.duration)
      .reduce((sum, call) => sum + (call.duration || 0), 0);
    const durationsCount = history.filter((call) => call.duration).length;
    stats.averageDuration =
      durationsCount > 0 ? Math.round(durationsSum / durationsCount) : 0;

    // Count methods, statuses, and endpoints
    history.forEach((call) => {
      // Method counts
      stats.methodCounts[call.method] =
        (stats.methodCounts[call.method] || 0) + 1;

      // Status counts
      if (call.status) {
        const statusGroup = Math.floor(call.status / 100) * 100;
        stats.statusCounts[`${statusGroup}xx`] =
          (stats.statusCounts[`${statusGroup}xx`] || 0) + 1;
      }

      // Endpoint counts
      stats.endpointCounts[call.endpoint] =
        (stats.endpointCounts[call.endpoint] || 0) + 1;
    });

    // Recent calls (last 24 hours)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    stats.recentCallsLast24h = history.filter(
      (call) => call.timestamp > oneDayAgo,
    ).length;

    // Oldest and newest calls
    stats.oldestCall = new Date(history[history.length - 1].timestamp);
    stats.newestCall = new Date(history[0].timestamp);
  }

  return stats;
}
