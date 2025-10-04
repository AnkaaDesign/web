import { notify } from "../api-client";
import { toast } from "@/components/ui/sonner";

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
    notify.setRetryHandler((title, description, _url, _method, _attempt, _maxAttempts) => {
      // For now, just show a warning toast for retries
      toast.warning(title, description, { duration: 5000 });
    });

    // Setup dismiss retry handler
    notify.setDismissRetryHandler((_url, _method) => {
      // For now, we can't dismiss specific toasts, so we'll just ignore this
      // In the future, we could track toast IDs and dismiss them
    });
  } catch (error) {
    console.error("Failed to setup web notifications:", error);
  }
}
