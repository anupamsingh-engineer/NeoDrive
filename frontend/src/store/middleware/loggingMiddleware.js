import logger from "../../utils/logger";

const isDevelopment = import.meta.env.DEV;

const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "accessToken",
  "refreshToken",
  "secret",
  "apiKey",
]);

// Recursively redact sensitive keys so credentials never appear in console or logs.
const scrubPayload = (payload, depth = 0) => {
  if (depth > 3 || !payload || typeof payload !== "object") return payload;
  if (Array.isArray(payload)) return payload.map((item) => scrubPayload(item, depth + 1));
  return Object.fromEntries(
    Object.entries(payload).map(([k, v]) =>
      SENSITIVE_KEYS.has(k) ? [k, "[REDACTED]"] : [k, scrubPayload(v, depth + 1)],
    ),
  );
};

const IMPORTANT_ACTION_TYPES = new Set([
  "auth/handleLogout",
  "auth/checkAuthState",
  "auth/logoutUser/pending",
  "auth/logoutUser/fulfilled",
  "auth/logoutUser/rejected",
]);

const isImportantAction = (actionType) => IMPORTANT_ACTION_TYPES.has(actionType);

export const loggingMiddleware = (store) => (next) => (action) => {
  const startTime = performance.now();

  if (isDevelopment) {
    console.group(`🔵 Action: ${action.type}`);
    console.log("📥 Payload:", scrubPayload(action.payload));
    console.log("📊 Previous State:", store.getState());
  }

  let result;

  try {
    result = next(action);
  } catch (err) {
    logger.error(`Action failed: ${action.type}`, {
      error: err.message,
      stack: err.stack,
      action: action.type,
    });
    if (isDevelopment) {
      console.error("❌ Error:", err);
    }
    throw err;
  }

  const endTime = performance.now();
  const duration = (endTime - startTime).toFixed(2);

  if (isDevelopment) {
    console.log("📤 Next State:", store.getState());
    console.log(`⏱️  Duration: ${duration}ms`);
    console.groupEnd();
  }

  if (!isDevelopment && isImportantAction(action.type)) {
    logger.info(`Action: ${action.type}`, {
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
  }

  return result;
};
