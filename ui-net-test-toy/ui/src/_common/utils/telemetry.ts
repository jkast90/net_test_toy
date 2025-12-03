// General Telemetry Tracking System
// Tracks user interactions, navigation, performance, errors, and usage patterns

const TELEMETRY_KEY = "netstream_telemetry_data";
const MAX_TELEMETRY_ENTRIES = 100;
const SESSION_STORAGE_KEY = "netstream_session_telemetry";
const BREADCRUMB_KEY = "netstream_breadcrumbs";
const MAX_BREADCRUMBS = 50;
const STATE_SNAPSHOT_KEY = "netstream_state_snapshots";
const MAX_STATE_SNAPSHOTS = 10;

// Telemetry event types
export const TELEMETRY_EVENTS = {
  // Navigation
  PAGE_VIEW: "page_view",
  ROUTE_CHANGE: "route_change",

  // User Interactions
  CLICK: "click",
  FORM_SUBMIT: "form_submit",
  DIALOG_OPEN: "dialog_open",
  DIALOG_CLOSE: "dialog_close",
  BUTTON_CLICK: "button_click",
  WORKSPACE_LOAD: "workspace_load",
  LINK_CREATE: "link_create",
  NOTE_CREATE: "note_create",
  THREAD_CREATE: "thread_create",

  // Performance
  PAGE_LOAD_TIME: "page_load_time",
  COMPONENT_RENDER: "component_render",
  API_RESPONSE_TIME: "api_response_time",

  // Errors
  ERROR: "error",
  WARNING: "warning",
  API_ERROR: "api_error",

  // Features
  FEATURE_USE: "feature_use",
  SEARCH: "search",
  FILTER: "filter",
  EXPORT: "export",

  // System
  SESSION_START: "session_start",
  SESSION_END: "session_end",
  VISIBILITY_CHANGE: "visibility_change",

  // Debug
  STATE_SNAPSHOT: "state_snapshot",
  ACTION_SEQUENCE: "action_sequence",
};

export interface TelemetryEvent {
  id: number;
  timestamp: number;
  eventType: string;
  sessionId: string;
  userId: string;
  action?: string;
  category?: string;
  label?: string;
  value?: any;
  url: string;
  pathname: string;
  search: string;
  referrer: string;
  userAgent: string;
  viewport: {
    width: number;
    height: number;
  };
  screen: {
    width: number;
    height: number;
    colorDepth: number;
  };
  memoryUsage: any;
  connectionType: any;
  metadata: Record<string, any>;
  sessionDuration: number;
  pageViewCount: number;
}

interface SessionData {
  sessionId: string;
  startTime: number;
  pageViewCount: number;
  userId: string;
}

/**
 * Logs a telemetry event
 */
export function logTelemetryEvent(
  eventType: string,
  eventData: Partial<TelemetryEvent> = {},
): void {
  try {
    const sessionData = getSessionData();

    // Create the telemetry entry
    const entry: TelemetryEvent = {
      id: Date.now() + Math.random(),
      timestamp: Date.now(),
      eventType,
      sessionId: sessionData.sessionId,
      userId: eventData.userId || sessionData.userId || "anonymous",

      // Event details
      action: eventData.action,
      category: eventData.category,
      label: eventData.label,
      value: eventData.value,

      // Context
      url: window.location.href,
      pathname: window.location.pathname,
      search: window.location.search,
      referrer: document.referrer,

      // Browser/Device info
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      screen: {
        width: window.screen.width,
        height: window.screen.height,
        colorDepth: window.screen.colorDepth,
      },

      // Performance
      memoryUsage: getMemoryUsage(),
      connectionType: getConnectionType(),

      // Custom metadata
      metadata: eventData.metadata || {},

      // Session context
      sessionDuration: Date.now() - sessionData.startTime,
      pageViewCount: sessionData.pageViewCount,
    };

    // Store in localStorage
    saveTelemetryEntry(entry);

    // Also store in session storage for current session tracking
    saveSessionTelemetry(entry);

    // Log to console in development
    // console.log("📊 Telemetry Event:", {
    //   type: eventType,
    //   action: eventData.action,
    //   category: eventData.category,
    //   label: eventData.label,
    //   metadata: eventData.metadata,
    // });
  } catch (error) {
    console.error("Failed to log telemetry event:", error);
  }
}

/**
 * Gets or creates session data
 */
function getSessionData(): SessionData {
  let sessionData: Partial<SessionData> = {};

  try {
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
    sessionData = stored ? JSON.parse(stored) : {};
  } catch (e) {
    console.error("Error reading session data:", e);
  }

  if (!sessionData.sessionId) {
    sessionData = {
      sessionId: generateSessionId(),
      startTime: Date.now(),
      pageViewCount: 0,
      userId: localStorage.getItem("netstream_user_id") || "anonymous",
    };
  }

  return sessionData as SessionData;
}

/**
 * Saves telemetry entry to localStorage
 */
function saveTelemetryEntry(entry: TelemetryEvent): void {
  const existing = getTelemetryHistory();
  const updated = [entry, ...existing];
  const trimmed = updated.slice(0, MAX_TELEMETRY_ENTRIES);

  localStorage.setItem(TELEMETRY_KEY, JSON.stringify(trimmed));
}

/**
 * Saves telemetry entry to session storage for current session
 */
function saveSessionTelemetry(entry: TelemetryEvent): void {
  const sessionData = getSessionData();

  if (entry.eventType === TELEMETRY_EVENTS.PAGE_VIEW) {
    sessionData.pageViewCount += 1;
  }

  sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
}

/**
 * Retrieves telemetry history from localStorage
 */
export function getTelemetryHistory(): TelemetryEvent[] {
  try {
    const historyJson = localStorage.getItem(TELEMETRY_KEY);
    return historyJson ? JSON.parse(historyJson) : [];
  } catch (error) {
    console.error("Failed to retrieve telemetry history:", error);
    return [];
  }
}

/**
 * Clears telemetry history
 */
export function clearTelemetryHistory(): void {
  try {
    localStorage.removeItem(TELEMETRY_KEY);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    // console.log("Telemetry history cleared");
  } catch (error) {
    console.error("Failed to clear telemetry history:", error);
  }
}

/**
 * Gets telemetry statistics and insights
 */
export function getTelemetryStats() {
  const history = getTelemetryHistory();

  const stats = {
    totalEvents: history.length,
    eventTypes: {} as Record<string, number>,
    categories: {} as Record<string, number>,
    topActions: {} as Record<string, number>,
    sessionCount: new Set(history.map((e) => e.sessionId)).size,
    averageSessionDuration: 0,
    mostVisitedPages: {} as Record<string, number>,
    errorCount: 0,
    performanceMetrics: {
      averagePageLoad: 0,
      apiResponseTimes: [] as number[],
    },
    browserInfo: {} as Record<string, number>,
    timeRange: {
      oldest: null as Date | null,
      newest: null as Date | null,
    },
  };

  if (history.length > 0) {
    // Count event types
    history.forEach((event) => {
      stats.eventTypes[event.eventType] =
        (stats.eventTypes[event.eventType] || 0) + 1;

      if (event.category) {
        stats.categories[event.category] =
          (stats.categories[event.category] || 0) + 1;
      }

      if (event.action) {
        stats.topActions[event.action] =
          (stats.topActions[event.action] || 0) + 1;
      }

      if (event.pathname) {
        stats.mostVisitedPages[event.pathname] =
          (stats.mostVisitedPages[event.pathname] || 0) + 1;
      }

      if (
        event.eventType === TELEMETRY_EVENTS.ERROR ||
        event.eventType === TELEMETRY_EVENTS.API_ERROR
      ) {
        stats.errorCount++;
      }

      // Performance metrics
      if (event.eventType === TELEMETRY_EVENTS.PAGE_LOAD_TIME && event.value) {
        stats.performanceMetrics.averagePageLoad += event.value;
      }

      if (
        event.eventType === TELEMETRY_EVENTS.API_RESPONSE_TIME &&
        event.value
      ) {
        stats.performanceMetrics.apiResponseTimes.push(event.value);
      }

      // Browser info
      if (event.userAgent) {
        const browser = getBrowserFromUserAgent(event.userAgent);
        stats.browserInfo[browser] = (stats.browserInfo[browser] || 0) + 1;
      }
    });

    // Calculate averages
    const pageLoadEvents = history.filter(
      (e) => e.eventType === TELEMETRY_EVENTS.PAGE_LOAD_TIME && e.value,
    );
    if (pageLoadEvents.length > 0) {
      stats.performanceMetrics.averagePageLoad = Math.round(
        pageLoadEvents.reduce((sum, e) => sum + e.value, 0) /
          pageLoadEvents.length,
      );
    }

    // Session duration
    const sessionDurations = history
      .filter((e) => e.sessionDuration)
      .map((e) => e.sessionDuration);

    if (sessionDurations.length > 0) {
      stats.averageSessionDuration = Math.round(
        sessionDurations.reduce((sum, duration) => sum + duration, 0) /
          sessionDurations.length,
      );
    }

    // Time range
    stats.timeRange.oldest = new Date(history[history.length - 1].timestamp);
    stats.timeRange.newest = new Date(history[0].timestamp);
  }

  return stats;
}

/**
 * Exports telemetry data as JSON
 */
export function exportTelemetryData(): string {
  const history = getTelemetryHistory();
  const stats = getTelemetryStats();

  return JSON.stringify(
    {
      exportTimestamp: Date.now(),
      stats,
      events: history,
    },
    null,
    2,
  );
}

/**
 * Downloads telemetry data as JSON file
 */
export function downloadTelemetryData(): void {
  try {
    const data = exportTelemetryData();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `netstream_telemetry_${
      new Date().toISOString().split("T")[0]
    }.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
    // console.log("Telemetry data downloaded");
  } catch (error) {
    console.error("Failed to download telemetry data:", error);
  }
}

// Utility functions

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getMemoryUsage(): any {
  if ((performance as any).memory) {
    return {
      usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
      totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
      jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit,
    };
  }
  return null;
}

function getConnectionType(): any {
  if ((navigator as any).connection) {
    return {
      effectiveType: (navigator as any).connection.effectiveType,
      downlink: (navigator as any).connection.downlink,
      rtt: (navigator as any).connection.rtt,
    };
  }
  return null;
}

function getBrowserFromUserAgent(userAgent: string): string {
  if (userAgent.includes("Chrome")) return "Chrome";
  if (userAgent.includes("Firefox")) return "Firefox";
  if (userAgent.includes("Safari")) return "Safari";
  if (userAgent.includes("Edge")) return "Edge";
  return "Other";
}

// Auto-tracking setup functions

/**
 * Sets up automatic telemetry tracking for common events
 */
export function setupAutoTelemetry(): void {
  // Track page visibility changes
  document.addEventListener("visibilitychange", () => {
    logTelemetryEvent(TELEMETRY_EVENTS.VISIBILITY_CHANGE, {
      action: document.hidden ? "hidden" : "visible",
      category: "system",
    });
  });

  // Track page unload
  window.addEventListener("beforeunload", () => {
    logTelemetryEvent(TELEMETRY_EVENTS.SESSION_END, {
      category: "system",
      action: "page_unload",
    });
  });

  // Track errors
  window.addEventListener("error", (event) => {
    // Capture state snapshot on error
    captureStateSnapshot("javascript_error", {
      error: {
        message: event.error?.message || "Unknown error",
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
      },
    });

    // Add breadcrumb
    addBreadcrumb(
      "error",
      event.error?.message || "Unknown error",
      {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
      "error",
    );

    logTelemetryEvent(TELEMETRY_EVENTS.ERROR, {
      category: "error",
      action: "javascript_error",
      label: event.error?.message || "Unknown error",
      metadata: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
      },
    });
  });

  // Track unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    // Capture state snapshot on error
    captureStateSnapshot("unhandled_promise_rejection", {
      error: {
        message: event.reason?.message || "Unhandled promise rejection",
        reason: event.reason,
      },
    });

    // Add breadcrumb
    addBreadcrumb(
      "error",
      event.reason?.message || "Unhandled promise rejection",
      {
        reason: event.reason,
      },
      "error",
    );

    logTelemetryEvent(TELEMETRY_EVENTS.ERROR, {
      category: "error",
      action: "unhandled_promise_rejection",
      label: event.reason?.message || "Unhandled promise rejection",
      metadata: {
        reason: event.reason,
      },
    });
  });

  // Log session start
  logTelemetryEvent(TELEMETRY_EVENTS.SESSION_START, {
    category: "system",
    action: "session_start",
  });
}

/**
 * Tracks page load performance
 */
export function trackPageLoad(): void {
  window.addEventListener("load", () => {
    setTimeout(() => {
      const perfData = performance.getEntriesByType("navigation")[0] as any;
      if (perfData) {
        logTelemetryEvent(TELEMETRY_EVENTS.PAGE_LOAD_TIME, {
          category: "performance",
          action: "page_load",
          value: Math.round(perfData.loadEventEnd - perfData.loadEventStart),
          metadata: {
            domContentLoaded: Math.round(
              perfData.domContentLoadedEventEnd -
                perfData.domContentLoadedEventStart,
            ),
            firstContentfulPaint: getFirstContentfulPaint(),
            totalLoadTime: Math.round(
              perfData.loadEventEnd - perfData.fetchStart,
            ),
          },
        });
      }
    }, 0);
  });
}

function getFirstContentfulPaint(): number | null {
  const paintEntries = performance.getEntriesByType("paint");
  const fcp = paintEntries.find(
    (entry) => entry.name === "first-contentful-paint",
  );
  return fcp ? Math.round(fcp.startTime) : null;
}

// ============================================================================
// BREADCRUMB TRAIL - Track user action sequences for debugging
// ============================================================================

export interface Breadcrumb {
  id: string;
  timestamp: number;
  sessionId: string;
  type: string;
  category: string;
  message: string;
  data?: any;
  level: "info" | "warning" | "error";
}

/**
 * Adds a breadcrumb to the trail
 */
export function addBreadcrumb(
  type: string,
  message: string,
  data?: any,
  level: "info" | "warning" | "error" = "info",
): void {
  try {
    const sessionData = getSessionData();
    const breadcrumb: Breadcrumb = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      sessionId: sessionData.sessionId,
      type,
      category: categorizeBreadcrumb(type),
      message,
      data,
      level,
    };

    const breadcrumbs = getBreadcrumbs();
    const updated = [breadcrumb, ...breadcrumbs].slice(0, MAX_BREADCRUMBS);
    localStorage.setItem(BREADCRUMB_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error("Failed to add breadcrumb:", error);
  }
}

/**
 * Gets all breadcrumbs
 */
export function getBreadcrumbs(): Breadcrumb[] {
  try {
    const stored = localStorage.getItem(BREADCRUMB_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Failed to get breadcrumbs:", error);
    return [];
  }
}

/**
 * Gets breadcrumbs for a specific session
 */
export function getBreadcrumbsForSession(sessionId: string): Breadcrumb[] {
  return getBreadcrumbs().filter((b) => b.sessionId === sessionId);
}

/**
 * Clears all breadcrumbs
 */
export function clearBreadcrumbs(): void {
  localStorage.removeItem(BREADCRUMB_KEY);
}

/**
 * Gets recent breadcrumbs leading up to an error (last N breadcrumbs)
 */
export function getErrorContext(count: number = 10): Breadcrumb[] {
  return getBreadcrumbs().slice(0, count);
}

function categorizeBreadcrumb(type: string): string {
  if (type.includes("click") || type.includes("submit")) return "user_action";
  if (type.includes("api") || type.includes("fetch")) return "network";
  if (type.includes("route") || type.includes("navigate")) return "navigation";
  if (type.includes("error") || type.includes("fail")) return "error";
  if (type.includes("render") || type.includes("mount")) return "ui";
  return "system";
}

// ============================================================================
// REDUX STATE SNAPSHOTS - Capture app state on errors
// ============================================================================

export interface StateSnapshot {
  id: string;
  timestamp: number;
  sessionId: string;
  trigger: string;
  state: any;
  breadcrumbs: Breadcrumb[];
  url: string;
  userAgent: string;
}

let reduxStoreReference: any = null;

/**
 * Register the Redux store for state snapshots
 */
export function registerReduxStore(store: any): void {
  reduxStoreReference = store;
  // console.log("📦 Redux store registered for telemetry");
}

/**
 * Captures a snapshot of the current Redux state
 */
export function captureStateSnapshot(
  trigger: string,
  additionalData?: any,
): StateSnapshot | null {
  try {
    if (!reduxStoreReference) {
      console.warn("Redux store not registered for state snapshots");
      return null;
    }

    const sessionData = getSessionData();
    const state = reduxStoreReference.getState();

    // Sanitize state to remove sensitive data
    const sanitizedState = sanitizeState(state);

    const snapshot: StateSnapshot = {
      id: `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      sessionId: sessionData.sessionId,
      trigger,
      state: sanitizedState,
      breadcrumbs: getErrorContext(15), // Last 15 breadcrumbs
      url: window.location.href,
      userAgent: navigator.userAgent,
      ...additionalData,
    };

    // Save snapshot
    const snapshots = getStateSnapshots();
    const updated = [snapshot, ...snapshots].slice(0, MAX_STATE_SNAPSHOTS);
    localStorage.setItem(STATE_SNAPSHOT_KEY, JSON.stringify(updated));

    // console.log("📸 State snapshot captured:", trigger);
    return snapshot;
  } catch (error) {
    console.error("Failed to capture state snapshot:", error);
    return null;
  }
}

/**
 * Gets all state snapshots
 */
export function getStateSnapshots(): StateSnapshot[] {
  try {
    const stored = localStorage.getItem(STATE_SNAPSHOT_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Failed to get state snapshots:", error);
    return [];
  }
}

/**
 * Clears all state snapshots
 */
export function clearStateSnapshots(): void {
  localStorage.removeItem(STATE_SNAPSHOT_KEY);
}

/**
 * Sanitizes state to remove sensitive information
 */
function sanitizeState(state: any): any {
  if (!state) return state;

  const sanitized = JSON.parse(JSON.stringify(state));

  // Remove sensitive fields
  const sensitiveKeys = [
    "password",
    "token",
    "secret",
    "apiKey",
    "credentials",
  ];

  function recursiveSanitize(obj: any): void {
    if (typeof obj !== "object" || obj === null) return;

    for (const key in obj) {
      if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
        obj[key] = "[REDACTED]";
      } else if (typeof obj[key] === "object") {
        recursiveSanitize(obj[key]);
      }
    }
  }

  recursiveSanitize(sanitized);
  return sanitized;
}

// ============================================================================
// COMPONENT RENDER TRACKING - Track component performance
// ============================================================================

export interface RenderMetric {
  componentName: string;
  timestamp: number;
  duration: number;
  phase: "mount" | "update";
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
}

const renderMetrics: RenderMetric[] = [];
const MAX_RENDER_METRICS = 100;

/**
 * Tracks component render performance
 */
export function trackComponentRender(
  id: string,
  phase: "mount" | "update",
  actualDuration: number,
  baseDuration: number,
  startTime: number,
  commitTime: number,
): void {
  const metric: RenderMetric = {
    componentName: id,
    timestamp: Date.now(),
    duration: actualDuration,
    phase,
    actualDuration,
    baseDuration,
    startTime,
    commitTime,
  };

  renderMetrics.unshift(metric);

  // Keep only recent metrics in memory
  if (renderMetrics.length > MAX_RENDER_METRICS) {
    renderMetrics.pop();
  }

  // Log slow renders (> 16ms for 60fps)
  if (actualDuration > 16) {
    console.warn(
      `⚠️ Slow render detected: ${id} took ${actualDuration.toFixed(
        2,
      )}ms (${phase})`,
    );
    addBreadcrumb(
      "slow_render",
      `${id} took ${actualDuration.toFixed(2)}ms`,
      {
        phase,
        actualDuration,
        baseDuration,
      },
      "warning",
    );
  }
}

/**
 * Gets render metrics
 */
export function getRenderMetrics(): RenderMetric[] {
  return [...renderMetrics];
}

/**
 * Gets slow renders (above threshold)
 */
export function getSlowRenders(thresholdMs: number = 16): RenderMetric[] {
  return renderMetrics.filter((m) => m.duration > thresholdMs);
}

/**
 * Clears render metrics
 */
export function clearRenderMetrics(): void {
  renderMetrics.length = 0;
}

// ============================================================================
// USER ACTION REPLAY - Track sequence of user actions
// ============================================================================

export interface UserAction {
  id: string;
  timestamp: number;
  sessionId: string;
  type: string;
  target: string;
  details: any;
  url: string;
  viewport: { width: number; height: number };
}

const userActionSequence: UserAction[] = [];
const MAX_USER_ACTIONS = 100;

/**
 * Records a user action for replay
 */
export function recordUserAction(
  type: string,
  target: string,
  details?: any,
): void {
  try {
    const sessionData = getSessionData();

    const action: UserAction = {
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      sessionId: sessionData.sessionId,
      type,
      target,
      details: details || {},
      url: window.location.href,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    };

    userActionSequence.unshift(action);

    // Keep only recent actions in memory
    if (userActionSequence.length > MAX_USER_ACTIONS) {
      userActionSequence.pop();
    }

    // Also add as breadcrumb
    addBreadcrumb(type, `User ${type} on ${target}`, details, "info");
  } catch (error) {
    console.error("Failed to record user action:", error);
  }
}

/**
 * Gets user action sequence
 */
export function getUserActionSequence(): UserAction[] {
  return [...userActionSequence];
}

/**
 * Gets recent user actions (last N)
 */
export function getRecentActions(count: number = 10): UserAction[] {
  return userActionSequence.slice(0, count);
}

/**
 * Clears user action sequence
 */
export function clearUserActionSequence(): void {
  userActionSequence.length = 0;
}

/**
 * Exports a complete debug report with all telemetry data
 */
export function exportDebugReport(): string {
  const report = {
    timestamp: Date.now(),
    sessionId: getSessionData().sessionId,
    url: window.location.href,
    userAgent: navigator.userAgent,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    telemetry: {
      events: getTelemetryHistory().slice(0, 50),
      stats: getTelemetryStats(),
    },
    breadcrumbs: getBreadcrumbs(),
    stateSnapshots: getStateSnapshots(),
    renderMetrics: getRenderMetrics(),
    userActions: getUserActionSequence(),
    performance: {
      memory: getMemoryUsage(),
      connection: getConnectionType(),
    },
  };

  return JSON.stringify(report, null, 2);
}

/**
 * Downloads complete debug report
 */
export function downloadDebugReport(): void {
  try {
    const report = exportDebugReport();
    const blob = new Blob([report], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `debug_report_${
      new Date().toISOString().split("T")[0]
    }_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
    console.log("📥 Debug report downloaded");
  } catch (error) {
    console.error("Failed to download debug report:", error);
  }
}
