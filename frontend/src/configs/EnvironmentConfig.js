/* eslint-disable no-undef */
const NODE_ENV = process.env.NODE_ENV;

const dev = {
  APP_NAME: "NeoDrive",
  API_ENDPOINT_URL: "https://api.storage.anupamsingh.xyz/",
  // API_ENDPOINT_URL: import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/",
  FRONTEND_DOMAIN: "localhost",
};

const prod = {
  APP_NAME: "NeoDrive",
  API_ENDPOINT_URL:
    import.meta.env.VITE_API_BASE_URL || "https://api.example.com/",
  FRONTEND_DOMAIN: "example.com",
};

// Suppress all console output in production to prevent data leaks via DevTools.
if (NODE_ENV === "production") {
  const noop = () => {};
  console.log = noop;
  console.info = noop;
  console.warn = noop;
  console.debug = noop;
  // console.error is intentionally kept so browser-level errors remain visible
  // in monitoring tools (Sentry source maps, crash reporters).
}

const getEnv = () => {
  switch (NODE_ENV) {
    case "production":
      return prod;
    default:
      return dev;
  }
};

export const env = getEnv();
