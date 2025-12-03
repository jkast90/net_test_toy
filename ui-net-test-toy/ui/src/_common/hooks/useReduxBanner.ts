// src/hooks/useReduxBanner.ts
// Redux-based banner hook to replace BannerContext

import { useCallback, useRef, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  addBanner,
  setCurrentBanner,
  setShowBannerHistory,
  setBanners,
  Banner,
} from "@common/store/slices/bannerSlice";

// Type definitions
export type BannerType = "info" | "success" | "error" | "warning";

export interface BannerHookReturn {
  banner: Banner | null;
  bannerHistory: Banner[];
  showBanner: (msg: string, type?: BannerType, duration?: number) => void;
  showRequest: (msg: string, duration?: number) => void;
  showSuccess: (msg: string, duration?: number) => void;
  showError: (msg: string, duration?: number) => void;
  closeBanner: () => void;
  clearHistory: () => void;
  showBannerHistory: boolean;
  setShowBannerHistory: (show: boolean) => void;
}

export function useReduxBanner(): BannerHookReturn {
  const dispatch = useAppDispatch();
  const { banners, currentBanner, showBannerHistory } = useAppSelector(
    (state) => state.banner,
  );
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const closeBanner = useCallback(() => {
    dispatch(setCurrentBanner(null));
    // Clear any pending timeout when manually closing
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [dispatch]);

  const showBanner = useCallback(
    (msg: string, type: BannerType = "info", duration = 5000) => {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`[${timestamp}] [ReduxBanner] ${type.toUpperCase()}: ${msg}`);

      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      const banner: Banner = {
        id: `${Date.now()}-${Math.random()}`, // Simple unique ID as string
        timestamp,
        message: msg,
        type,
      };

      // Add to history
      dispatch(addBanner(banner));

      // Set as current banner
      dispatch(setCurrentBanner(banner));

      // Check if auto-dismiss is enabled
      const autoDismiss =
        localStorage.getItem("autoDismissBanners") !== "false";
      if (autoDismiss) {
        timeoutRef.current = setTimeout(() => {
          dispatch(setCurrentBanner(null));
          timeoutRef.current = null;
        }, duration);
      }
    },
    [dispatch],
  );

  const showRequest = useCallback(
    (msg: string, duration = 5000) => {
      showBanner(msg, "info", duration);
    },
    [showBanner],
  );

  const showSuccess = useCallback(
    (msg: string, duration = 3000) => {
      showBanner(msg, "success", duration);
    },
    [showBanner],
  );

  const showError = useCallback(
    (msg: string, duration = 7000) => {
      showBanner(msg, "error", duration);
    },
    [showBanner],
  );

  const clearHistory = useCallback(() => {
    dispatch(setBanners([]));
    console.log("[ReduxBanner] History cleared");
  }, [dispatch]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    banner: currentBanner,
    bannerHistory: banners,
    showBanner,
    showRequest,
    showSuccess,
    showError,
    closeBanner,
    clearHistory,
    showBannerHistory,
    setShowBannerHistory: (show: boolean) =>
      dispatch(setShowBannerHistory(show)),
  };
}

// Convenience hook with same API as context
export const useBanner = useReduxBanner;
