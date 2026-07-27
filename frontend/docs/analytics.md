# Analytics

Code: `src/analytics/index.js`, `src/analytics/events.js`, `src/analytics/PageViewTracker.jsx`,
`src/hooks/useAnalytics.js`.

## The module (`analytics/index.js`)

A single provider-agnostic facade — `initAnalytics()`, `track()`, `trackPageView()`,
`identify()`, `resetIdentity()` — so call sites never import a specific vendor SDK directly.
Adding/removing/reconfiguring a provider only ever touches this one file.

```js
import { useAnalytics } from "../hooks/useAnalytics";
import { EVENTS } from "../analytics/events";

const { track, identify, resetIdentity } = useAnalytics();
track(EVENTS.SIGN_UP, { plan: "free" });
identify(user.id, { email: user.email });
resetIdentity();
```

**In dev, `initAnalytics()` does nothing but log** (`console.debug("[Analytics] Dev mode —
providers skipped...")`) — no provider is initialized, no network calls happen. `track()`/
`trackPageView()`/`identify()` still run their logic in dev, but every provider call is a no-op
since `_posthog`/`_mixpanel` are never set and `window.gtag`/`window.fbq`/`window.dataLayer` don't
exist — each call is wrapped in `safe()` (try/catch, silent) specifically so a missing provider
never throws.

### Providers, and what actually loads them

| Provider | Loads when | How |
|---|---|---|
| GA4 (`gtag`) | Always attempted; no-ops if `window.gtag` was never injected | Expected to be loaded via a `<script>` in `index.html` — not currently present, see the gap below |
| GTM `dataLayer` | Same as above | `window.dataLayer.push(...)` |
| Facebook Pixel | Same as above | `window.fbq(...)`, typically loaded via GTM |
| PostHog | `VITE_POSTHOG_KEY` is set | Dynamically `import("posthog-js")` — not in the initial bundle unless the key is present |
| Mixpanel | `VITE_MIXPANEL_TOKEN` is set | Dynamically `import("mixpanel-browser")` |
| Hotjar | `VITE_HOTJAR_ID` is set | Inline snippet injected directly, no npm package |

Both `posthog-js` and `mixpanel-browser` are real `package.json` dependencies (not just
documented as an option) — see [environment-variables.md](./environment-variables.md).

### Page views

`PageViewTracker` (mounted once in `App.jsx`, inside `<BrowserRouter>`) calls `trackPageView(pathname)`
on every route change via a `useLocation()` + `useEffect`. This is fully wired and automatic —
unlike the custom event catalog below, you don't need to do anything to get page-view tracking.

## The event catalog (`analytics/events.js`) — a real gap

`EVENTS` is a flat object of name constants, intended so "no magic strings" and so a GTM/analytics
team can match tag triggers against known names. **As shipped, it's inherited from a different
app's template** — the events are `SCHOLARSHIP_SEARCH`, `SCHOLARSHIP_VIEW`, `LOAN_VIEW`,
`ONBOARDING_STEP_COMPLETE`, etc., none of which apply to a file storage app. There is currently
**no `FILE_UPLOAD`, `FOLDER_CREATE`, `FILE_DOWNLOAD`, `SUBSCRIPTION_UPGRADE`**, or any other
storage-app-specific event defined.

More importantly: **`useAnalytics()`/`track()`/`identify()`/`resetIdentity()` have no call sites
anywhere in the app today** outside their own definitions — not on login, not on logout, not on
file upload, not on folder create. The only analytics signal actually flowing right now is the
automatic page-view tracking above. If you're picking this up: the plumbing (module, hook,
provider wiring, dev-mode safety) is all there and correct — what's missing is (1) a
storage-app-specific `EVENTS` catalog and (2) actually calling `track()`/`identify()`/
`resetIdentity()` from the auth flow ([authentication.md](./authentication.md)) and the Drive page
([file-management.md](./file-management.md)).

## GA4/GTM script loading — also not wired yet

`track()`/`trackPageView()` call `window.gtag?.(...)` and `window.dataLayer?.push(...)`
optimistically, but **no `<script>` tag loads GA4, GTM, or the Facebook Pixel SDK anywhere in
`index.html` or `initAnalytics()`** — only PostHog, Mixpanel, and Hotjar have actual loading code.
In the current app, `window.gtag`/`window.dataLayer`/`window.fbq` are always `undefined`, so those
particular calls are permanently silent no-ops until that loading script is added (typically a
GTM container snippet in `index.html`, which is also where the CSP's `script-src`/`connect-src`
would need a corresponding entry — see [build-and-deploy.md](./build-and-deploy.md#content-security-policy)).
