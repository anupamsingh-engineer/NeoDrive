import { createTransform } from "redux-persist";
import storage from "redux-persist/lib/storage";
import { registrationInitialState } from "../slices/registrationSlice";

// Only `user` (name/email/picture/role/maxStorageInBytes — nothing secret) is persisted, for
// instant paint on reload. Both tokens live in httpOnly cookies the frontend never sees, so
// there's nothing sensitive left in this slice to encrypt (unlike the old token-in-Redux setup).
// `isAuthenticated` is deliberately never trusted from persisted state — it's re-derived every
// load via bootstrapAuth() (GET /users/me), since a cookie may have expired or been revoked
// while the tab was closed.
const authTransform = createTransform(
  (state) => ({ user: state.user }),
  (persisted) => ({
    user: persisted?.user ?? null,
    isAuthenticated: false,
    isAuthLoading: true,
    error: null,
    loginError: null,
    networkError: null,
  }),
  { whitelist: ["auth"] },
);

// Lets the registration wizard (email -> otp -> details, see pages/public/Register and
// registrationSlice.js) survive a page reload without forcing the user back through email entry
// and a brand new OTP email. On rehydrate, if the persisted verificationToken has already
// expired, falls back to the otp step (email is still known) instead of resurrecting a
// "details" form that's guaranteed to fail on submit. The token itself is a short-lived,
// single-purpose JWT (can only ever be used to finish registering this one email) - low enough
// stakes to sit in plain localStorage the same way the `user` mirror above does; the password
// typed into the details step is never part of this slice, so it's never persisted regardless.
const registrationTransform = createTransform(
  (state) => state,
  (persisted) => {
    if (!persisted) return registrationInitialState;
    const expired =
      persisted.verificationTokenExpiresAt && Date.now() >= persisted.verificationTokenExpiresAt;
    if (!expired) return persisted;
    return {
      ...registrationInitialState,
      step: persisted.email ? "otp" : "email",
      email: persisted.email || "",
    };
  },
  { whitelist: ["registration"] },
);

export const persistConfig = {
  key: "root",
  storage,
  version: 1,
  transforms: [authTransform, registrationTransform],
  whitelist: ["auth", "registration"],
  blacklist: ["api"],
};
