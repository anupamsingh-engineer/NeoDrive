import "dotenv/config";

const isProduction = process.env.NODE_ENV === "production";

// Parses jsonwebtoken-style duration strings ("30d", "15m", "12h", "45s") into milliseconds,
// so the refresh-token cookie maxAge and DB TTL index stay in sync with whatever expiry is
// actually signed into the JWT instead of a hardcoded constant that silently drifts from it.
function parseDurationMs(duration, fallbackMs) {
  const match = /^(\d+)\s*(d|h|m|s)?$/.exec(String(duration).trim());
  if (!match) return fallbackMs;
  const value = Number(match[1]);
  const unitMs = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return value * unitMs[match[2] || "s"];
}

const refreshExpiry = process.env.REFRESH_TOKEN_EXPIRY || "30d";

function requireEnv(key) {
  const value = process.env[key];
  if (!value) {
    console.error(`[config] Missing required env var: ${key}`);
    process.exit(1);
  }
  return value;
}

function requireEnvInProd(key, fallback = undefined) {
  const value = process.env[key];
  if (!value) {
    if (isProduction) {
      console.error(`[config] Missing required production env var: ${key}`);
      process.exit(1);
    }
    console.warn(
      `[config] Missing env var ${key} (allowed outside production)`,
    );
    return fallback;
  }
  return value;
}

const config = {
  env: process.env.NODE_ENV || "development",
  isProduction,
  port: Number(process.env.PORT) || 4000,

  db: {
    url: requireEnv("DB_URL"),
  },

  redis: {
    url: requireEnv("REDIS_URL"),
  },

  cors: {
    allowedOrigins: [process.env.CLIENT_URL_1, process.env.CLIENT_URL_2].filter(
      Boolean,
    ),
  },

  // Reuses CLIENT_URL_1 (already the CORS-trusted primary frontend origin) rather than a
  // separate env var - keeps the link embedded in emails (password reset) always pointing at
  // the same origin the browser is actually allowed to call the API from, with one value to
  // update instead of two that could drift apart.
  frontend: {
    url: process.env.CLIENT_URL_1 || "http://localhost:5173",
  },

  jwt: {
    accessSecret: requireEnv("ACCESS_TOKEN_SECRET"),
    refreshSecret: requireEnv("REFRESH_TOKEN_SECRET"),
    accessExpiry: process.env.ACCESS_TOKEN_EXPIRY || "15m",
    refreshExpiry,
    refreshExpiryMs: parseDurationMs(refreshExpiry, 30 * 24 * 60 * 60 * 1000),
    passwordResetExpiry: process.env.PASSWORD_RESET_TOKEN_EXPIRY || "15m",
    accountUnlockExpiry: process.env.ACCOUNT_UNLOCK_TOKEN_EXPIRY || "15m",
    // How long a verified OTP stays "usable" for finishing registration - generous enough to
    // fill in name/password (and survive an accidental page reload) without the OTP's own
    // 10-minute TTL being the limiting factor, since verify-otp consumes the OTP record itself.
    emailVerificationExpiry:
      process.env.EMAIL_VERIFICATION_TOKEN_EXPIRY || "30m",
  },

  csrf: {
    secret: requireEnv("CSRF_SECRET"),
  },

  auth: {
    bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS) || 12,
    maxLoginAttempts: Number(process.env.MAX_LOGIN_ATTEMPTS) || 5,
    lockDurationMs: Number(process.env.LOCK_DURATION_MS) || 30 * 60 * 1000,
    maxSessionsPerUser: Number(process.env.MAX_SESSIONS_PER_USER) || 5,
  },

  otp: {
    ttlSeconds: Number(process.env.OTP_TTL_SECONDS) || 600,
    resendCooldownSeconds:
      Number(process.env.OTP_RESEND_COOLDOWN_SECONDS) || 60,
    maxVerifyAttempts: Number(process.env.OTP_MAX_VERIFY_ATTEMPTS) || 5,
  },

  aws: {
    region: process.env.AWS_REGION || "ap-south-1",
    accessKeyId: requireEnvInProd("AWS_ACCESS_KEY_ID"),
    secretAccessKey: requireEnvInProd("AWS_SECRET_KEY"),
    bucket: requireEnvInProd("AWS_S3_BUCKET"),
  },

  cloudfront: {
    domain: requireEnvInProd("CLOUDFRONT_DOMAIN"),
    keyPairId: requireEnvInProd("CLOUDFRONT_KEY_PAIR_ID"),
    // Stored as a single line with literal "\n" escapes (not real line breaks) - a real
    // multi-line PEM value in .env works for Node's --env-file loader but breaks tools like
    // `docker compose`, which also parses .env for its own variable substitution and doesn't
    // support multi-line quoted values.
    privateKey: requireEnvInProd("CLOUDFRONT_PRIVATE_KEY")?.replace(
      /\\n/g,
      "\n",
    ),
    signedUrlExpirySeconds:
      Number(process.env.CLOUDFRONT_URL_EXPIRY_SECONDS) || 3600, // 1 hour
    // Deliberately much shorter than the owner default above: a signed URL's validity is baked
    // into its own signature/expiry and CloudFront never re-checks it against our Share
    // documents, so revoking a share can't retroactively invalidate a download URL that was
    // already handed out. Keeping this short is the only lever that narrows that window - it
    // can't be closed to zero without proxying downloads through this server (defeating the
    // point of CloudFront) or standing up signed-cookie + Lambda@Edge revocation checks.
    shareSignedUrlExpirySeconds:
      Number(process.env.SHARE_DOWNLOAD_URL_EXPIRY_SECONDS) || 300, // 5 min
  },

  google: {
    clientId: "GOOGLE_CLIENT_ID",
    // clientId: requireEnvInProd("GOOGLE_CLIENT_ID"),
  },

  resend: {
    apiKey: requireEnvInProd("RESEND_API_KEY"),
    fromAddress:
      process.env.RESEND_FROM_ADDRESS || "NeoDrive <otp@procodrr.dev>",
  },

  razorpay: {
    keyId: requireEnvInProd("RAZORPAY_KEY_ID"),
    keySecret: requireEnvInProd("RAZORPAY_KEY_SECRET"),
    webhookSecret: requireEnvInProd("RAZORPAY_WEBHOOK_SECRET"),
  },

  storage: {
    defaultMaxStorageBytes:
      Number(process.env.DEFAULT_MAX_STORAGE_BYTES) || 15 * 1024 ** 3,
  },

  observability: {
    logLevel: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),
    metricsToken: process.env.METRICS_TOKEN,
    otelServiceName: process.env.OTEL_SERVICE_NAME || "neodrive-backend",
    otelExporterOtlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  },
};

export default Object.freeze(config);
