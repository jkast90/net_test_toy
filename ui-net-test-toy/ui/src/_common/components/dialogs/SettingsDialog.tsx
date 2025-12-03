// src/components/SettingsDialog.jsx
// Packages
import { useState, useEffect } from "react";

// Utils
import { THEMES, getCurrentTheme, applyTheme } from "../../utils/themeManager";
import { getDeploymentConfig } from "../../../../deployment-config";

// Contexts
import { useBanner } from "../../hooks/useReduxBanner.ts";

// Components
import { DialogBanner, DialogActions } from "../ui";
import { useAuth } from "@auth/hooks/useReduxAuth";
import { useMobile } from "../../hooks/useReduxMobile.js";
import { usersApi } from "../../services/netstreamApi";

// Styling
import buttonCss from "../../styles/Button.module.css";
import dialogCss from "../../styles/Dialog.module.css";
import utilsCss from "../../styles/utilities.module.css";
import styles from "./Form.module.css";

export default function SettingsDialog({ open, onClose }) {
  // Initialize state for user settings
  const [currentTheme, setCurrentTheme] = useState(() => getCurrentTheme());
  const [userEmail, setUserEmail] = useState("");
  const [emailValid, setEmailValid] = useState(false);

  // Hooks
  const {
    forceFixedWidth,
    fixedWidthValue,
    setForceFixedWidth,
    setFixedWidthValue,
  } = useMobile();
  const { isAuthenticated } = useAuth();
  const { banner, showBanner } = useBanner();

  // Auto-dismiss banners setting
  const [autoDismissBanners, setAutoDismissBanners] = useState(() => {
    return localStorage.getItem("autoDismissBanners") !== "false";
  });

  // Dashboard width settings
  const [dashboardWidth, setDashboardWidth] = useState(() => {
    const stored = localStorage.getItem("dashboardWidth");
    return stored ? parseInt(stored, 10) : 0; // 0 means no fixed width
  });

  const [mobileWidth, setMobileWidth] = useState(() => {
    const stored = localStorage.getItem("mobileWidth");
    return stored ? parseInt(stored, 10) : 0; // 0 means no fixed width
  });

  // API URL setting
  const [apiUrl, setApiUrl] = useState(() => {
    return localStorage.getItem("dashboard_api_url") || import.meta.env.VITE_API_URL || "";
  });

  // Get deployment config for auto-detected values
  const deploymentConfig = getDeploymentConfig();

  // Load user email
  useEffect(() => {
    const storedEmail = localStorage.getItem("userEmail");
    if (storedEmail) {
      setUserEmail(storedEmail);
      setEmailValid(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(storedEmail.trim()));
    }
  }, [open]);

  // Theme change handler
  const handleThemeChange = (e) => {
    const theme = e.target.value;
    setCurrentTheme(theme);
    applyTheme(theme);
  };

  // Send verification email
  const sendVerificationEmail = async () => {
    try {
      const response = await usersApi.sendVerificationEmail();
      showBanner(response.message || "Verification email sent!");
    } catch (err) {
      showBanner(`Failed to send verification email: ${err.message}`);
    }
  };

  // Save settings
  const saveSettings = async () => {
    try {
      // Save email if valid
      if (emailValid) {
        localStorage.setItem("userEmail", userEmail.trim());
      }

      // Save auto-dismiss preference
      localStorage.setItem("autoDismissBanners", autoDismissBanners.toString());

      // Save dashboard width
      localStorage.setItem("dashboardWidth", dashboardWidth.toString());
      localStorage.setItem("mobileWidth", mobileWidth.toString());

      // Save API URL
      if (apiUrl) {
        localStorage.setItem("dashboard_api_url", apiUrl);
      }

      // Apply mobile width settings
      if (forceFixedWidth && fixedWidthValue > 0) {
        document.documentElement.style.setProperty(
          "--mobile-width",
          `${fixedWidthValue}px`
        );
        document.body.classList.add("fixed-width");
      } else {
        document.body.classList.remove("fixed-width");
      }

      showBanner("Settings saved successfully");
      onClose();
    } catch (err) {
      showBanner(`Failed to save settings: ${err.message}`);
    }
  };

  if (!open) return null;

  return (
    <div className={dialogCss.overlay}>
      <div className={`${dialogCss.dialog} ${dialogCss.settingsDialog} ${utilsCss.centerContent}`}>
        <DialogBanner />
        <h3>Settings</h3>
          {/* Dashboard API URL */}
          <div className={styles.formContent}>
            <div className={styles.formRow}>
              <label className={styles.label}>Dashboard API URL:</label>
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://..."
                className={dialogCss.input}
                style={{ width: "100%" }}
              />
              <div style={{fontSize: "0.85em", color: "var(--text-muted)", marginTop: "0.25rem"}}>
                Auto-detected: {deploymentConfig.apiUrl}
              </div>
            </div>
          </div>

          {/* Dashboard User Email */}
          <div className={styles.formContent}>
            <div className={styles.formRow}>
              <label className={styles.label}>Dashboard User:</label>
              <input
                type="email"
                value={userEmail}
                onChange={(e) => {
                  setUserEmail(e.target.value);
                  setEmailValid(
                    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.target.value.trim())
                  );
                }}
                placeholder="your@email.com"
                className={dialogCss.input}
                style={{ width: "100%" }}
              />
              {!emailValid && userEmail && (
                <div style={{color: "red", fontSize: "0.85em", marginTop: "0.25rem"}}>
                  Please enter a valid email address.
                </div>
              )}
              {isAuthenticated && (
                <button
                  type="button"
                  onClick={sendVerificationEmail}
                  className={buttonCss.button}
                  style={{ marginTop: "0.5rem" }}
                >
                  Send Email Verification
                </button>
              )}
            </div>
          </div>

          {/* Theme Selector */}
          <div className={styles.formContent}>
            <div className={styles.formRow}>
              <label className={styles.label}>Theme:</label>
              <select
                value={currentTheme}
                onChange={handleThemeChange}
                className={dialogCss.input}
                style={{ width: "100%" }}
              >
                {Object.entries(THEMES).map(([key, theme]) => (
                  <option key={key} value={key}>
                    {theme.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Auto-dismiss Banners Setting */}
          <div className={styles.formContent}>
            <div className={styles.formRow}>
              <label className={styles.label}>
                <input
                  type="checkbox"
                  checked={autoDismissBanners}
                  onChange={(e) => setAutoDismissBanners(e.target.checked)}
                  style={{ marginRight: "0.5rem" }}
                />
                Auto-dismiss banner messages
              </label>
              <div style={{fontSize: "0.85em", color: "var(--text-muted)", marginTop: "0.25rem"}}>
                When enabled, banners disappear automatically. When disabled, you'll need to close them manually.
              </div>
            </div>
          </div>

          {/* Dashboard Width Setting */}
          <div className={styles.formContent}>
            <div className={styles.formRow}>
              <label className={styles.label}>Desktop Width (px):</label>
              <input
                type="number"
                value={dashboardWidth || ""}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10);
                  setDashboardWidth(isNaN(value) ? 0 : value);
                }}
                placeholder="0 (auto-width) or e.g. 1200"
                min="0"
                max="4000"
                className={dialogCss.input}
                style={{ width: "100%" }}
              />
              <div style={{fontSize: "0.85em", color: "var(--text-muted)", marginTop: "0.25rem"}}>
                Set to 0 for auto-width, or specify a fixed width in pixels for desktop screens (e.g., 1200).
              </div>
            </div>
          </div>

          {/* Mobile Width Setting */}
          <div className={styles.formContent}>
            <div className={styles.formRow}>
              <label className={styles.label}>Mobile Width (px):</label>
              <input
                type="number"
                value={mobileWidth || ""}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10);
                  setMobileWidth(isNaN(value) ? 0 : value);
                }}
                placeholder="0 (auto-width) or e.g. 768"
                min="0"
                max="768"
                className={dialogCss.input}
                style={{ width: "100%" }}
              />
              <div style={{fontSize: "0.85em", color: "var(--text-muted)", marginTop: "0.25rem"}}>
                Set to 0 for auto-width, or specify a fixed width in pixels for mobile screens (e.g., 768).
              </div>
            </div>
          </div>

          {/* Force Fixed Width Setting */}
          <div className={styles.formContent}>
            <div className={styles.formRow}>
              <label className={styles.label}>
                <input
                  type="checkbox"
                  checked={forceFixedWidth}
                  onChange={(e) => setForceFixedWidth(e.target.checked)}
                  style={{ marginRight: "0.5rem" }}
                />
                Force fixed width (for testing)
              </label>
              {forceFixedWidth && (
                <input
                  type="number"
                  value={fixedWidthValue}
                  onChange={(e) => setFixedWidthValue(parseInt(e.target.value, 10) || 0)}
                  min="320"
                  max="768"
                  placeholder="Width in pixels"
                  className={dialogCss.input}
                  style={{ width: "100%", marginTop: "0.5rem" }}
                />
              )}
            </div>
          </div>

        <DialogActions
          onCancel={onClose}
          onSubmit={saveSettings}
          cancelText="Cancel"
          submitText="Save"
          sticky={true}
        />
      </div>
    </div>
  );
}