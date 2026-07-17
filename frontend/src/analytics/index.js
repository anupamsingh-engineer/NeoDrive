// Central analytics module — add/remove/configure providers only here.
// Components call track(), identify(), reset() and never reference SDKs directly.

const isDev = import.meta.env.DEV;

const safe = (fn) => {
  try {
    fn();
  } catch {
    // silent — one broken provider never kills tracking
  }
};

let _posthog = null;
let _mixpanel = null;

// ─── Init (call once at app startup) ────────────────────────────────────────

export async function initAnalytics() {
  if (isDev) {
    console.debug("[Analytics] Dev mode — providers skipped, events will be logged.");
    return;
  }

  // PostHog
  const phKey = import.meta.env.VITE_POSTHOG_KEY;
  if (phKey) {
    const { default: posthog } = await import("posthog-js");
    posthog.init(phKey, {
      api_host: import.meta.env.VITE_POSTHOG_HOST || "https://app.posthog.com",
      capture_pageview: false,   // we track manually via PageViewTracker
      persistence: "localStorage",
    });
    _posthog = posthog;
  }

  // Mixpanel
  const mpToken = import.meta.env.VITE_MIXPANEL_TOKEN;
  if (mpToken) {
    const { default: mixpanel } = await import("mixpanel-browser");
    mixpanel.init(mpToken, { track_pageview: false });
    _mixpanel = mixpanel;
  }

  // Hotjar — loaded via inline snippet, no npm package required
  const hjid = import.meta.env.VITE_HOTJAR_ID;
  if (hjid) {
    (function (h, o, t, j, a, r) {
      h.hj = h.hj || function () { (h.hj.q = h.hj.q || []).push(arguments); };
      h._hjSettings = { hjid: Number(hjid), hjsv: 6 };
      a = o.getElementsByTagName("head")[0];
      r = o.createElement("script");
      r.async = 1;
      r.src = t + h._hjSettings.hjid + j + h._hjSettings.hjsv;
      a.appendChild(r);
    })(window, document, "https://static.hotjar.com/c/hotjar-", ".js?sv=");
  }
}

// ─── Page View ───────────────────────────────────────────────────────────────

export function trackPageView(path) {
  // GA4 (gtag loaded in index.html)
  safe(() => window.gtag?.("event", "page_view", { page_path: path }));

  // Facebook Pixel
  safe(() => window.fbq?.("track", "PageView"));

  // PostHog
  safe(() => _posthog?.capture("$pageview", { $current_url: window.location.href }));

  // Mixpanel
  safe(() => _mixpanel?.track("Page View", { path }));

  if (isDev) console.debug("[Analytics] PageView:", path);
}

// ─── Event ───────────────────────────────────────────────────────────────────

export function track(eventName, properties = {}) {
  // GTM dataLayer — GA4, Facebook, Bing UET all pick this up via GTM tags
  safe(() => window.dataLayer?.push({ event: eventName, ...properties }));

  // GA4 direct (belt-and-suspenders for events GTM might not catch)
  safe(() => window.gtag?.("event", eventName, properties));

  // PostHog
  safe(() => _posthog?.capture(eventName, properties));

  // Mixpanel
  safe(() => _mixpanel?.track(eventName, properties));

  if (isDev) console.debug("[Analytics] Event:", eventName, properties);
}

// ─── Identity ────────────────────────────────────────────────────────────────
// Call after login / signup to associate events with a user.

export function identify(userId, traits = {}) {
  safe(() => window.gtag?.("set", "user_properties", traits));
  safe(() => _posthog?.identify(userId, traits));
  safe(() => _mixpanel?.identify(userId));
  safe(() => _mixpanel?.people.set(traits));
}

// Call on logout to clear the identity.
export function resetIdentity() {
  safe(() => _posthog?.reset());
  safe(() => _mixpanel?.reset());
}
