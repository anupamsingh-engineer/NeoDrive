import { asyncHandler } from "../errors/asyncHandler.js";
import * as authService from "../services/auth.service.js";
import * as otpService from "../services/otp.service.js";
import { setAuthCookies, clearAuthCookies } from "../utils/cookies.js";
import { setCsrfCookie } from "../middlewares/csrf.middleware.js";
import { COOKIE_NAMES } from "../config/constants.js";

function requestMeta(req) {
  return { userAgent: req.headers["user-agent"], ip: req.ip };
}

function respondWithSession(res, { user, accessToken, refreshToken }, statusCode, extra = {}) {
  setAuthCookies(res, { accessToken, refreshToken });
  setCsrfCookie(res);
  res.status(statusCode).json({ success: true, data: { user, ...extra } });
}

export const sendOtp = asyncHandler(async (req, res) => {
  const data = await otpService.requestOtp(req.body.email);
  res.status(201).json({ success: true, data });
});

export const verifyOtp = asyncHandler(async (req, res) => {
  const data = await authService.verifyEmailOtp(req.body.email, req.body.otp);
  res.json({ success: true, data });
});

export const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body, requestMeta(req));
  respondWithSession(res, result, 201, { message: "Registered and logged in" });
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body, requestMeta(req));
  respondWithSession(res, result, 200, { message: "Logged in" });
});

export const loginWithGoogle = asyncHandler(async (req, res) => {
  const result = await authService.loginWithGoogle(req.body.idToken, requestMeta(req));
  respondWithSession(res, result, result.isNewUser ? 201 : 200, {
    isNewUser: result.isNewUser,
    message: result.isNewUser ? "Account created and logged in" : "Logged in",
  });
});

export const refresh = asyncHandler(async (req, res) => {
  const refreshTokenRaw = req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN];
  const { accessToken, refreshToken } = await authService.refresh(refreshTokenRaw, requestMeta(req));
  setAuthCookies(res, { accessToken, refreshToken });
  setCsrfCookie(res);
  res.json({ success: true, message: "Token refreshed" });
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout({
    accessToken: req.authToken,
    refreshTokenRaw: req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN],
  });
  clearAuthCookies(res);
  res.status(204).end();
});

export const logoutAll = asyncHandler(async (req, res) => {
  await authService.logoutAll(req.user._id);
  clearAuthCookies(res);
  res.status(204).end();
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const data = await authService.forgotPassword(req.body.email);
  res.json({ success: true, data });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const data = await authService.resetPassword(req.body.token, req.body.password);
  res.json({ success: true, data });
});
