// src/hooks/useReduxMobile.ts
// Redux-based mobile/responsive hook to replace MobileContext

import { useCallback, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  setScreenDimensions,
  setForceFixedWidth,
  setFixedWidthValue,
  setNaturalIsMobile,
} from "@common/store/slices/mobileSlice";

// Type definitions
export interface ScreenDimensions {
  width: number;
  height: number;
}

export interface MobileHookReturn {
  // Current state
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  screenWidth: number;
  screenHeight: number;
  orientation: "portrait" | "landscape";

  // Fixed width specific
  forceFixedWidth: boolean;
  fixedWidthValue: number;
  naturalIsMobile: boolean;

  // Legacy compatibility
  forceMobileView: boolean;

  // Actions
  setForceFixedWidth: (force: boolean) => void;
  setFixedWidthValue: (width: number) => void;
  setForceMobileView: (force: boolean) => void; // Legacy compatibility
}

export function useReduxMobile(): MobileHookReturn {
  const dispatch = useAppDispatch();
  const mobileState = useAppSelector((state) => state.mobile);

  // Load settings from localStorage and listen for updates
  useEffect(() => {
    const storedForce = localStorage.getItem("forceFixedWidth");
    const storedWidth = localStorage.getItem("fixedWidthValue");

    dispatch(setForceFixedWidth(storedForce === "true"));
    dispatch(setFixedWidthValue(storedWidth ? parseInt(storedWidth, 10) : 425));

    // Listen for settings updates
    const handleSettingsUpdate = () => {
      const updatedForce = localStorage.getItem("forceFixedWidth");
      const updatedWidth = localStorage.getItem("fixedWidthValue");

      dispatch(setForceFixedWidth(updatedForce === "true"));
      dispatch(
        setFixedWidthValue(updatedWidth ? parseInt(updatedWidth, 10) : 425),
      );
    };

    window.addEventListener("settingsUpdated", handleSettingsUpdate);
    return () =>
      window.removeEventListener("settingsUpdated", handleSettingsUpdate);
  }, [dispatch]);

  // Detect screen dimensions and natural mobile state
  useEffect(() => {
    const checkScreen = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      dispatch(setScreenDimensions({ width, height }));

      // Detect natural mobile device
      const mobileByWidth = width <= 768;
      const mobileByTouch =
        "ontouchstart" in window || navigator.maxTouchPoints > 0;
      const mobileByUserAgent =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent,
        );

      // Consider it mobile if screen is small OR it's a touch device with mobile user agent
      dispatch(
        setNaturalIsMobile(
          mobileByWidth || (mobileByTouch && mobileByUserAgent),
        ),
      );
    };

    checkScreen();
    window.addEventListener("resize", checkScreen);
    return () => window.removeEventListener("resize", checkScreen);
  }, [dispatch]);

  // Apply fixed width styles to body
  useEffect(() => {
    const { forceFixedWidth, fixedWidthValue, naturalIsMobile } = mobileState;
    const shouldUseMobile = forceFixedWidth || naturalIsMobile;

    if (forceFixedWidth) {
      // Add class and apply fixed width
      document.body.classList.add("force-fixed-width");
      document.body.style.maxWidth = `${fixedWidthValue}px`;
      document.body.style.margin = "0 auto";
      document.body.style.boxSizing = "border-box";
      // Set CSS variable for use in component stylesheets
      document.documentElement.style.setProperty(
        "--fixed-width",
        `${fixedWidthValue}px`,
      );
    } else {
      document.body.classList.remove("force-fixed-width");
      document.body.style.maxWidth = "";
      document.body.style.margin = "";
      // Remove CSS variable
      document.documentElement.style.removeProperty("--fixed-width");
    }

    // Add generic mobile class for components that need mobile behavior
    if (shouldUseMobile) {
      document.body.classList.add("mobile-view");
    } else {
      document.body.classList.remove("mobile-view");
    }
  }, [
    mobileState.forceFixedWidth,
    mobileState.fixedWidthValue,
    mobileState.naturalIsMobile,
  ]);

  const updateForceFixedWidth = useCallback(
    (force: boolean) => {
      dispatch(setForceFixedWidth(force));
      localStorage.setItem("forceFixedWidth", force.toString());
    },
    [dispatch],
  );

  const updateFixedWidthValue = useCallback(
    (width: number) => {
      dispatch(setFixedWidthValue(width));
      localStorage.setItem("fixedWidthValue", width.toString());
    },
    [dispatch],
  );

  return {
    // Current state
    isMobile: mobileState.forceFixedWidth || mobileState.naturalIsMobile,
    isTablet: mobileState.isTablet,
    isDesktop: mobileState.isDesktop,
    screenWidth: mobileState.screenWidth,
    screenHeight: mobileState.screenHeight,
    orientation: mobileState.orientation,

    // Fixed width specific
    forceFixedWidth: mobileState.forceFixedWidth,
    fixedWidthValue: mobileState.fixedWidthValue,
    naturalIsMobile: mobileState.naturalIsMobile,

    // Legacy compatibility
    forceMobileView: mobileState.forceFixedWidth,

    // Actions
    setForceFixedWidth: updateForceFixedWidth,
    setFixedWidthValue: updateFixedWidthValue,
    setForceMobileView: updateForceFixedWidth, // Legacy compatibility
  };
}

// Convenience hooks with same API as context
export const useMobile = useReduxMobile;
export const useFixedWidth = useReduxMobile;
