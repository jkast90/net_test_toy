import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { getCognitoDomain, getCognitoClientId } from "../../_common/settings";
import { fetchWrapper } from "../../_common/utils/fetchWrapper";

// Type definitions
export interface AuthTokens {
  access_token?: string;
  id_token?: string;
  refresh_token?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

export interface TokenValidationResult {
  username: string;
  accessToken?: string;
  idToken?: string;
  refreshToken?: string;
}

export interface AuthState {
  userEmail: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  idToken?: string | null;
  expiresAt?: number;
}

interface JwtPayload {
  email?: string;
  "cognito:username"?: string;
  sub?: string;
  emailaddress?: string;
  name?: string;
}

const LS_KEYS = {
  accessToken: "auth_access_token",
  idToken: "auth_id_token",
  refreshToken: "auth_refresh_token",
  username: "userEmail",
};

function decodeJwt(token: string): JwtPayload | null {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      console.warn("Invalid JWT format - expected 3 parts, got", parts.length);
      return null;
    }

    const base64Url = parts[1];
    if (!base64Url) {
      console.warn("Missing JWT payload part");
      return null;
    }

    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    return JSON.parse(jsonPayload);
  } catch (err) {
    console.error("JWT decoding error", err);
    return null;
  }
}

// Async thunks
export const fetchToken = createAsyncThunk<
  AuthTokens,
  void,
  { rejectValue: string }
>("auth/fetchToken", async (_, { rejectWithValue }) => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");

  if (!code) {
    return rejectWithValue("Missing code");
  }

  const clientId = getCognitoClientId();
  const cognitoDomain = getCognitoDomain();
  const redirectUri = `${window.location.origin}/auth`;
  const tokenUrl = `${cognitoDomain}/oauth2/token`;

  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      code,
      redirect_uri: redirectUri,
    });

    const tokens = await fetchWrapper<AuthTokens>(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    return tokens;
  } catch (err: any) {
    console.error("Fetch token failed", err);
    return rejectWithValue("Exception during token fetch");
  }
});

export const refreshAccessToken = createAsyncThunk<
  AuthTokens,
  string,
  { rejectValue: string }
>("auth/refreshAccessToken", async (refreshToken, { rejectWithValue }) => {
  const clientId = getCognitoClientId();
  const cognitoDomain = getCognitoDomain();
  const tokenUrl = `${cognitoDomain}/oauth2/token`;

  try {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      refresh_token: refreshToken,
    });

    const tokens = await fetchWrapper<AuthTokens>(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    return {
      access_token: tokens.access_token,
      id_token: tokens.id_token,
      refresh_token: tokens.refresh_token || refreshToken,
    };
  } catch (err: any) {
    console.error("Token refresh failed", err);
    return rejectWithValue("Token refresh failed");
  }
});

export const validateToken = createAsyncThunk<
  TokenValidationResult,
  { silent?: boolean } | void,
  { rejectValue: string }
>("auth/validateToken", async (options, { rejectWithValue }) => {
  const accessToken = localStorage.getItem(LS_KEYS.accessToken);
  const refreshToken = localStorage.getItem(LS_KEYS.refreshToken);
  const idToken = localStorage.getItem(LS_KEYS.idToken);
  const username = localStorage.getItem(LS_KEYS.username);

  if (username && (accessToken || idToken)) {
    return {
      username,
      accessToken: accessToken || undefined,
      idToken: idToken || undefined,
      refreshToken: refreshToken || undefined,
    };
  }

  if (username || accessToken || idToken) {
    return {
      username: username || "",
      accessToken: accessToken || undefined,
      idToken: idToken || undefined,
      refreshToken: refreshToken || undefined,
    };
  }

  return rejectWithValue("No authentication data found");
});

const initialState: AuthState = {
  userEmail: localStorage.getItem(LS_KEYS.username) || "",
  isAuthenticated: (() => {
    const username = localStorage.getItem(LS_KEYS.username);
    const accessToken = localStorage.getItem(LS_KEYS.accessToken);
    const idToken = localStorage.getItem(LS_KEYS.idToken);
    return !!(username && (accessToken || idToken));
  })(),
  isLoading: true,
  error: null,
  accessToken: localStorage.getItem(LS_KEYS.accessToken) || undefined,
  refreshToken: localStorage.getItem(LS_KEYS.refreshToken) || undefined,
  idToken: localStorage.getItem(LS_KEYS.idToken) || undefined,
  expiresAt: undefined,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUserEmail: (state, action: PayloadAction<string>) => {
      state.userEmail = action.payload;
      localStorage.setItem(LS_KEYS.username, action.payload);
    },
    storeTokens: (state, action: PayloadAction<AuthTokens>) => {
      const tokens = action.payload;

      // Handle both token formats (camelCase and snake_case)
      const accessToken = tokens.accessToken || tokens.access_token;
      const refreshToken = tokens.refreshToken || tokens.refresh_token;
      const idToken = tokens.id_token;

      if (accessToken) {
        localStorage.setItem(LS_KEYS.accessToken, accessToken);
        state.accessToken = accessToken;
      }
      if (refreshToken) {
        localStorage.setItem(LS_KEYS.refreshToken, refreshToken);
        state.refreshToken = refreshToken;
      }
      if (idToken) {
        localStorage.setItem(LS_KEYS.idToken, idToken);
        state.idToken = idToken;
      }
      if (tokens.expiresAt) {
        state.expiresAt = tokens.expiresAt;
      }

      // Decode user info from id_token if available
      if (idToken) {
        const decoded = decodeJwt(idToken);
        let user =
          decoded?.email ||
          decoded?.["cognito:username"] ||
          decoded?.sub ||
          decoded?.emailaddress ||
          decoded?.name ||
          "";

        if (user.includes("_") && user.split("_").length === 2) {
          user = user.split("_")[1];
        }

        state.userEmail = user;
        localStorage.setItem(LS_KEYS.username, user);
      }

      state.isAuthenticated = true;
    },
    clearUser: (state) => {
      Object.values(LS_KEYS).forEach((key) => {
        localStorage.removeItem(key);
      });
      localStorage.removeItem("lastVisitedRoute");
      // Note: selectedWorkspace is intentionally NOT cleared here
      // so it persists across logout/login and page reloads

      state.userEmail = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      state.accessToken = null;
      state.refreshToken = null;
      state.idToken = null;
      state.expiresAt = undefined;
    },
    redirectToLogin: (_state, action: PayloadAction<string | undefined>) => {
      const reason = action.payload;
      console.warn("Redirecting to login:", reason);
      Object.values(LS_KEYS).forEach((key) => localStorage.removeItem(key));

      const cognitoDomain = getCognitoDomain();
      const clientId = getCognitoClientId();
      const redirectUri = `${window.location.origin}/auth`;
      const loginUri = `${cognitoDomain}/oauth2/authorize?client_id=${clientId}&response_type=code&scope=openid+email&redirect_uri=${encodeURIComponent(
        redirectUri,
      )}`;

      window.location.replace(loginUri);
    },
    redirectToApp: (_state) => {
      window.location.href = window.location.origin;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchToken.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchToken.fulfilled, (state, action) => {
        state.isLoading = false;
        authSlice.caseReducers.storeTokens(state, action);
      })
      .addCase(fetchToken.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload ?? null;
      })
      .addCase(refreshAccessToken.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(refreshAccessToken.fulfilled, (state, action) => {
        state.isLoading = false;
        authSlice.caseReducers.storeTokens(state, action);
      })
      .addCase(refreshAccessToken.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload ?? null;
      })
      .addCase(validateToken.pending, (state, action) => {
        // Only set isLoading for non-silent validations (initial load)
        const silent = action.meta.arg?.silent;
        if (!silent) {
          state.isLoading = true;
        }
      })
      .addCase(validateToken.fulfilled, (state, action) => {
        const { username } = action.payload;
        if (username) state.userEmail = username;
        state.isAuthenticated = true;
        // Only clear isLoading for non-silent validations
        const silent = action.meta.arg?.silent;
        if (!silent) {
          state.isLoading = false;
        }
      })
      .addCase(validateToken.rejected, (state, action) => {
        state.isAuthenticated = false;
        // Only clear isLoading for non-silent validations
        const silent = action.meta.arg?.silent;
        if (!silent) {
          state.isLoading = false;
        }
      });
  },
});

export const {
  setUserEmail,
  storeTokens,
  clearUser,
  redirectToLogin,
  redirectToApp,
} = authSlice.actions;

// Selector
export const selectAuth = (state: { auth: AuthState }) => ({
  isAuthenticated: state.auth.isAuthenticated,
  token: state.auth.accessToken,
  user: state.auth.userEmail ? { id: state.auth.userEmail, email: state.auth.userEmail } : null,
});

export default authSlice.reducer;
