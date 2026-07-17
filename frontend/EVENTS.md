
**File structure:**

```
src/analytics/
  index.js           ← THE only place providers are configured
  events.js          ← all event name constants
  PageViewTracker.jsx ← auto page view on route change
src/hooks/
  useAnalytics.js    ← hook for components
```

**How to use in any component:**

```jsx
import { useAnalytics } from "../hooks/useAnalytics";
import { EVENTS } from "../analytics/events";

const { track, identify, resetIdentity } = useAnalytics();

// Track an event
track(EVENTS.SCHOLARSHIP_VIEW, { scholarship_id: "abc123", scholarship_name: "Gates" });

// After login
identify(user.id, { email: user.email, plan: user.plan });

// After logout
resetIdentity();
```

**What each event fires to automatically:**

| Provider       | Page View       | Custom Events | Identity               |
| -------------- | --------------- | ------------- | ---------------------- |
| GA4 (gtag)     | ✓              | ✓            | ✓ via user_properties |
| GTM dataLayer  | ✓ via fbq      | ✓            | —                     |
| Facebook Pixel | ✓              | via GTM       | —                     |
| Bing UET       | via GTM autoSpa | via GTM       | —                     |
| PostHog        | ✓              | ✓            | ✓                     |
| Mixpanel       | ✓              | ✓            | ✓                     |
| Hotjar         | session replay  | —            | —                     |

**To add PostHog/Mixpanel:** `npm install posthog-js mixpanel-browser` and add keys to `.env.local`. Both are dynamically imported so they don't affect bundle size for users where the key is missing.
