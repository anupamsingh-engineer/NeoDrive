import { env } from "./EnvironmentConfig";

export const API_CONFIG = {
  baseUrl: env.API_ENDPOINT_URL,
  timeout: 30000,
};

export const AUTH_CONFIG = {
  // Idle session timeout in minutes — enforced by useIdleTimeout hook.
  sessionTimeout: 30,
};

export const APP_CONFIG = {
  appName: env.APP_NAME,
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
};

export default {
  API_CONFIG,
  AUTH_CONFIG,
  APP_CONFIG,
};
