// Decode-only - never used to verify or trust a token, purely to read a claim (e.g. `exp`) for a
// UI hint. The backend independently re-verifies signature + expiry on every request that
// actually matters, so nothing security-sensitive rides on this being tamper-proof or even
// correct - worst case a stale/garbled read just shows the wrong hint in the UI.
function decodeJwtPayload(token) {
  try {
    const [, payload] = token.split(".");
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// Returns the token's `exp` claim as epoch milliseconds, or null if it can't be read.
export function getJwtExpiryMs(token) {
  const payload = decodeJwtPayload(token);
  return typeof payload?.exp === "number" ? payload.exp * 1000 : null;
}
