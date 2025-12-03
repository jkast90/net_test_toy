import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Type definitions
export interface Banner {
  id: string;
  message: string;
  type: "info" | "warning" | "error" | "success";
  timestamp: string;
  dismissible?: boolean;
  autoHide?: boolean;
  duration?: number;
}

export interface BannerState {
  banners: Banner[];
  currentBanner: Banner | null;
  showBannerHistory: boolean;
  loading: boolean;
  error: string | null;
}

const initialState: BannerState = {
  banners: [],
  currentBanner: null,
  showBannerHistory: false,
  loading: false,
  error: null,
};

const bannerSlice = createSlice({
  name: "banner",
  initialState,
  reducers: {
    setBanners: (state, action: PayloadAction<Banner[]>) => {
      state.banners = action.payload;
    },
    addBanner: (state, action: PayloadAction<Banner>) => {
      state.banners.push(action.payload);
      // Keep only last 50 messages
      if (state.banners.length > 50) {
        state.banners = state.banners.slice(-50);
      }
    },
    setCurrentBanner: (state, action: PayloadAction<Banner | null>) => {
      state.currentBanner = action.payload;
    },
    dismissBanner: (state, action: PayloadAction<string>) => {
      const bannerId = action.payload;
      state.banners = state.banners.filter((b) => b.id !== bannerId);
      if (state.currentBanner?.id === bannerId) {
        state.currentBanner = null;
      }
    },
    setShowBannerHistory: (state, action: PayloadAction<boolean>) => {
      state.showBannerHistory = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const {
  setBanners,
  addBanner,
  setCurrentBanner,
  dismissBanner,
  setShowBannerHistory,
  setLoading,
  setError,
} = bannerSlice.actions;

export default bannerSlice.reducer;
