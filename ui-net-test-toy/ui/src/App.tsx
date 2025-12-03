// Packages
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState, useEffect } from "react";
import { Provider } from "react-redux";

// Initialize API tracker (must be imported early to set up fetch interceptor)
import "./_common/utils/apiTracker.ts";

// Redux Store
import { store } from "./_common/store/store.ts";
import { initializeCacheListener } from "./_common/store/slices/cacheSlice.ts";

// Contexts
import { AppProviders } from "./_common/components/AppProviders.tsx";

// Pages
import { Auth } from "./auth";
import { NavBar, Footer } from "./_common/components";
import { GlobalNotifications } from "./_common/components/GlobalNotifications";
import { ProtectedRoute } from "./auth/components";
import RouteTracker from "./_common/components/RouteTracker.jsx";
import { Browse } from "./browse";
import { BMPMonitor, NetFlowMonitor, NetworkTesting, Builder, TopologyBuilder } from "./bgp";
import { About } from "./about";


// Dialogs
import { InstructionsDialog } from "./_common/components/dialogs";

// UI Components
import { Button } from "./_common/components/ui";

// Error Handling
import ErrorBoundary from "./_common/components/ErrorBoundary.jsx";

// Styling
import "./App.css";

// Utils
import { logger } from "./_common/utils/logger.ts";
import { setupGlobalErrorHandling } from "./_common/utils/errorReporting.js";
import {
  setupAutoTelemetry,
  trackPageLoad,
  registerReduxStore,
} from "./_common/utils/telemetry";
import { useApiHistoryGlobal } from "./_common/hooks/useApiHistoryGlobal";
import { useConnectionPoller } from "./_common/hooks/useConnectionPoller";
import { useLocalDaemonDiscovery } from "./_common/hooks/useLocalDaemonDiscovery";

function AppWithPrompt() {
  const [showInstructions, setShowInstructions] = useState(() => {
    const hasSeenInstructions = localStorage.getItem('hasSeenInstructions');
    return hasSeenInstructions !== 'true';
  });
  const [tourMode, setTourMode] = useState(false);

  // Setup telemetry and API history tracking
  useApiHistoryGlobal();

  // Setup local daemon auto-discovery from Lab Manager
  useLocalDaemonDiscovery();

  // Setup connection polling for unified API clients
  useConnectionPoller();

  // Setup enhanced error handling
  setupGlobalErrorHandling();

  // Initialize telemetry on mount
  useEffect(() => {
    setupAutoTelemetry();
    trackPageLoad();

    // Initialize cache status listener
    const unsubscribe = initializeCacheListener(store.dispatch);

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Check if '?' is pressed (shift + / on most keyboards)
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        // Don't open if user is typing in an input/textarea
        const activeElement = document.activeElement as HTMLElement;
        const isTyping =
          activeElement &&
          (activeElement.tagName === "INPUT" ||
            activeElement.tagName === "TEXTAREA" ||
            activeElement.contentEditable === "true");

        if (!isTyping) {
          e.preventDefault();
          setShowInstructions(true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, []);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("/service-worker.js")
      .catch((err) => logger.warn("Service worker registration failed:", err));
  }

  return (
    <ErrorBoundary>
      <GlobalNotifications />
      <NavBar />
      <RouteTracker />
      <Routes>
        <Route path="/" element={<TopologyBuilder />} />
        <Route path="/auth" element={<Auth />} />

        <Route
          path="/browse"
          element={
            <ProtectedRoute>
              <Browse />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bmp"
          element={<BMPMonitor />}
        />
        <Route
          path="//netflow"
          element={<NetFlowMonitor />}
        />
        <Route
          path="/testing"
          element={<NetworkTesting />}
        />
        <Route
          path="/dashboard"
          element={<Builder />}
        />
        <Route
          path="/topology"
          element={<TopologyBuilder />}
        />
        <Route
          path="/about"
          element={<About />}
        />
        <Route
          path="*"
          element={
            <div
              style={{
                padding: "2rem",
                textAlign: "center",
                color: "var(--text)",
                backgroundColor: "var(--card-bg)",
                margin: "2rem",
                borderRadius: "8px",
                border: "1px solid var(--accent-dark)",
                boxShadow: "0 2px 8px var(--shadow-color)",
              }}
            >
              <h1 style={{ color: "var(--text)", marginBottom: "1rem" }}>
                404 – Page Not Found
              </h1>
              <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>
                The page you're looking for doesn't exist.
              </p>
              <Button
                onClick={() => window.history.back()}
                style={{ marginRight: "0.5rem" }}
              >
                Go Back
              </Button>
              <a
                href="/"
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: "var(--btn-secondary-bg)",
                  color: "var(--btn-secondary-text)",
                  border: "1px solid var(--accent-dark)",
                  borderRadius: "4px",
                  textDecoration: "none",
                  display: "inline-block",
                }}
              >
                Home
              </a>
            </div>
          }
        />
      </Routes>
      <Footer onHelpClick={() => setShowInstructions(true)} />
      <InstructionsDialog
        open={showInstructions}
        onClose={() => {
          setShowInstructions(false);
          setTourMode(false);
          localStorage.setItem('hasSeenInstructions', 'true');
        }}
        tourMode={tourMode}
        onStartTour={() => {
          setTourMode(true);
        }}
      />
    </ErrorBoundary>
  );
}

export function AppContent() {
  return <AppWithPrompt />;
}

export default function App() {
  // Register Redux store for telemetry state snapshots
  useEffect(() => {
    registerReduxStore(store);
  }, []);

  return (
    <Provider store={store}>
      <AppProviders>
        <BrowserRouter
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <AppContent />
        </BrowserRouter>
      </AppProviders>
    </Provider>
  );
}
