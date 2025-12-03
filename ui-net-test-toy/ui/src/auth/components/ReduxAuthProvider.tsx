import { useEffect, ReactNode } from "react";
import { useAppDispatch, useAppSelector } from "../../_common/store/hooks";
import { validateToken } from "../store/authSlice";

interface ReduxAuthProviderProps {
  children: ReactNode;
}

export function ReduxAuthProvider({ children }: ReduxAuthProviderProps) {
  const dispatch = useAppDispatch();
  const { isAuthenticated } = useAppSelector((state) => state.auth);

  useEffect(() => {
    const initializeAuth = async () => {
      // Initial validation - not silent, will show loading state
      await dispatch(validateToken());
    };
    initializeAuth();

    // Set up periodic token validation (every 5 minutes)
    const interval = setInterval(
      async () => {
        if (isAuthenticated) {
          console.log("[ReduxAuthProvider] Periodic token validation");
          // Silent validation - won't trigger loading state or re-renders
          await dispatch(validateToken({ silent: true }));
        }
      },
      5 * 60 * 1000,
    ); // 5 minutes

    return () => clearInterval(interval);
  }, [dispatch, isAuthenticated]);

  return children;
}
