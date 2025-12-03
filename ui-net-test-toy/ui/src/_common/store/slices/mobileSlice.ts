import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Type definitions
export type Orientation = "landscape" | "portrait";

export interface ScreenDimensions {
  width: number;
  height: number;
}

export interface MobileState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  screenWidth: number;
  screenHeight: number;
  orientation: Orientation;
  fixedWidth: boolean;
  sidebarCollapsed: boolean;
  navigationCollapsed: boolean;
  // Fixed width context compatibility
  forceFixedWidth: boolean;
  fixedWidthValue: number;
  naturalIsMobile: boolean;
}

const initialState: MobileState = {
  isMobile: false,
  isTablet: false,
  isDesktop: true,
  screenWidth: typeof window !== "undefined" ? window.innerWidth : 1920,
  screenHeight: typeof window !== "undefined" ? window.innerHeight : 1080,
  orientation: "landscape",
  fixedWidth: false,
  sidebarCollapsed: false,
  navigationCollapsed: false,
  // Fixed width context compatibility
  forceFixedWidth: false,
  fixedWidthValue: 425,
  naturalIsMobile: false,
};

const mobileSlice = createSlice({
  name: "mobile",
  initialState,
  reducers: {
    setScreenDimensions: (state, action: PayloadAction<ScreenDimensions>) => {
      const { width, height } = action.payload;
      state.screenWidth = width;
      state.screenHeight = height;

      // Update device type based on width
      state.isMobile = width <= 768;
      state.isTablet = width > 768 && width <= 1024;
      state.isDesktop = width > 1024;

      // Update orientation
      state.orientation = width > height ? "landscape" : "portrait";
    },
    setIsMobile: (state, action: PayloadAction<boolean>) => {
      state.isMobile = action.payload;
    },
    setIsTablet: (state, action: PayloadAction<boolean>) => {
      state.isTablet = action.payload;
    },
    setIsDesktop: (state, action: PayloadAction<boolean>) => {
      state.isDesktop = action.payload;
    },
    setOrientation: (state, action: PayloadAction<Orientation>) => {
      state.orientation = action.payload;
    },
    setFixedWidth: (state, action: PayloadAction<boolean>) => {
      state.fixedWidth = action.payload;
    },
    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.sidebarCollapsed = action.payload;
    },
    setNavigationCollapsed: (state, action: PayloadAction<boolean>) => {
      state.navigationCollapsed = action.payload;
    },
    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    toggleNavigation: (state) => {
      state.navigationCollapsed = !state.navigationCollapsed;
    },
    // Fixed width context compatibility
    setForceFixedWidth: (state, action: PayloadAction<boolean>) => {
      state.forceFixedWidth = action.payload;
    },
    setFixedWidthValue: (state, action: PayloadAction<number>) => {
      state.fixedWidthValue = action.payload;
    },
    setNaturalIsMobile: (state, action: PayloadAction<boolean>) => {
      state.naturalIsMobile = action.payload;
    },
  },
});

export const {
  setScreenDimensions,
  setIsMobile,
  setIsTablet,
  setIsDesktop,
  setOrientation,
  setFixedWidth,
  setSidebarCollapsed,
  setNavigationCollapsed,
  toggleSidebar,
  toggleNavigation,
  setForceFixedWidth,
  setFixedWidthValue,
  setNaturalIsMobile,
} = mobileSlice.actions;

export default mobileSlice.reducer;
