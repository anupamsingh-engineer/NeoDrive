import { createAsyncThunk } from "@reduxjs/toolkit";
import { handleLogout, setAuthenticated } from "./authSlice";

// Called once on app mount. httpOnly cookies mean the frontend can't inspect whether a
// session exists — GET /users/me is the only way to find out. baseQuery's reauth logic
// will transparently try /auth/refresh once if the access token has expired.
export const bootstrapAuth = createAsyncThunk(
  "auth/bootstrapAuth",
  async (_, { dispatch }) => {
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
