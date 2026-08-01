// All paths are relative to the API base URL (e.g. "http://localhost:4000/")
// Pattern: no leading slash so fetchBaseQuery joinUrls works correctly.
// Mirrors backend/docs/frontend-integration-guide.md exactly.

export const API_ROUTES = {
  HEALTH: "healthz",

  AUTH: {
    SEND_OTP: "auth/send-otp",
    VERIFY_OTP: "auth/verify-otp",
    REGISTER: "auth/register",
    LOGIN: "auth/login",
    GOOGLE: "auth/google",
    REFRESH: "auth/refresh",
    LOGOUT: "auth/logout",
    LOGOUT_ALL: "auth/logout-all",
    FORGOT_PASSWORD: "auth/forgot-password",
    RESET_PASSWORD: "auth/reset-password",
  },

  USERS: {
    ME: "users/me",
    LIST: "users",
    LOGOUT_BY_ID: (id) => `users/${id}/logout`,
    DELETE: (id) => `users/${id}`,
  },

  DIRECTORY: {
    // dirId omitted → backend operates on the caller's root directory
    GET: (dirId) => (dirId ? `directory/${dirId}` : "directory"),
    CREATE: (parentDirId) => (parentDirId ? `directory/${parentDirId}` : "directory"),
    RENAME: (dirId) => `directory/${dirId}`,
    DELETE: (dirId) => `directory/${dirId}`,
  },

  FILE: {
    UPLOAD_INITIATE: "file/upload/initiate",
    UPLOAD_COMPLETE: "file/upload/complete",
    GET: (fileId, action) => `file/${fileId}${action ? `?action=${action}` : ""}`,
    RENAME: (fileId) => `file/${fileId}`,
    DELETE: (fileId) => `file/${fileId}`,
  },

  SUBSCRIPTIONS: {
    PLANS: "subscriptions/plans",
    CREATE: "subscriptions",
  },

  SHARE: {
    CREATE: "share",
    LIST: "share",
    REVOKE: (shareId) => `share/${shareId}`,
  },

  // Public, unauthenticated endpoints - no cookies/CSRF required.
  PUBLIC_SHARE: {
    VIEW: (token, dirId) => `s/${token}${dirId ? `?dirId=${dirId}` : ""}`,
    DOWNLOAD: (token, fileId, action) => `s/${token}/file/${fileId}${action ? `?action=${action}` : ""}`,
  },
};
