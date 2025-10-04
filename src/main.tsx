import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";

// Initialize API client with environment-specific URL FIRST
import { initializeApiClient } from "./config/api";
initializeApiClient();

// Create QueryClient outside of React to ensure it exists before any hooks are imported
// This prevents "No QueryClient set" errors in production builds
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes garbage collection
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors (client errors)
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false;
        }
        // Retry up to 3 times for network errors and 5xx errors
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff, max 30s
    },
    mutations: {
      retry: (failureCount, error: any) => {
        // Never retry mutations on client errors
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false;
        }
        // Only retry network errors once for mutations
        return failureCount < 1;
      },
      retryDelay: 2000, // 2 second delay for mutation retries
    },
  },
});

// Store globally for debugging and lazy-loaded components
if (typeof window !== "undefined") {
  (window as any).__REACT_QUERY_CLIENT__ = queryClient;
  (window as any).__QUERY_CLIENT_INITIALIZED__ = true;
  console.log("[QueryClient] Initialized globally before React");
}

// Setup error monitoring for development
if (import.meta.env.DEV) {
  // Import the monitor directly to avoid bundling it with all hook imports
  import("./hooks/query-error-monitor")
    .then(({ queryErrorMonitor }) => {
      queryErrorMonitor.setup(queryClient);
      console.log("[QueryClient] Error monitoring setup complete");
    })
    .catch((error) => {
      console.warn("[QueryClient] Failed to setup error monitoring:", error);
      // Non-critical error - app can continue without error monitoring
    });
}

// Import App AFTER QueryClient is created
import App from "./App";

// Main app component with pre-created QueryClient
const AppWrapper = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
};

// Ensure DOM is ready before rendering
const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(<AppWrapper />);
} else {
  console.error("Failed to find root element");
}