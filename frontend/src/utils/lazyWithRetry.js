import { lazy } from "react";

// Vite hashes each chunk's filename per build (vite.config.js has no chunkFileNames override).
// A tab left open across a deploy still holds route components it hasn't loaded into memory yet
// as `import("...")` calls pointing at the *old* hashed filenames — which the server/CDN no
// longer serves once the new build replaces `dist`. That rejected import throws during Suspense
// resolution and gets caught by the app's single top-level ErrorBoundary (App.jsx), blanking the
// whole app to the generic "Something went wrong" screen. A manual reload fixes it because it
// re-fetches index.html, which points at the current build's hashes — this makes that recovery
// automatic instead of relying on the user noticing and clicking reload.
//
// Guarded by sessionStorage per chunk (not a single global flag) so a genuinely broken chunk —
// not just a stale one — retries exactly once, then falls through to the real error instead of
// reload-looping forever.
export function lazyWithRetry(importFn, chunkName) {
  return lazy(async () => {
    const storageKey = `lazy-retry:${chunkName}`;
    try {
      const module = await importFn();
      sessionStorage.removeItem(storageKey);
      return module;
    } catch (error) {
      if (!sessionStorage.getItem(storageKey)) {
        sessionStorage.setItem(storageKey, "1");
        window.location.reload();
        // Reload is async — never resolve so React doesn't try to render this failed module
        // while the reload is in flight.
        return new Promise(() => {});
      }
      sessionStorage.removeItem(storageKey);
      throw error;
    }
  });
}
