import { setTokenProvider, updateApiUrl } from "../api-client";
import { getLocalStorage } from "../lib/storage";

/**
 * Check if a hostname belongs to a private/local network range.
 * Covers 192.168.*.*, 10.*.*.*, and 172.16-31.*.*.
 */
const isPrivateNetworkHost = (hostname: string): boolean => {
  return (
    hostname.startsWith("192.168.") ||
    hostname.startsWith("10.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  );
};

/**
 * Determine the API URL based on how the app is being accessed.
 *
 * Resolution order:
 *  1. Private network hostname (192.168.x.x, 10.x.x.x, etc.) — the API runs
 *     on the same machine, so use the browser's hostname + VITE_API_PORT.
 *     This ensures LAN access always reaches the right machine regardless
 *     of which IP the device uses.
 *  2. Localhost/127.0.0.1 — use VITE_API_URL env var (typically points to a
 *     LAN IP like http://192.168.0.11:3030 so that even localhost dev uses
 *     the network-accessible API). Falls back to http://localhost:<port>.
 *  3. Production/staging domains — use VITE_API_URL env var.
 */
export const getApiUrl = (): string => {
  const hostname = window.location.hostname;
  const port = import.meta.env.VITE_API_PORT || "3030";

  // LAN access — API is on the same machine, use the browser's hostname
  if (isPrivateNetworkHost(hostname)) {
    return `http://${hostname}:${port}`;
  }

  // Localhost or production — use env var (points to LAN IP in dev, domain in prod)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // Final fallback
  return `http://localhost:${port}`;
};

/**
 * Get the API base URL, preferring the cached value set during initialization.
 * This is the function that should be used throughout the app for building API URLs
 * (file URLs, thumbnail URLs, etc.).
 */
export const getApiBaseUrl = (): string => {
  // Use cached value if available (set during initializeApiClient)
  if (typeof window !== "undefined" && (window as any).__ANKAA_API_URL__) {
    return (window as any).__ANKAA_API_URL__;
  }

  // Fall back to full resolution
  return getApiUrl();
};

// Set API URL and token provider for the api-client package
export const initializeApiClient = () => {
  // Configure token provider to auto-attach tokens
  setTokenProvider(() => {
    return getLocalStorage("token");
  });

  // Dynamically determine API URL based on access method
  const apiUrl = getApiUrl();
  (window as any).__ANKAA_API_URL__ = apiUrl;

  // Update the axios client with the new URL
  updateApiUrl(apiUrl);
};
