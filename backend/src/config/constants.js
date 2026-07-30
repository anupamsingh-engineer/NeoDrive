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
  EMAIL_VERIFICATION: "email_verification",
});

// Subscription plans offered to users. planId must exactly match a Plan already created in
// the Razorpay dashboard (period/interval/amount live there, not here) - adding a tier still
// means creating it in Razorpay first, then adding its id and display metadata below.
export const SUBSCRIPTION_PLANS = Object.freeze([
  Object.freeze({
    planId: "plan_TEPIgVM0I0kq8o",
    name: "2 TB",
    description: "For personal use and small teams",
    amount: 999,
    currency: "INR",
    billingCycle: "Every Month",
    storageQuotaBytes: 2 * 1024 ** 4,
    features: ["2 TB storage", "Unlimited uploads", "Email support"],
    popular: false,
  }),
  Object.freeze({
    planId: "plan_TEPK72pd3uwy74",
    name: "5 TB",
    description: "For growing teams with heavier storage needs",
    amount: 3999,
    currency: "INR",
    billingCycle: "Once in 3 Months",
    storageQuotaBytes: 5 * 1024 ** 4,
    features: ["5 TB storage", "Unlimited uploads", "Priority support"],
    popular: true,
  }),
  Object.freeze({
    planId: "plan_TEPL1YABpKuviH",
    name: "10 TB",
    description: "For power users and large archives",
    amount: 4999,
    currency: "INR",
    billingCycle: "Every Year",
    storageQuotaBytes: 10 * 1024 ** 4,
    features: ["10 TB storage", "Unlimited uploads", "Priority support"],
    popular: false,
  }),
]);

// storageQuotaBytes per Razorpay plan_id, activated via the subscription webhook.
export const PLAN_STORAGE_QUOTA_BYTES = Object.freeze(
  Object.fromEntries(SUBSCRIPTION_PLANS.map((plan) => [plan.planId, plan.storageQuotaBytes]))
);
