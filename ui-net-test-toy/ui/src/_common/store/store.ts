import { configureStore } from "@reduxjs/toolkit";
import authReducer from "../../auth/store/authSlice";
import bannerReducer from "./slices/bannerSlice";
import searchReducer from "./slices/searchSlice";
import mobileReducer from "./slices/mobileSlice";
import cacheReducer from "./slices/cacheSlice";
import connectionReducer from "./connectionSlice";
import bmpReducer from "./slices/bmpSlice";
import netflowReducer from "./slices/netflowSlice";
import topologyReducer from "./slices/topologySlice";
import labManagerReducer from "./labManagerSlice";
import networkTestingReducer from "./networkTestingSlice";
import topologyManagerReducer from "./topologyManagerSlice";
import flowspecReducer from "./flowspecSlice";
import dockerNetworksReducer from "./slices/dockerNetworksSlice";
import greTunnelsReducer from "./slices/greTunnelsSlice";
import neighborReducer from "./slices/neighborSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    banner: bannerReducer,
    search: searchReducer,
    mobile: mobileReducer,
    cache: cacheReducer,
    connections: connectionReducer,
    bmp: bmpReducer,
    netflow: netflowReducer,
    topology: topologyReducer,
    labManager: labManagerReducer,
    networkTesting: networkTestingReducer,
    topologyManager: topologyManagerReducer,
    flowspec: flowspecReducer,
    dockerNetworks: dockerNetworksReducer,
    greTunnels: greTunnelsReducer,
    neighbors: neighborReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ["persist/PERSIST"],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
