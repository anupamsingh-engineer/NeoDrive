// All event names live here. Components import from this file — no magic strings.
// When GTM team creates a tag, they match against these names exactly.

export const EVENTS = {
  // ── Auth ────────────────────────────────────────────────────────────────
  SIGN_UP: "sign_up",
  LOGIN: "login",
  LOGOUT: "logout",
  PASSWORD_RESET_REQUEST: "password_reset_request",

  // ── Onboarding ──────────────────────────────────────────────────────────
  ONBOARDING_START: "onboarding_start",
  ONBOARDING_STEP_COMPLETE: "onboarding_step_complete", // { step: 1, step_name: "profile" }
  ONBOARDING_COMPLETE: "onboarding_complete",

  // ── Profile ─────────────────────────────────────────────────────────────
  PROFILE_UPDATE: "profile_update",
  PROFILE_PHOTO_UPLOAD: "profile_photo_upload",

  // ── Scholarship ─────────────────────────────────────────────────────────
  SCHOLARSHIP_SEARCH: "scholarship_search",         // { query, filters }
  SCHOLARSHIP_FILTER: "scholarship_filter",         // { filter_type, filter_value }
  SCHOLARSHIP_VIEW: "scholarship_view",             // { scholarship_id, scholarship_name }
  SCHOLARSHIP_APPLY_CLICK: "scholarship_apply_click",
  SCHOLARSHIP_SAVE: "scholarship_save",
  SCHOLARSHIP_UNSAVE: "scholarship_unsave",

  // ── Loan ────────────────────────────────────────────────────────────────
  LOAN_VIEW: "loan_view",                           // { loan_id, lender_name }
  LOAN_APPLY_CLICK: "loan_apply_click",

  // ── CTA ─────────────────────────────────────────────────────────────────
  CTA_CLICK: "cta_click",                           // { cta_name, cta_location }
  BANNER_CLICK: "banner_click",                     // { banner_id }

  // ── Navigation ──────────────────────────────────────────────────────────
  NAV_CLICK: "nav_click",                           // { item }

  // ── Errors ──────────────────────────────────────────────────────────────
  ERROR_BOUNDARY_HIT: "error_boundary_hit",         // { error_message }
};
