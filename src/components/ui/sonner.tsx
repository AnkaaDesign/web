import * as React from "react";
import { useTheme } from "@/contexts/theme-context";
import { Toaster as Sonner, toast as sonnerToast } from "sonner";
import { IconCircleCheck, IconCircleX, IconAlertCircle, IconInfoCircle } from "@tabler/icons-react";

type ToasterProps = React.ComponentProps<typeof Sonner>;
type ToastOptions = Parameters<typeof sonnerToast>[1];

// Simplified toast deduplication system
class ToastManager {
  private activeToasts = new Map<string, string>(); // key -> toastId

  private generateKey(title: string, description?: string | string[]): string {
    const desc = Array.isArray(description) ? description.join(" ") : description || "";
    return `${title}:${desc}`.toLowerCase().trim();
  }

  shouldShowToast(title: string, description?: string | string[]): boolean {
    const key = this.generateKey(title, description);

    // If duplicate exists, dismiss it and allow new one
    const existingId = this.activeToasts.get(key);
    if (existingId) {
      sonnerToast.dismiss(existingId);
    }

    return true;
  }

  trackToast(toastId: string, title: string, description?: string | string[]) {
    const key = this.generateKey(title, description);
    this.activeToasts.set(key, toastId);

    // Auto-cleanup when toast expires
    setTimeout(() => {
      this.activeToasts.delete(key);
    }, 6000);
  }

  clearAll() {
    sonnerToast.dismiss();
    this.activeToasts.clear();
  }
}

// Global singleton instance
const toastManager = new ToastManager();

// Expose globally for debugging
if (typeof window !== "undefined") {
  (window as any).toastManager = toastManager;
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      expand={true}
      richColors={true}
      closeButton={true}
      duration={5000}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-xl group-[.toaster]:backdrop-blur-sm",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-sm",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          error: "group-[.toaster]:bg-destructive/95 group-[.toaster]:text-destructive-foreground group-[.toaster]:border-destructive/50",
          success: "group-[.toaster]:bg-green-600/95 group-[.toaster]:text-white group-[.toaster]:border-green-600/50",
          warning: "group-[.toaster]:bg-yellow-500/95 group-[.toaster]:text-white group-[.toaster]:border-yellow-500/50",
          info: "group-[.toaster]:bg-blue-500/95 group-[.toaster]:text-white group-[.toaster]:border-blue-500/50",
        },
        style: {
          zIndex: 9999,
        },
      }}
      {...props}
    />
  );
};

// Simplified toast system with deduplication
const toast = {
  success: (title: string, description?: string, options?: ToastOptions & { allowDuplicate?: boolean }) => {
    if (!options?.allowDuplicate) {
      toastManager.shouldShowToast(title, description);
    }

    const toastId = sonnerToast.success(title, {
      description,
      icon: <IconCircleCheck className="h-4 w-4" />,
      ...options,
    });

    if (!options?.allowDuplicate && toastId) {
      toastManager.trackToast(String(toastId), title, description);
    }

    return toastId;
  },

  error: (title: string, description?: string | string[], options?: ToastOptions & { allowDuplicate?: boolean }) => {
    const errorDescription = Array.isArray(description) ? description.join("\n") : description;

    if (!options?.allowDuplicate) {
      toastManager.shouldShowToast(title, errorDescription);
    }

    const toastId = sonnerToast.error(title, {
      description: errorDescription,
      icon: <IconCircleX className="h-4 w-4" />,
      duration: 8000,
      ...options,
    });

    if (!options?.allowDuplicate && toastId) {
      toastManager.trackToast(String(toastId), title, errorDescription);
    }

    return toastId;
  },

  warning: (title: string, description?: string, options?: ToastOptions & { allowDuplicate?: boolean }) => {
    if (!options?.allowDuplicate) {
      toastManager.shouldShowToast(title, description);
    }

    const toastId = sonnerToast.warning(title, {
      description,
      icon: <IconAlertCircle className="h-4 w-4" />,
      duration: 6000,
      ...options,
    });

    if (!options?.allowDuplicate && toastId) {
      toastManager.trackToast(String(toastId), title, description);
    }

    return toastId;
  },

  info: (title: string, description?: string, options?: ToastOptions & { allowDuplicate?: boolean }) => {
    if (!options?.allowDuplicate) {
      toastManager.shouldShowToast(title, description);
    }

    const toastId = sonnerToast.info(title, {
      description,
      icon: <IconInfoCircle className="h-4 w-4" />,
      ...options,
    });

    if (!options?.allowDuplicate && toastId) {
      toastManager.trackToast(String(toastId), title, description);
    }

    return toastId;
  },

  // For custom toasts and direct sonner access
  custom: sonnerToast.custom,
  promise: sonnerToast.promise,
  dismiss: sonnerToast.dismiss,
  loading: sonnerToast.loading,

  // Clear all toasts
  clearAll: () => toastManager.clearAll(),

  // Expose manager for advanced usage
  manager: toastManager,
};

export { Toaster, toast };
