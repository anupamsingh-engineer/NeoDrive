// Single source of truth for which request-body fields carry raw credentials/secrets - used by
// both logger.js's pino `redact` config (log lines) and bodyLoggerMiddleware (Jaeger span
// attributes), so a newly added sensitive field only needs updating here, not in two places that
// could silently drift apart.
export const SENSITIVE_BODY_FIELDS = [
  "password",
  "otp",
  "token",
  "verificationToken",
  "idToken",
  "refreshToken",
  "accessToken",
];

export function redactSensitiveFields(body) {
  if (!body || typeof body !== "object") return body;
  const redacted = { ...body };
  for (const field of SENSITIVE_BODY_FIELDS) {
    if (field in redacted) redacted[field] = "[Redacted]";
  }
  return redacted;
}
