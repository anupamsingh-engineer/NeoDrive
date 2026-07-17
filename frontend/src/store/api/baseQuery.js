import { fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { Mutex } from "async-mutex";
import logger from "../../utils/logger";
import { getCsrfTokenFromCookie } from "../../utils/csrf";
import { handleLogout } from "../slices/auth-slice";
import { API_CONFIG } from "../../configs/apiConfig";
import { API_ROUTES } from "../../configs/apiRoutes";
import { toast } from "../../components/ui/Toast";

export const CSRF_HEADER = "x-csrf-token";

const MUTEX_TIMEOUT_MS = 10_000;
const mutex = new Mutex();

const acquireMutex = () =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Token refresh mutex timed out")),
      MUTEX_TIMEOUT_MS,
    );
    mutex.acquire().then((release) => {
      clearTimeout(timer);
      resolve(release);
    }, reject);
  });

// Both access and refresh tokens live in httpOnly cookies the browser sends automatically
// (credentials:"include") — there is no token for the frontend to read or attach as a header.
// Only the CSRF token is JS-visible, and only mutating requests need it.
const baseQuery = fetchBaseQuery({
  baseUrl: API_CONFIG.baseUrl,
  timeout: API_CONFIG.timeout,
  credentials: "include",
  prepareHeaders: (headers, { type }) => {
    if (type === "mutation") {
      const csrfToken = getCsrfTokenFromCookie();
      if (csrfToken) headers.set(CSRF_HEADER, csrfToken);
    }
    return headers;
  },
});

// Deliberately just clears Redux state — no hard `window.location.href` redirect. AuthGuard
// already reacts to isAuthenticated flipping false and navigates client-side via React Router.
// A hard reload here would re-mount App.jsx, which re-fires bootstrapAuth's GET /users/me,
// which 401s again for a still-anonymous visitor, which calls this again — an infinite
// reload loop for every unauthenticated visit, not just genuine mid-session expiry.
const forceLogout = (api) => {
  api.dispatch(handleLogout());
};

export const baseQueryWithReauth = async (args, api, extraOptions) => {
  await mutex.waitForUnlock().catch(() => {});

  let result = await baseQuery(args, api, extraOptions);

  // 401 on the refresh endpoint itself means the session is fully expired — force logout.
  if (result.error?.status === 401 && api.endpoint !== "refresh") {
    if (!mutex.isLocked()) {
      let release;
      try {
        release = await acquireMutex();
      } catch {
        await mutex.waitForUnlock().catch(() => {});
        return baseQuery(args, api, extraOptions);
      }

      try {
        // Refresh token is in an httpOnly cookie scoped to this path — no body needed,
        // credentials:"include" sends it, and the response rotates all three cookies.
        const refreshResult = await baseQuery(
          { url: API_ROUTES.AUTH.REFRESH, method: "POST" },
          api,
          extraOptions,
        );

        if (refreshResult.data) {
          logger.debug("Token refreshed successfully");
          result = await baseQuery(args, api, extraOptions);
        } else {
          logger.warn("Token refresh failed — logging out");
          forceLogout(api);
        }
      } catch (error) {
        logger.error("Error during token refresh", error);
        forceLogout(api);
      } finally {
        release?.();
      }
    } else {
      await mutex.waitForUnlock().catch(() => {});
      result = await baseQuery(args, api, extraOptions);
    }
  } else if (result?.error?.status === 409) {
    // Benign refresh race (two near-simultaneous refresh calls) — retry once, silently.
    // Re-run through this same function so the retry's own result is fully re-evaluated
    // (including a second 401/409 if that happens) rather than relabeling it with the
    // original 409's status/message.
    return baseQueryWithReauth(args, api, extraOptions);
  } else if (result?.error) {
    const { status } = result.error;
    const msg =
      result.error?.data?.message ||
      result.error?.message ||
      "An error occurred while processing your request.";

    logger.error("API Error", {
      status,
      endpoint: typeof args === "string" ? args : args?.url,
    });

    if (status === 429) {
      toast.warning("Too many requests. Please slow down.");
    } else if (status === 500) {
      toast.error("Server error. Please try again later.");
    } else if (status !== 401 && status !== 403 && status !== 404 && status !== 507) {
      // 401 → handled above (reauth). 403/404/507 → handled inline by the component.
      toast.error(msg);
    }

    result = {
      error: {
        status,
        data: { message: msg },
      },
    };
  }

  return result;
};
