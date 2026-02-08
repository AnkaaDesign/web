import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { z } from "zod";
import "./index.css";

// Configure Zod error messages in Portuguese
z.setErrorMap((issue, ctx) => {
  if (issue.code === z.ZodIssueCode.invalid_type) {
    if (issue.expected === "number" && issue.received === "string") {
      return { message: "Esperado número, recebido texto" };
    }
    if (issue.expected === "string" && issue.received === "number") {
      return { message: "Esperado texto, recebido número" };
    }
    return { message: `Tipo inválido: esperado ${issue.expected}, recebido ${issue.received}` };
  }
  if (issue.code === z.ZodIssueCode.invalid_string) {
    return { message: "Formato inválido" };
  }
  if (issue.code === z.ZodIssueCode.too_small) {
    if (issue.type === "string") {
      return { message: `Mínimo de ${issue.minimum} caracteres` };
    }
    if (issue.type === "number") {
      return { message: `Valor deve ser maior ou igual a ${issue.minimum}` };
    }
    if (issue.type === "array") {
      return { message: `Deve ter no mínimo ${issue.minimum} itens` };
    }
  }
  if (issue.code === z.ZodIssueCode.too_big) {
    if (issue.type === "string") {
      return { message: `Máximo de ${issue.maximum} caracteres` };
    }
    if (issue.type === "number") {
      return { message: `Valor deve ser menor ou igual a ${issue.maximum}` };
    }
    if (issue.type === "array") {
      return { message: `Deve ter no máximo ${issue.maximum} itens` };
    }
  }
  return { message: ctx.defaultError };
});

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
  if (process.env.NODE_ENV !== 'production') {
    console.log("[QueryClient] Initialized globally before React");
  }
}

// Setup error monitoring for development
if (import.meta.env.DEV) {
  // Import the monitor directly to avoid bundling it with all hook imports
  import("./hooks/common/query-error-monitor")
    .then(({ queryErrorMonitor }) => {
      queryErrorMonitor.setup(queryClient);
      if (process.env.NODE_ENV !== 'production') {
        console.log("[QueryClient] Error monitoring setup complete");
      }
    })
    .catch((error) => {
      if (process.env.NODE_ENV !== 'production') {
        console.warn("[QueryClient] Failed to setup error monitoring:", error);
      }
      // Non-critical error - app can continue without error monitoring
    });
}

// Import App AFTER QueryClient is created
import App from "./App";

// Register service worker for push notifications
import { registerServiceWorker } from "./lib/register-service-worker";
registerServiceWorker().catch((error) => {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('Service worker registration failed:', error);
  }
});

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
  if (process.env.NODE_ENV !== 'production') {
    console.error("Failed to find root element");
  }
}