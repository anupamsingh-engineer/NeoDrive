import { createSlice } from "@reduxjs/toolkit";
import { authApi } from "../../api/features/authApi";
import { authInitialState } from "./initialState";

const authSlice = createSlice({
  name: "auth",
  initialState: authInitialState,
  reducers: {
    // Set by bootstrapAuth (GET /users/me succeeded) — the only source of truth for
    // isAuthenticated, since httpOnly cookies aren't inspectable client-side.
    setAuthenticated(state, action) {
      state.isAuthenticated = true;
      state.user = action.payload;
      state.isAuthLoading = false;
    },

    handleLogout() {
      return { ...authInitialState, isAuthLoading: false };
    },

    // Merges fresh fields (e.g. from a background session-guard poll) into the current user.
    setUser(state, action) {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
  },
  extraReducers: (builder) => {
    const onAuthenticated = (state, action) => {
      state.isAuthenticated = true;
      state.user = action.payload?.data?.user || null;
      state.loginError = null;
      state.isAuthLoading = false;
    };

    // Login, register (auto-logs-in), and Google sign-in all resolve to the same shape:
    // { data: { user, message, ... } }, and all fully authenticate the session.
    builder.addMatcher(authApi.endpoints.login.matchFulfilled, onAuthenticated);
    builder.addMatcher(authApi.endpoints.register.matchFulfilled, onAuthenticated);
    builder.addMatcher(authApi.endpoints.loginWithGoogle.matchFulfilled, onAuthenticated);

    builder.addMatcher(authApi.endpoints.login.matchPending, (state) => {
      state.loginError = null;
      state.networkError = null;
    });

    builder.addMatcher(authApi.endpoints.login.matchRejected, (state, action) => {
      state.isAuthLoading = false;
      if (action.error?.message === "Failed to fetch") {
        state.networkError = "Network error. Please check your connection.";
      } else {
        state.loginError = action.payload?.data?.message || "Login failed. Please try again.";
      }
    });
  },
});

const { actions: authActions, reducer: authReducer } = authSlice;

export const { setAuthenticated, handleLogout, setUser } = authActions;
export default authReducer;
