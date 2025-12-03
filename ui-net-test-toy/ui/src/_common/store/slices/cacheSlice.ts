import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { cache } from "../../utils/cacheUtils";

export interface CacheState {
  isCachedMode: boolean;
  lastApiSuccess: number | null;
  failedRequests: number;
}

const initialState: CacheState = {
  isCachedMode: false,
  lastApiSuccess: null,
  failedRequests: 0,
};

const cacheSlice = createSlice({
  name: "cache",
  initialState,
  reducers: {
    updateCacheStatus: (state, action: PayloadAction<CacheState>) => {
      state.isCachedMode = action.payload.isCachedMode;
      state.lastApiSuccess = action.payload.lastApiSuccess;
      state.failedRequests = action.payload.failedRequests;
    },
    enterCachedMode: (state) => {
      state.isCachedMode = true;
    },
    exitCachedMode: (state) => {
      state.isCachedMode = false;
      state.failedRequests = 0;
    },
  },
});

export const { updateCacheStatus, enterCachedMode, exitCachedMode } =
  cacheSlice.actions;
export default cacheSlice.reducer;

// Initialize cache status listener
export const initializeCacheListener = (dispatch: any) => {
  // Get initial status
  const initialStatus = cache.getStatus();
  dispatch(updateCacheStatus(initialStatus));

  // Subscribe to changes
  const unsubscribe = cache.onStatusChange((status) => {
    dispatch(updateCacheStatus(status));
  });

  return unsubscribe;
};
