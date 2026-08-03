import env from "../config/env.js";
import { COOKIE_NAMES } from "../config/constants.js";

const baseCookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: env.isProduction ? "none" : "lax",
};

export function accessTokenCookieOptions() {
  return { ...baseCookieOptions, maxAge: 15 * 60 * 1000 };
}

export function refreshTokenCookieOptions() {
  return { ...baseCookieOptions, path: "/auth/refresh", maxAge: env.jwt.refreshExpiryMs };
}

export function csrfTokenCookieOptions() {
  return {
    ...baseCookieOptions,
    httpOnly: false,
    maxAge: env.jwt.refreshExpiryMs,
    domain: env.cookieDomain,
  };
}

export function setAuthCookies(res, { accessToken, refreshToken }) {
  res.cookie(COOKIE_NAMES.ACCESS_TOKEN, accessToken, accessTokenCookieOptions());
  res.cookie(COOKIE_NAMES.REFRESH_TOKEN, refreshToken, refreshTokenCookieOptions());
}

export function clearAuthCookies(res) {
  res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, baseCookieOptions);
  res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, { ...baseCookieOptions, path: "/auth/refresh" });
}
