import { setTokenProvider, updateApiUrl } from "../api-client";
import { getLocalStorage } from "../lib/storage";

// Determine the API URL based on how the app is being accessed
const getApiUrl = (): string => {
  const hostname = window.location.hostname;

  // Local IP access - use local API
  if (hostname === "192.168.10.180" || hostname.startsWith("192.168.")) {
    return `http://${hostname}:3030`;
  }

  // Localhost development
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return import.meta.env.VITE_API_URL || "http://localhost:3030";
  }

  // Domain access - use production API (or configured URL)
  return import.meta.env.VITE_API_URL || "https://api.ankaadesign.com.br";
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
