import { useEffect } from "react";
import {
  getApiCallHistory,
  clearApiCallHistory,
  downloadApiCallHistory,
  getApiCallStats,
} from "../utils/apiLogger";
import {
  getTelemetryHistory,
  getTelemetryStats,
  clearTelemetryHistory,
  downloadTelemetryData,
  getBreadcrumbs,
  clearBreadcrumbs,
  getStateSnapshots,
  clearStateSnapshots,
  getRenderMetrics,
  getSlowRenders,
  clearRenderMetrics,
  getUserActionSequence,
  getRecentActions,
  clearUserActionSequence,
  downloadDebugReport,
  exportDebugReport,
} from "../utils/telemetry";

/**
 * Hook to provide global access to API history and telemetry functions
 * Also sets up developer console commands and keyboard shortcuts
 */
export function useApiHistoryGlobal() {
  useEffect(() => {
    // Set up global developer console commands
    if (typeof window !== "undefined") {
      // Add to window object for developer console access
      (window as any).netstreamApiHistory = {
        getHistory: getApiCallHistory,
        clearHistory: clearApiCallHistory,
        downloadHistory: downloadApiCallHistory,
        getStats: getApiCallStats,
        showStats: () => {
          const stats = getApiCallStats();
          // console.table(stats);
          return stats;
        },
        showRecent: (count = 5) => {
          const history = getApiCallHistory();
          const recent = history.slice(0, count);
          // console.log(`📊 Last ${count} API calls:`, recent);
          return recent;
        },
        showFailures: () => {
          const history = getApiCallHistory();
          const failures = history.filter((call) => !call.success);
          // console.log("❌ Failed API calls:", failures);
          return failures;
        },
        showByEndpoint: (endpoint: string) => {
          const history = getApiCallHistory();
          const filtered = history.filter(
            (call) =>
              call.endpoint?.includes(endpoint) || call.url?.includes(endpoint),
          );
          // console.log(`🔍 API calls matching "${endpoint}":`, filtered);
          return filtered;
        },
      };

      // Add telemetry commands
      (window as any).netstreamTelemetry = {
        getHistory: getTelemetryHistory,
        clearHistory: clearTelemetryHistory,
        downloadData: downloadTelemetryData,
        getStats: getTelemetryStats,
        showStats: () => {
          const stats = getTelemetryStats();
          // console.table(stats);
          return stats;
        },
        showRecent: (count = 5) => {
          const history = getTelemetryHistory();
          const recent = history.slice(0, count);
          // console.log(`📊 Last ${count} telemetry events:`, recent);
          return recent;
        },
        showErrors: () => {
          const history = getTelemetryHistory();
          const errors = history.filter(
            (event) =>
              event.eventType === "error" || event.eventType === "api_error",
          );
          // console.log("❌ Error events:", errors);
          return errors;
        },
        showByType: (eventType: string) => {
          const history = getTelemetryHistory();
          const filtered = history.filter(
            (event) => event.eventType === eventType,
          );
          // console.log(`🔍 Telemetry events of type "${eventType}":`, filtered);
          return filtered;
        },
      };

      // Add debug commands for new features
      (window as any).netstreamDebug = {
        // Breadcrumbs
        getBreadcrumbs,
        showBreadcrumbs: (count = 20) => {
          const breadcrumbs = getBreadcrumbs().slice(0, count);
          // console.log(`🍞 Last ${count} breadcrumbs:`, breadcrumbs);
          return breadcrumbs;
        },
        clearBreadcrumbs,

        // State Snapshots
        getStateSnapshots,
        showSnapshots: () => {
          const snapshots = getStateSnapshots();
          // console.log("📸 State snapshots:", snapshots);
          return snapshots;
        },
        clearSnapshots: clearStateSnapshots,

        // Render Metrics
        getRenderMetrics,
        showSlowRenders: (thresholdMs = 16) => {
          const slow = getSlowRenders(thresholdMs);
          console.log(`⚠️ Slow renders (>${thresholdMs}ms):`, slow);
          return slow;
        },
        clearRenderMetrics,

        // User Actions
        getUserActions: getUserActionSequence,
        showRecentActions: (count = 10) => {
          const actions = getRecentActions(count);
          // console.log(`👆 Last ${count} user actions:`, actions);
          return actions;
        },
        clearUserActions: clearUserActionSequence,

        // Complete Debug Report
        downloadReport: downloadDebugReport,
        exportReport: exportDebugReport,
        showFullReport: () => {
          const report = JSON.parse(exportDebugReport());
          console.log("📋 Full Debug Report:", report);
          return report;
        },
      };

      // Log available commands
//       console.log(`
// 🌐 Netstream Developer Console Commands:

//   === API History ===
//   window.netstreamApiHistory.getHistory()      - Get all API calls
//   window.netstreamApiHistory.showStats()       - Show statistics table
//   window.netstreamApiHistory.showRecent(5)     - Show last 5 calls
//   window.netstreamApiHistory.showFailures()    - Show failed calls only
//   window.netstreamApiHistory.showByEndpoint(path) - Filter by endpoint
//   window.netstreamApiHistory.downloadHistory() - Download as JSON
//   window.netstreamApiHistory.clearHistory()    - Clear all history

//   === Telemetry ===
//   window.netstreamTelemetry.getHistory()       - Get all telemetry events
//   window.netstreamTelemetry.showStats()        - Show statistics table
//   window.netstreamTelemetry.showRecent(10)     - Show last 10 events
//   window.netstreamTelemetry.showErrors()       - Show error events only
//   window.netstreamTelemetry.showByType(type)   - Filter by event type
//   window.netstreamTelemetry.downloadData()     - Download as JSON
//   window.netstreamTelemetry.clearHistory()     - Clear all history

//   === Debug Tools (NEW!) ===
//   window.netstreamDebug.showBreadcrumbs(20)    - Show last 20 user action breadcrumbs
//   window.netstreamDebug.showSnapshots()        - Show Redux state snapshots (captured on errors)
//   window.netstreamDebug.showSlowRenders(16)    - Show component renders slower than 16ms
//   window.netstreamDebug.showRecentActions(10)  - Show last 10 user actions
//   window.netstreamDebug.showFullReport()       - Show complete debug report
//   window.netstreamDebug.downloadReport()       - Download complete debug report as JSON
//   window.netstreamDebug.clearBreadcrumbs()     - Clear breadcrumbs
//   window.netstreamDebug.clearSnapshots()       - Clear state snapshots
//   window.netstreamDebug.clearRenderMetrics()   - Clear render metrics
//   window.netstreamDebug.clearUserActions()     - Clear user action history

//   UI Access: 🌐 (API) and 📊 (Telemetry) buttons in footer
//   Shortcuts: Ctrl+Shift+A (API) | Ctrl+Shift+T (Telemetry)
//       `);
    }

    // Cleanup function
    return () => {
      if (typeof window !== "undefined") {
        if ((window as any).netstreamApiHistory)
          delete (window as any).netstreamApiHistory;
        if ((window as any).netstreamTelemetry)
          delete (window as any).netstreamTelemetry;
        if ((window as any).netstreamDebug)
          delete (window as any).netstreamDebug;
      }
    };
  }, []);

  return {
    getHistory: getApiCallHistory,
    clearHistory: clearApiCallHistory,
    downloadHistory: downloadApiCallHistory,
    getStats: getApiCallStats,
  };
}
