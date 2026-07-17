export const ROLES = Object.freeze({
  ADMIN: "Admin",
  MANAGER: "Manager",
  USER: "User",
});

export const COOKIE_NAMES = Object.freeze({
  ACCESS_TOKEN: "accessToken",
  REFRESH_TOKEN: "refreshToken",
  CSRF_TOKEN: "csrfToken",
});

export const TOKEN_PURPOSE = Object.freeze({
  PASSWORD_RESET: "password_reset",
  ACCOUNT_UNLOCK: "account_unlock",
});

// storageQuotaBytes per Razorpay plan_id, activated via the subscription webhook.
export const PLAN_STORAGE_QUOTA_BYTES = Object.freeze({
  plan_TEPIgVM0I0kq8o: 2 * 1024 ** 4,
  plan_TEPK72pd3uwy74: 5 * 1024 ** 4,
  plan_TEPL1YABpKuviH: 10 * 1024 ** 4,
});
