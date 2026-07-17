const isDev = import.meta.env.DEV;
const noop = () => {};

const logger = {
  log:   isDev ? (msg, data) => console.log(`[LOG] ${msg}`, data ?? '')   : noop,
  info:  isDev ? (msg, data) => console.info(`[INFO] ${msg}`, data ?? '')  : noop,
  warn:  isDev ? (msg, data) => console.warn(`[WARN] ${msg}`, data ?? '')  : noop,
  debug: isDev ? (msg, data) => console.debug(`[DEBUG] ${msg}`, data ?? '') : noop,

  error: (msg, error) => {
    if (isDev) {
      console.error(`[ERROR] ${msg}`, error ?? '');
    }
    // Production: wire in Sentry or similar here
    // if (!isDev) Sentry.captureException(error, { extra: { msg } });
  },
};

export default logger;
