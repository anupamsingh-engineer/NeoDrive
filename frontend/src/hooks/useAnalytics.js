import { track, identify, resetIdentity } from "../analytics";

// Thin hook so components never import from analytics/index.js directly.
// Usage:
//   const { track } = useAnalytics();
//   track(EVENTS.SCHOLARSHIP_VIEW, { scholarship_id: "123" });
export function useAnalytics() {
  return { track, identify, resetIdentity };
}
