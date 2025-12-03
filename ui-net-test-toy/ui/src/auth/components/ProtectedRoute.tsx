import React, { useState, useEffect } from "react";
import { useAuth } from "../hooks/useReduxAuth";
import {
  getCognitoDomain,
  getCognitoClientId,
  getAuthEnabled,
  getBypassEmail,
} from "../../_common/settings";
import EmailPromptDialog from "../../_common/components/dialogs/EmailPromptDialog";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading, redirectToLogin, setUserEmail } =
    useAuth();
  const [authEnabled, setAuthEnabledState] = useState(getAuthEnabled());
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);

  // Check auth settings on mount and when they change
  useEffect(() => {
    const currentAuthEnabled = getAuthEnabled();
    setAuthEnabledState(currentAuthEnabled);

    if (!currentAuthEnabled) {
      const bypassEmail = getBypassEmail();
      if (!bypassEmail) {
        setShowEmailPrompt(true);
      } else {
        // Set the bypass email as the user email
        setUserEmail(bypassEmail);
      }
    }
  }, [setUserEmail]);

  const handleEmailSet = (email) => {
    setUserEmail(email);
    setShowEmailPrompt(false);
  };

  console.log(
    "[ProtectedRoute] Render - authEnabled:",
    authEnabled,
    "isAuthenticated:",
    isAuthenticated,
    "isLoading:",
    isLoading,
  );

  // If auth is disabled, show email prompt if needed
  if (!authEnabled) {
    if (showEmailPrompt) {
      return <EmailPromptDialog open={true} onEmailSet={handleEmailSet} />;
    }
    // Auth is disabled and we have an email, allow access
    return children;
  }

  if (isLoading) {
    console.log("[ProtectedRoute] Still loading authentication state");
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    console.log("[ProtectedRoute] User not authenticated, redirecting to login");

    // Save current route before redirecting to login (but not for logout flows)
    const currentPath = window.location.pathname + window.location.search;
    const isLogout = currentPath.includes("_logout=true");

    if (!isLogout && currentPath !== "/" && !currentPath.startsWith("/auth")) {
      console.log(
        "[ProtectedRoute] Saving current route before login redirect:",
        currentPath,
      );
      localStorage.setItem("lastVisitedRoute", currentPath);
    } else {
      console.log(
        "[ProtectedRoute] Not saving route (logout flow or home/auth page)",
      );
      localStorage.removeItem("lastVisitedRoute");
    }

    const cognitoDomain = getCognitoDomain();
    const clientId = getCognitoClientId();
    const redirectUri = `${window.location.origin}/auth`;

    // Redirect to cognito UI login page
    const loginUri = `${cognitoDomain}/oauth2/authorize?client_id=${clientId}&response_type=code&scope=openid%20email&redirect_uri=${encodeURIComponent(
      redirectUri,
    )}`;

    console.log("[ProtectedRoute] Redirecting to cognito UI:", loginUri);

    // Redirect to Cognito UI login
    window.location.replace(loginUri);
    return <div>Redirecting to login...</div>;
  }

  return children;
}
