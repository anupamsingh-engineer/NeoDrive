import { createAsyncThunk } from "@reduxjs/toolkit";
import { handleLogout, setAuthenticated } from "./authSlice";

// Called once on app mount. httpOnly cookies mean the frontend can't inspect whether a
// session exists — GET /users/me is the only way to find out for sure. baseQuery's reauth
// logic will transparently try /auth/refresh once if the access token has expired.
//
// Skipped entirely if there's no persisted `user` from a previous session: for a genuinely new
// or already-logged-out visitor, GET /users/me would just 401, which would then trigger a
// doomed /auth/refresh attempt too (no refresh cookie either) — two wasted round trips on every
// single anonymous page load. `authTransform` (store/persist/index.js) only ever restores
// `user`, never `isAuthenticated`, specifically so this check is meaningful: a non-null user
// here means "was logged in last time", not "still is" — that's still verified below, over the
// network, same as always. Tradeoff: if persisted state is cleared independently of the actual
// session cookies (e.g. localStorage wiped by hand), this skips the check and shows logged-out
// even though the cookies might still be valid — the user just logs in again in that edge case.
export const bootstrapAuth = createAsyncThunk(
  "auth/bootstrapAuth",
  async (_, { dispatch, getState }) => {
    if (!getState().auth.user) {
      dispatch(handleLogout());
      return;
    }

    const { userApi } = await import("../../api/features/userApi");
    try {
      const user = await dispatch(userApi.endpoints.getCurrentUser.initiate()).unwrap();
      dispatch(setAuthenticated(user?.data));
    } catch {
      dispatch(handleLogout());
    }
  },
);

// Calls the logout API (clears server-side session + blacklists the access token),
// then purges persisted local state regardless of whether the API call succeeded.
export const logoutUser = createAsyncThunk(
  "auth/logoutUser",
  async (_, { dispatch }) => {
    try {
      const { authApi } = await import("../../api/features/authApi");
      await dispatch(authApi.endpoints.logout.initiate()).unwrap();
    } catch {
      // Proceed with local logout even when the API call fails.
    }

    const { persistor } = await import("../../index");
    dispatch(handleLogout());
    await persistor.purge();
  },
);

// Ends every session/device for this user, not just the current one.
export const logoutAllUser = createAsyncThunk(
  "auth/logoutAllUser",
  async (_, { dispatch }) => {
    try {
      const { authApi } = await import("../../api/features/authApi");
      await dispatch(authApi.endpoints.logoutAll.initiate()).unwrap();
    } catch {
      // Proceed with local logout even when the API call fails.
    }

    const { persistor } = await import("../../index");
    dispatch(handleLogout());
    await persistor.purge();
  },
);
