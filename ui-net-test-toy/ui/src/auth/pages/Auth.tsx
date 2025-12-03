// Packages
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useReduxAuth";
import { profilesApi } from "../../_common/services/netstreamApi";

export default function Auth() {
  const navigate = useNavigate();
  const { fetchToken, isAuthenticated, userEmail } = useAuth();

  useEffect(() => {
    // If already authenticated, redirect to app
    if (isAuthenticated) {
      navigate("/", { replace: true });
      return;
    }

    // Otherwise, process the auth callback
    const handleAuth = async () => {
      try {
        await fetchToken();

        // Wait a bit for the token to be processed and email to be stored
        await new Promise(resolve => setTimeout(resolve, 500));

        // After successful authentication, check/create profile
        const email = localStorage.getItem("userEmail");
        console.log("[Auth] Email from localStorage:", email);

        if (email) {
          try {
            // Try to get existing profile
            const profile = await profilesApi.getByEmail(email);
            console.log("[Auth] Found existing profile:", profile);
            // Profile exists, go to home
            navigate("/", { replace: true });
          } catch (error: any) {
            // Profile doesn't exist (404), create it
            console.log("[Auth] Profile lookup error:", error);
            if (error.message?.includes('404') || error.message?.includes('Profile not found')) {
              console.log("[Auth] Creating new profile for:", email);
              const newProfile = await profilesApi.create({ email, first_name: "", last_name: "" });
              console.log("[Auth] Created profile:", newProfile);
              // Redirect to profile page with edit dialog open
              navigate("/profile?edit=true", { replace: true });
            } else {
              // Other error, just go to home
              console.error("Error checking profile:", error);
              navigate("/", { replace: true });
            }
          }
        } else {
          // No email found, just go to home
          console.warn("[Auth] No email found in localStorage");
          navigate("/", { replace: true });
        }
      } catch (error) {
        console.error("Auth failed:", error);
        // fetchToken will handle the redirect to login on error
      }
    };

    handleAuth();
  }, [fetchToken, isAuthenticated, navigate, userEmail]);

  return <div>Authenticating…</div>;
}
