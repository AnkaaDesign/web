import { notify } from "../api-client";
import { toast } from "@/components/ui/sonner";

// Track retry toasts by request to prevent duplicates
const retryToasts = new Map<string, string | number>();

// Generate unique key for a request
function getRequestKey(url: string, method: string): string {
  return `${method.toUpperCase()}:${url}`;
}

// Setup web notification handler using Sonner toast
export function setupWebNotifications() {
  try {
    // Setup regular notification handler
    notify.setHandler((type, title, message, options) => {
      const toastOptions = {
        duration: options?.duration,
        closeButton: options?.closable,
        // Force rate limit errors to always show (bypass duplicate prevention)
        ...(title === "Muitas Tentativas" ? { force: true } : {}),
      };

      // Debug logging for troubleshooting
      if (process.env.NODE_ENV === "development") {
      }

      switch (type) {
        case "success":
          toast.success(title, message, toastOptions);
          break;
        case "error":
          toast.error(title, message, toastOptions);
          break;
        case "warning":
          toast.warning(title, message, toastOptions);
          break;
        case "info":
          toast.info(title, message, toastOptions);
          break;
        default:
          toast.info(title, message, toastOptions);
      }
    });

    // Setup retry notification handler
    notify.setRetryHandler((title, description, url, method, attempt, maxAttempts) => {
      const requestKey = getRequestKey(url, method);
      const existingToastId = retryToasts.get(requestKey);

      // Dismiss existing retry toast for this request
      if (existingToastId) {
        toast.dismiss(existingToastId);
      }

      // Create new toast and track its ID
      const toastId = toast.warning(
        title,
        `${description} (Tentativa ${attempt} de ${maxAttempts})`,
        { duration: 5000 }
      );

      // Track the toast ID for this request
      if (toastId) {
        retryToasts.set(requestKey, toastId);
      }
    });

    // Setup dismiss retry handler
    notify.setDismissRetryHandler((url, method) => {
      const requestKey = getRequestKey(url, method);
      const toastId = retryToasts.get(requestKey);

      if (toastId) {
        toast.dismiss(toastId);
        retryToasts.delete(requestKey);
      }
    });
  } catch (error) {
    console.error("Failed to setup web notifications:", error);
  }
}
