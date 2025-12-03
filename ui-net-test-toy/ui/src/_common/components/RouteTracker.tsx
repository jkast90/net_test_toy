// src/components/RouteTracker.jsx
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../auth/hooks/useReduxAuth";
import { logTelemetryEvent, TELEMETRY_EVENTS } from "../utils/telemetry";

export default function RouteTracker() {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const pageStartTime = useRef<number>(Date.now());
  const previousPath = useRef<string>("");

  useEffect(() => {
    const currentPath = location.pathname + location.search;

    // Track time spent on previous page when route changes
    if (previousPath.current && previousPath.current !== currentPath) {
      const timeSpent = Date.now() - pageStartTime.current;

      logTelemetryEvent(TELEMETRY_EVENTS.PAGE_VIEW, {
        category: "navigation",
        action: "page_exit",
        label: previousPath.current,
        value: timeSpent,
        metadata: {
          timeSpentMs: timeSpent,
          timeSpentSeconds: Math.round(timeSpent / 1000),
          nextPage: currentPath,
        },
      });

      // console.log(
      //   `📊 Time on ${previousPath.current}: ${Math.round(timeSpent / 1000)}s`,
      // );
    }

    // Log the new page view
    logTelemetryEvent(TELEMETRY_EVENTS.PAGE_VIEW, {
      category: "navigation",
      action: "page_enter",
      label: currentPath,
      metadata: {
        previousPage: previousPath.current || "initial",
        authenticated: isAuthenticated,
      },
    });

    // Update refs for next route change
    previousPath.current = currentPath;
    pageStartTime.current = Date.now();

    // Save current route whenever it changes during normal navigation
    // Only save if user is authenticated and not on auth route
    // Don't save "/" route if we have a saved route (restoration in progress)
    // console.log(
    //   "[RouteTracker] Effect triggered - isAuthenticated:",
    //   isAuthenticated,
    //   "isLoading:",
    //   isLoading,
    //   "location:",
    //   location.pathname + location.search,
    // );

    if (isAuthenticated && !isLoading && location.pathname !== "/auth") {
      const savedRoute = localStorage.getItem("lastVisitedRoute");

      // Don't overwrite saved route if we're on "/" and have a valid saved route
      if (
        location.pathname === "/" &&
        savedRoute &&
        savedRoute !== "/" &&
        savedRoute !== "/auth"
      ) {
        // console.log(
        //   '[RouteTracker] Skipping save of "/" - restoration pending for:',
        //   savedRoute,
        // );
        return;
      }

      // console.log(
      //   "[RouteTracker] Saving route during navigation:",
      //   location.pathname + location.search,
      // );
      localStorage.setItem(
        "lastVisitedRoute",
        location.pathname + location.search,
      );
      // console.log(
      //   "[RouteTracker] Saved! localStorage now contains:",
      //   localStorage.getItem("lastVisitedRoute"),
      // );
    } else {
      // console.log(
      //   "[RouteTracker] Not saving route - authenticated:",
      //   isAuthenticated,
      //   "loading:",
      //   isLoading,
      //   "path:",
      //   location.pathname,
      // );
    }
  }, [location.pathname, location.search, isAuthenticated, isLoading]);

  useEffect(() => {
    // Clear saved route when user logs out
    // Only clear if user was previously authenticated (don't clear during initial load/OAuth flow)
    if (!isAuthenticated && !isLoading) {
      const wasAuthenticated = localStorage.getItem("auth_access_token");
      if (!wasAuthenticated) {
        // User was never authenticated, don't clear saved route (might be OAuth flow)
        // console.log(
        //   "[RouteTracker] Not clearing route - user was never authenticated (OAuth flow)",
        // );
      } else {
        // User had tokens but now doesn't - real logout
        // console.log("[RouteTracker] User logged out, clearing saved route");
        // localStorage.removeItem("lastVisitedRoute");
      }
    }
  }, [isAuthenticated, isLoading]);

  return null; // This component doesn't render anything
}
