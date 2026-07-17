import { createTransform } from "redux-persist";
import storage from "redux-persist/lib/storage";

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

export const persistConfig = {
  key: "root",
  storage,
  version: 1,
  transforms: [authTransform],
  whitelist: ["auth"],
  blacklist: ["api"],
};
