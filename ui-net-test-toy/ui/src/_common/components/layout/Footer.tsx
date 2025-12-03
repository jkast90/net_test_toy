// src/components/Footer.jsx
// Packages
import { useEffect, useState, useRef } from "react";

// Settings
import {
  getCognitoDomain,
  getCognitoClientId,
  getWorkspaceApiBaseUrl,
} from "../../settings.ts";

// Contexts
import { useUser } from "@auth/hooks/useReduxAuth";
import { useApiTracker } from "../../hooks/useApiTracker.ts";

// Components
import { SettingsDialog } from "../dialogs";
import { TooltipWrapper } from "../ui";
import ApiCallHistory from "../dialogs/ApiCallHistory";
import TelemetryViewer from "../dialogs/TelemetryViewer";

// Utils
import { logger } from "../../utils/logger.ts";
import {
  clearStorageItems,
} from "../../utils/storageUtils.js";
import { STORAGE_KEYS } from "../../constants/index.ts";
import {
  getCurrentTheme,
  applyTheme,
  THEMES,
} from "../../utils/themeManager.js";

// Styling
import styles from "./Footer.module.css";
import buttonCss from "../../styles/Button.module.css";

export default function Footer({ onHelpClick }) {
  try {
    // theme
    const [currentTheme, setCurrentTheme] = useState(() => getCurrentTheme());
    const [themeDrawerOpen, setThemeDrawerOpen] = useState(false);
    const themeDrawerTimeoutRef = useRef(null);
    const themeButtonWrapperRef = useRef(null);

    // Listen for theme changes from other sources (like settings dialog)
    useEffect(() => {
      const handleThemeChange = (e) => {
        setCurrentTheme(e.detail.theme);
      };

      window.addEventListener("themeChanged", handleThemeChange);
      return () =>
        window.removeEventListener("themeChanged", handleThemeChange);
    }, []);

    const cycleTheme = () => {
      const themeKeys = Object.keys(THEMES) as Array<keyof typeof THEMES>;
      const currentIndex = themeKeys.indexOf(currentTheme as keyof typeof THEMES);
      const nextIndex = (currentIndex + 1) % themeKeys.length;
      const nextTheme = themeKeys[nextIndex];
      applyTheme(nextTheme);
      setCurrentTheme(nextTheme);

      // Show drawer when theme changes
      setThemeDrawerOpen(true);

      // Clear any existing timeout
      if (themeDrawerTimeoutRef.current) {
        clearTimeout(themeDrawerTimeoutRef.current);
      }

      // Set timeout to close drawer after 2 seconds
      themeDrawerTimeoutRef.current = setTimeout(() => {
        setThemeDrawerOpen(false);
      }, 2000);
    };

    const handleThemeSelect = (themeName: keyof typeof THEMES) => {
      applyTheme(themeName);
      setCurrentTheme(themeName);
      setThemeDrawerOpen(false);
    };

    const handleThemeDrawerMouseEnter = () => {
      // Show drawer on hover and clear any close timeout
      setThemeDrawerOpen(true);
      if (themeDrawerTimeoutRef.current) {
        clearTimeout(themeDrawerTimeoutRef.current);
        themeDrawerTimeoutRef.current = null;
      }
    };

    const handleThemeDrawerMouseLeave = () => {
      // Only start close timeout when mouse leaves both drawer and button
      if (themeDrawerTimeoutRef.current) {
        clearTimeout(themeDrawerTimeoutRef.current);
      }
      themeDrawerTimeoutRef.current = setTimeout(() => {
        setThemeDrawerOpen(false);
      }, 300);
    };

    const { userEmail, clearUser } = useUser();
    // const { adminOverride, toggleAdminOverride } = useAdmin();
    const adminOverride = false; // Stub
    const toggleAdminOverride = () => {}; // Stub
    const { isLoading: apiLoading, activeRequests } = useApiTracker();

    // Use global API loading
    const isLoading = apiLoading;
    const [settingsOpen, setSettings] = useState(false);
    const [apiHistoryOpen, setApiHistoryOpen] = useState(false);
    const [telemetryOpen, setTelemetryOpen] = useState(false);
    const [settingsHovered, setSettingsHovered] = useState(false);
    const apiUrl = getWorkspaceApiBaseUrl();


    const settingsButtonRef = useRef(null);


    // Keyboard shortcuts
    useEffect(() => {
      const handleKeyDown = (e) => {
        // Check if we're not already typing in an input/textarea
        const activeElement = document.activeElement as HTMLElement | null;
        const isTyping =
          activeElement &&
          (activeElement.tagName === "INPUT" ||
            activeElement.tagName === "TEXTAREA" ||
            activeElement.contentEditable === "true");

        if (isTyping) return; // Don't handle shortcuts while typing

        // Shift+S: Settings
        if (e.shiftKey && e.key.toLowerCase() === "s") {
          e.preventDefault();
          setSettings(true);
        }

        // Ctrl/Cmd+Shift+A: API History
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "A") {
          e.preventDefault();
          setApiHistoryOpen(true);
        }

        // Ctrl/Cmd+Shift+T: Telemetry
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "T") {
          e.preventDefault();
          setTelemetryOpen(true);
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }, []);

    // Admin override click detection
    const clickCount = useRef(0);
    const clickTimeout = useRef(null);

    const handleSettingsClick = (e) => {
      e.preventDefault(); // Prevent any default behavior
      clickCount.current++;

      console.log(`[Footer] Click ${clickCount.current} detected`);

      if (clickTimeout.current) {
        clearTimeout(clickTimeout.current);
      }

      clickTimeout.current = setTimeout(() => {
        console.log(
          `[Footer] Timeout reached with ${clickCount.current} clicks`,
        );

        if (clickCount.current >= 5) {
          // 5+ clicks detected - toggle admin override
          console.log(
            `[Footer] ${clickCount.current} clicks detected - toggling admin override`,
          );
          toggleAdminOverride();
          showAdminFeedback();
        } else if (clickCount.current === 1) {
          // Single click - open settings after delay
          console.log("[Footer] Single click - opening settings");
          setSettings(true);
        } else {
          console.log(`[Footer] ${clickCount.current} clicks - doing nothing`);
        }
        // For 2-3 clicks, do nothing (just reset)
        clickCount.current = 0;
      }, 600); // Increased to 600ms window to give more time for 4 clicks
    };

    // Admin override visual feedback function
    const showAdminFeedback = () => {
      if (settingsButtonRef.current) {
        settingsButtonRef.current.style.transform = "scale(0.9)";
        settingsButtonRef.current.style.backgroundColor = adminOverride
          ? "#ff4444"
          : "#44ff44";
        setTimeout(() => {
          if (settingsButtonRef.current) {
            settingsButtonRef.current.style.transform = "";
            settingsButtonRef.current.style.backgroundColor = "";
          }
        }, 300);
      }
    };

    // Handle logout
    const handleLogout = () => {
      logger.auth("Logout initiated by user");

      // Redirect to Cognito logout endpoint immediately
      // Do NOT clear state or localStorage before redirect - this causes error flashes
      const cognitoDomain = getCognitoDomain();
      const clientId = getCognitoClientId();
      const logoutUri = `${window.location.origin}`;
      const logoutUrl = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(
        logoutUri,
      )}`;

      logger.auth("Redirecting to Cognito logout", { logoutUrl });

      // Clear storage and state synchronously just before redirect
      const authKeys = [
        STORAGE_KEYS.AUTH_ACCESS_TOKEN,
        STORAGE_KEYS.AUTH_ID_TOKEN,
        STORAGE_KEYS.AUTH_REFRESH_TOKEN,
        STORAGE_KEYS.USER_EMAIL,
        STORAGE_KEYS.LAST_VISITED_ROUTE,
      ];
      clearStorageItems(authKeys);

      // Use replace to redirect immediately without triggering re-render
      window.location.replace(logoutUrl);
    };

    return (
      <footer className={styles.footer}>
        {/* far‐left column */}
        <div className={styles.footerLeft}>
          <div className={styles.footerLine}>
            {(isLoading || true) && (
              <span
                className={styles.loadingIndicator}
                title={
                  isLoading
                    ? `Loading... (${activeRequests} active request${
                        activeRequests !== 1 ? "s" : ""
                      })`
                    : "No active requests"
                }
              >
                <span
                  className={`${styles.loadingDot} ${
                    !isLoading ? styles.idle : ""
                  }`}
                ></span>
              </span>
            )}
            {userEmail && userEmail.includes("@") ? (
              <span className={styles.emailWrapper}>
                <span>{userEmail.split("@")[0]}</span>
                <span>@{userEmail.split("@")[1]}</span>
              </span>
            ) : (
              userEmail
            )}
          </div>
          <div className={`${styles.footerLine} ${styles.hiddenOnDefault}`}>
            {apiUrl}
          </div>
          <div className={`${styles.footerLine} ${styles.hiddenOnDefault}`}>
            build: {__BUILD_INFO__.version}
          </div>
        </div>

        {/* perfectly centered */}
        <div className={styles.footerCenter}></div>

        {/* far‐right */}
        <div className={styles.footerRight}>
          {settingsHovered && (
            <>
              <TooltipWrapper
                tooltip="API Call History (Ctrl+Shift+A)"
                direction="above"
              >
                <button
                  className={buttonCss.button}
                  onClick={() => setApiHistoryOpen(true)}
                >
                  🌐
                </button>
              </TooltipWrapper>
              <TooltipWrapper
                tooltip="Telemetry Dashboard (Ctrl+Shift+T)"
                direction="above"
              >
                <button
                  className={buttonCss.button}
                  onClick={() => setTelemetryOpen(true)}
                >
                  📊
                </button>
              </TooltipWrapper>
            </>
          )}
          <div
            className={styles.themeButtonWrapper}
            ref={themeButtonWrapperRef}
            onMouseEnter={handleThemeDrawerMouseEnter}
            onMouseLeave={handleThemeDrawerMouseLeave}
          >
            <div
              className={`${styles.themeDrawer} ${
                themeDrawerOpen ? styles.open : ""
              }`}
            >
              <div className={styles.themeList}>
                {Object.entries(THEMES).map(([key, theme]) => (
                  <div
                    key={key}
                    className={`${styles.themeItem} ${
                      currentTheme === key ? styles.active : ""
                    }`}
                    onClick={() => handleThemeSelect(key as keyof typeof THEMES)}
                  >
                    <span className={styles.themeName}>{theme.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <TooltipWrapper
              tooltip={`Theme: ${THEMES[currentTheme]?.name || "Unknown"}`}
              direction="above"
            >
              <button className={buttonCss.button} onClick={cycleTheme}>
                {currentTheme.includes("dark") ? "●" : "○"}
              </button>
            </TooltipWrapper>
          </div>
          <TooltipWrapper tooltip="Logout" direction="above">
            <button className={buttonCss.button} onClick={handleLogout}>
              ←
            </button>
          </TooltipWrapper>
          <TooltipWrapper tooltip="Help & Instructions" direction="above">
            <button className={buttonCss.button} onClick={onHelpClick}>
              ?
            </button>
          </TooltipWrapper>
          <div
            onMouseEnter={() => setSettingsHovered(true)}
            onMouseLeave={() => setSettingsHovered(false)}
          >
            <TooltipWrapper tooltip="Settings" direction="above">
              <button
                ref={settingsButtonRef}
                className={buttonCss.button}
                onClick={handleSettingsClick}
              >
                ⚙️
              </button>
            </TooltipWrapper>
          </div>
        </div>

        <SettingsDialog
          open={settingsOpen}
          onClose={() => setSettings(false)}
        />
        <ApiCallHistory
          isOpen={apiHistoryOpen}
          onClose={() => setApiHistoryOpen(false)}
        />
        <TelemetryViewer
          isOpen={telemetryOpen}
          onClose={() => setTelemetryOpen(false)}
        />
      </footer>
    );
  } catch (error) {
    logger.error("Footer component error:", error);
    return <div>Footer Error: {error.message}</div>;
  }
}
