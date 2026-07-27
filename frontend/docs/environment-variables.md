# Environment Variables

Source of truth: `.env.example`. Local dev already has a working `.env.local` (gitignored, not
committed) with sensible defaults — copy `.env.example` to start a new one:

```bash
cp .env.example .env.local
```

**All of these are build-time, not runtime.** Vite inlines every `import.meta.env.VITE_*`
reference directly into the built JS at `npm run build` — there is no way to change one after the
image is built without rebuilding. See
[build-and-deploy.md](./build-and-deploy.md#vite_-vars-are-baked-in-not-runtime-configurable).

| Var | Used in | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `configs/EnvironmentConfig.js` → `configs/apiConfig.js` | Backend API origin, with trailing slash (`http://localhost:4000/`) — every RTK Query call is relative to this |
| `VITE_API_ORIGIN` | `index.html`'s CSP `connect-src` | Same host, **without** a trailing path — CSP needs a bare origin, not a URL |
| `VITE_GOOGLE_CLIENT_ID` | `configs/conf.js` → `GoogleSignInButton` | Must match the backend's own `GOOGLE_CLIENT_ID` (see [backend authentication.md](../../backend/docs/authentication.md#post-authgoogle)) — Google's sign-in button doesn't render at all if this is unset |
| `VITE_RAZORPAY_KEY_ID` | *(intended)* `pages/app/subscriptions` | Should select which Razorpay account Checkout opens against — **currently not read**, see the gap below |
| `VITE_SESSION_TIMEOUT` | *(intended)* `configs/apiConfig.js`'s `AUTH_CONFIG.sessionTimeout` | Should configure the idle-logout timer — **currently not read**, see the gap below |
| `VITE_APP_NAME` | `configs/EnvironmentConfig.js` | Currently hardcoded to `"Storage App"` in both the `dev`/`prod` objects regardless of this var — effectively unused too, though lower-stakes than the two above |
| `VITE_APP_VERSION` | — | Not read anywhere in `src/` as of this writing |
| `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST` | `analytics/index.js` | PostHog only initializes (and is only bundled, via dynamic `import()`) if the key is set |
| `VITE_MIXPANEL_TOKEN` | `analytics/index.js` | Same pattern for Mixpanel |
| `VITE_HOTJAR_ID` | `analytics/index.js` | Injects the Hotjar snippet inline if set — no npm package involved |
| `VITE_SOURCEMAP` | `vite.config.js` | `"true"` enables production source maps (bigger build, easier debugging) |

## Vars that look wired but aren't

Two env vars have a complete, correct-looking configuration path — `.env.example` documents them,
they're threaded through as Docker build `ARG`s (`Dockerfile`), `VITE_RAZORPAY_KEY_ID` is even
listed in the CSP — but the one line of application code that should actually read them doesn't:

- **`VITE_RAZORPAY_KEY_ID`**: `pages/app/subscriptions/index.jsx` hardcodes
  `const RAZORPAY_KEY_ID = "rzp_test_TEPFKSsYkRQS2R";` instead of reading
  `import.meta.env.VITE_RAZORPAY_KEY_ID`. Every build currently opens Razorpay Checkout against
  this fixed test key regardless of what's configured. See
  [state-and-api.md](./state-and-api.md#a-real-bug-worth-knowing-about-hardcoded-razorpay-key).
- **`VITE_SESSION_TIMEOUT`**: `configs/apiConfig.js` hardcodes `sessionTimeout: 30` in
  `AUTH_CONFIG` instead of reading the env var. The idle-logout timer
  ([authentication.md](./authentication.md#idle-timeout-useidletimeout)) is always 30 minutes
  regardless of this setting.

If you're changing either behavior, fix the read site (`subscriptions/index.jsx` or
`apiConfig.js`), not just the `.env` value — the env value alone currently does nothing.

## Legacy / effectively-unused config

Two config modules exist from the original scaffold and aren't meaningfully wired into anything
real in this app — mentioned here so you don't go looking for what uses them:

- **`configs/constants.js`**: exports `TOKEN_KEY = "token"` — a `localStorage` key name from the
  old bearer-token auth model. Irrelevant now that auth is cookie-based (see
  [authentication.md](./authentication.md)); nothing reads it.
- **`configs/conf.js`**: alongside the real `googleClientId` (used) and `mixPaneltoken` (unused —
  the analytics module reads `VITE_MIXPANEL_TOKEN` directly instead, not through this file), it
  also defines `facebookAppId`, `ipInfoToken`, `paypalClientId`, and `gaId` — none of which
  correspond to any integration actually present in this app.
