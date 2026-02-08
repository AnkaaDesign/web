import { useCallback, useRef } from "react";
import { toast } from "sonner";

interface ToastOptions {
  title: string;
  description?: string | string[];
  variant?: "success" | "error" | "warning" | "info";
  duration?: number;
  allowDuplicate?: boolean;
}

// Web toast manager to prevent duplicates
class WebToastManager {
  private lastToasts = new Map<string, number>(); // key -> timestamp
  private retryAlerts = new Map<string, boolean>(); // retryKey -> isShowing

  private generateKey(title: string, description?: string | string[]): string {
    const desc = Array.isArray(description) ? description.join("") : description || "";
    return `${title}:${desc}`.toLowerCase().replace(/\s+/g, " ");
  }

  shouldShow(title: string, description?: string | string[], allowDuplicate = false): boolean {
    if (allowDuplicate) return true;

    const key = this.generateKey(title, description);
    const now = Date.now();
    const lastShown = this.lastToasts.get(key);

    // Don't show if the same toast was shown within the last 3 seconds
    if (lastShown && now - lastShown < 3000) {
      return false;
    }

    this.lastToasts.set(key, now);
    return true;
  }

  setRetryShowing(url: string, method: string, isShowing: boolean) {
    const key = `${method}:${url}`;
    this.retryAlerts.set(key, isShowing);
  }

  isRetryShowing(url: string, method: string): boolean {
    const key = `${method}:${url}`;
    return this.retryAlerts.get(key) || false;
  }
}

export function useToast() {
  const managerRef = useRef(new WebToastManager());
  const manager = managerRef.current;

  const toastFn = useCallback(
    (options: ToastOptions) => {
      // Check for duplicates
      if (!manager.shouldShow(options.title, options.description, options.allowDuplicate)) {
        return;
      }

      // Format description - handle arrays of error messages
      const formattedDescription = Array.isArray(options.description) ? options.description.join("\n") : options.description;

      // Map duration based on variant
      const duration =
        options.duration ||
        (() => {
          switch (options.variant) {
            case "error":
              return 8000;
            case "warning":
              return 6000;
            case "success":
              return 4000;
            case "info":
              return 5000;
            default:
              return 5000;
          }
        })();

      // Call appropriate sonner toast method
      switch (options.variant) {
        case "success":
          toast.success(options.title, {
            description: formattedDescription,
            duration,
          });
          break;
        case "error":
          toast.error(options.title, {
            description: formattedDescription,
            duration,
          });
          break;
        case "warning":
          toast.warning(options.title, {
            description: formattedDescription,
            duration,
          });
          break;
        case "info":
          toast.info(options.title, {
            description: formattedDescription,
            duration,
          });
          break;
        default:
          toast(options.title, {
            description: formattedDescription,
            duration,
          });
      }
    },
    [manager],
  );

  // Helper methods for common use cases
  const success = useCallback(
    (title: string, description?: string | string[], options?: { allowDuplicate?: boolean; duration?: number }) => {
      toastFn({ title, description, variant: "success", allowDuplicate: options?.allowDuplicate, duration: options?.duration });
    },
    [toastFn],
  );

  const error = useCallback(
    (title: string, description?: string | string[], options?: { allowDuplicate?: boolean; duration?: number }) => {
      toastFn({ title, description, variant: "error", allowDuplicate: options?.allowDuplicate, duration: options?.duration });
    },
    [toastFn],
  );

  const warning = useCallback(
    (title: string, description?: string | string[], options?: { allowDuplicate?: boolean; duration?: number }) => {
      toastFn({ title, description, variant: "warning", allowDuplicate: options?.allowDuplicate, duration: options?.duration });
    },
    [toastFn],
  );

  const info = useCallback(
    (title: string, description?: string | string[], options?: { allowDuplicate?: boolean; duration?: number }) => {
      toastFn({ title, description, variant: "info", allowDuplicate: options?.allowDuplicate, duration: options?.duration });
    },
    [toastFn],
  );

  // Retry-specific toast for web
  const retry = useCallback(
    (title: string, description: string, url: string, method: string, attempt: number, maxAttempts: number) => {
      // Don't show multiple retry alerts for the same request
      if (manager.isRetryShowing(url, method)) {
        return;
      }

      manager.setRetryShowing(url, method, true);

      const retryDescription = `${description}\n\nTentativa ${attempt} de ${maxAttempts}`;

      toast.info(`🔄 ${title}`, {
        description: retryDescription,
        duration: 8000,
      });

      // Auto-clear retry flag after 10 seconds
      setTimeout(() => {
        manager.setRetryShowing(url, method, false);
      }, 10000);
    },
    [manager],
  );

  return {
    toast: toastFn,
    success,
    error,
    warning,
    info,
    retry,
    manager,
  };
}
