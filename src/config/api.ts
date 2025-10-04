import { setTokenProvider, updateApiUrl } from "../api-client";
import { getLocalStorage } from "../lib/storage";

// Set API URL and token provider for the api-client package
export const initializeApiClient = () => {
  // Configure token provider to auto-attach tokens
  setTokenProvider(() => {
    return getLocalStorage("token");
  });

  // Set API URL to use network IP instead of localhost for development
  // This allows both web and mobile to connect to the same API server
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3030";
  (window as any).__ANKAA_API_URL__ = apiUrl;

  // Update the axios client with the new URL
  updateApiUrl(apiUrl);
};
