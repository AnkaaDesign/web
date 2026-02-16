/**
 * Deployment environment domain configuration.
 *
 * These map deployment environments to their corresponding domain labels
 * shown in the deployment manager UI.
 */
export const DEPLOYMENT_DOMAINS = {
  staging: import.meta.env.VITE_STAGING_DOMAIN || "test.ankaadesign.com.br",
  production: import.meta.env.VITE_PRODUCTION_DOMAIN || "ankaadesign.com.br",
} as const;

/**
 * Deep link URI scheme used by the mobile app.
 * This is the custom URL protocol for opening content in the native app
 * (e.g., ankaadesign://task/123).
 */
export const APP_URI_SCHEME = import.meta.env.VITE_APP_SCHEME || "ankaadesign";
