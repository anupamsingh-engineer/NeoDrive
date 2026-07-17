## Changes Made

### Tier 1 — Critical

**1. Encrypted localStorage** ([store/persist/index.js](vscode-webview://1rn3fomim12iq5143fo1nnb2cu83qkut29u9m0t1ibnp7812ap79/src/store/persist/index.js))

- Installed `crypto-js`, wrote a single `authTransform` that AES-encrypts the auth slice before saving and decrypts on restore
- If decryption fails (old plain-text data, key rotation) → state resets to logged-out instead of crashing
- Key comes from `VITE_PERSIST_ENCRYPT_KEY` env var — set this to a strong random string in production

**2. JWT expiration check** ([utils/jwtUtils.js](vscode-webview://1rn3fomim12iq5143fo1nnb2cu83qkut29u9m0t1ibnp7812ap79/src/utils/jwtUtils.js) + [store/slices/authSlice.js](vscode-webview://1rn3fomim12iq5143fo1nnb2cu83qkut29u9m0t1ibnp7812ap79/src/store/slices/authSlice.js))

- New `isTokenExpired()` decodes the JWT `exp` claim client-side (10s clock-skew buffer)
- `checkAuthState()` now validates the rehydrated token — expired tokens are cleared immediately on app load

**3. No flash of authenticated content** ([store/persist/index.js](vscode-webview://1rn3fomim12iq5143fo1nnb2cu83qkut29u9m0t1ibnp7812ap79/src/store/persist/index.js))

- The transform forces `isAuthLoading: true` on every rehydration, so the Guard always shows a spinner until `checkAuthState()` completes

**4. Production console suppressed** ([utils/logger.js](vscode-webview://1rn3fomim12iq5143fo1nnb2cu83qkut29u9m0t1ibnp7812ap79/src/utils/logger.js) + [configs/EnvironmentConfig.js](vscode-webview://1rn3fomim12iq5143fo1nnb2cu83qkut29u9m0t1ibnp7812ap79/src/configs/EnvironmentConfig.js))

- All logger methods (`log`, `info`, `warn`, `debug`) are no-ops in production
- `EnvironmentConfig` now silences `console.log/info/warn/debug` globally — catches third-party scripts too

**5. Session idle timeout** ([hooks/useIdleTimeout.js](vscode-webview://1rn3fomim12iq5143fo1nnb2cu83qkut29u9m0t1ibnp7812ap79/src/hooks/useIdleTimeout.js) + [App.jsx](vscode-webview://1rn3fomim12iq5143fo1nnb2cu83qkut29u9m0t1ibnp7812ap79/src/App.jsx))

- New hook watches `mousemove/keydown/mousedown/touchstart/scroll` and calls `logoutUser()` after 30 min idle
- Timer is cleared when the user is not authenticated

**6. Content Security Policy** ([index.html](vscode-webview://1rn3fomim12iq5143fo1nnb2cu83qkut29u9m0t1ibnp7812ap79/index.html))

- Added `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options` meta tags
- Restricts script execution to known origins — limits what third-party scripts can do to localStorage

---

### Tier 2 — High

**7. Token from Redux state in every request** ([store/api/baseQuery.js](vscode-webview://1rn3fomim12iq5143fo1nnb2cu83qkut29u9m0t1ibnp7812ap79/src/store/api/baseQuery.js))

- `prepareHeaders` reads `getState().auth.token` — never localStorage — so the freshest post-refresh token is always used

**8. Mutex timeout** ([store/api/baseQuery.js](vscode-webview://1rn3fomim12iq5143fo1nnb2cu83qkut29u9m0t1ibnp7812ap79/src/store/api/baseQuery.js))

- `acquireMutex()` rejects after 10s instead of blocking forever; stuck refresh no longer deadlocks all API calls

**9. Refresh token rotation** ([store/api/baseQuery.js](vscode-webview://1rn3fomim12iq5143fo1nnb2cu83qkut29u9m0t1ibnp7812ap79/src/store/api/baseQuery.js) + [store/slices/authSlice.js](vscode-webview://1rn3fomim12iq5143fo1nnb2cu83qkut29u9m0t1ibnp7812ap79/src/store/slices/authSlice.js))

- `updateToken` now accepts and stores `newRefreshToken` from the refresh response — rotated tokens are tracked

**10. Auth redirect preserves destination** ([components/common/Guard/index.jsx](vscode-webview://1rn3fomim12iq5143fo1nnb2cu83qkut29u9m0t1ibnp7812ap79/src/components/common/Guard/index.jsx) + [pages/public/Login/index.jsx](vscode-webview://1rn3fomim12iq5143fo1nnb2cu83qkut29u9m0t1ibnp7812ap79/src/pages/public/Login/index.jsx))

- Guard passes `state={{ from: location }}` to `/auth/login`; Login reads `location.state.from` and redirects there after success

**11. Login hardening** ([pages/public/Login/index.jsx](vscode-webview://1rn3fomim12iq5143fo1nnb2cu83qkut29u9m0t1ibnp7812ap79/src/pages/public/Login/index.jsx))

- Password min-length (8 chars) validated before submission
- 5-attempt lockout with live 30s countdown timer
- Sensitive data stripped from logs; demo credentials hint removed
- `autoComplete` attributes set correctly; `aria-busy` on submit button

**12. Accessible loading states** ([components/common/Guard/index.jsx](vscode-webview://1rn3fomim12iq5143fo1nnb2cu83qkut29u9m0t1ibnp7812ap79/src/components/common/Guard/index.jsx) + [main.jsx](vscode-webview://1rn3fomim12iq5143fo1nnb2cu83qkut29u9m0t1ibnp7812ap79/src/main.jsx))

- All `<div>Loading...</div>` replaced with `role="status" aria-live="polite"` containers with visually-hidden text

**13. apiConfig cleanup** ([configs/apiConfig.js](vscode-webview://1rn3fomim12iq5143fo1nnb2cu83qkut29u9m0t1ibnp7812ap79/src/configs/apiConfig.js))

- Removed duplicate/inconsistent `tokenKey: 'app_token'` (was dead code, real key was in `constants.js`)

**14. Build fixed** ([vite.config.js](vscode-webview://1rn3fomim12iq5143fo1nnb2cu83qkut29u9m0t1ibnp7812ap79/vite.config.js))

- Changed `minify: 'terser'` → `minify: 'esbuild'`; terser was never installed so the production build was always broken

---

**One remaining action needed:** Set `VITE_PERSIST_ENCRYPT_KEY` to a strong random secret (`openssl rand -base64 32`) in your production
