import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "../../_common/store/hooks";
import {
  setUserEmail,
  storeTokens,
  clearUser,
  redirectToLogin,
  redirectToApp,
  fetchToken,
  refreshAccessToken,
  validateToken,
} from "../store/authSlice";

export function useAuth() {
  const dispatch = useAppDispatch();
  const authState = useAppSelector((state) => state.auth);

  const handleFetchToken = useCallback(() => {
    return dispatch(fetchToken());
  }, [dispatch]);

  const handleRefreshAccessToken = useCallback(
    (refreshToken) => {
      return dispatch(refreshAccessToken(refreshToken));
    },
    [dispatch],
  );

  const handleClearUser = useCallback(() => {
    dispatch(clearUser());
  }, [dispatch]);

  const handleRedirectToLogin = useCallback(
    (reason) => {
      dispatch(redirectToLogin(reason));
    },
    [dispatch],
  );

  const handleRedirectToApp = useCallback(() => {
    dispatch(redirectToApp());
  }, [dispatch]);

  const handleValidateToken = useCallback(() => {
    return dispatch(validateToken());
  }, [dispatch]);

  const handleSetUserEmail = useCallback(
    (email) => {
      dispatch(setUserEmail(email));
    },
    [dispatch],
  );

  const handleStoreTokens = useCallback(
    (tokens) => {
      dispatch(storeTokens(tokens));
    },
    [dispatch],
  );

  return {
    userEmail: authState.userEmail,
    setUserEmail: handleSetUserEmail,
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
    error: authState.error,
    fetchToken: handleFetchToken,
    refreshAccessToken: handleRefreshAccessToken,
    clearUser: handleClearUser,
    redirectToLogin: handleRedirectToLogin,
    redirectToApp: handleRedirectToApp,
    validateToken: handleValidateToken,
    storeTokens: handleStoreTokens,
  };
}

// Alias for backward compatibility
export const useUser = useAuth;
