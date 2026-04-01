import * as React from "react";
import { useTheme } from "@/contexts/theme-context";
import { useSidebar } from "@/contexts/sidebar-context";
import { Toaster as Sonner, toast as sonnerToast } from "sonner";
import { IconCircleCheck, IconCircleX, IconAlertCircle, IconInfoCircle, IconX, IconLoader } from "@tabler/icons-react";

type ToasterProps = React.ComponentProps<typeof Sonner>;
type ToastOptions = Parameters<typeof sonnerToast>[1] & { allowDuplicate?: boolean };

// Unique toast IDs for specific error types
const NETWORK_ERROR_TOAST_ID = 'network-error-toast';

// Z-index layers — API toasts render above notification toasts
const TOAST_Z_API = 10000;
const TOAST_Z_NOTIFICATION = 9990;

// Color + icon config per toast type
const TOAST_STYLES = {
  success: {
    colors: 'bg-green-600/95 text-white border-green-600/50',
    icon: <IconCircleCheck className="h-4 w-4 shrink-0" />,
    defaultDuration: 5000,
  },
  error: {
    colors: 'bg-destructive/95 text-destructive-foreground border-destructive/50',
    icon: <IconCircleX className="h-4 w-4 shrink-0" />,
    defaultDuration: 8000,
  },
  warning: {
    colors: 'bg-yellow-500/95 text-white border-yellow-500/50',
    icon: <IconAlertCircle className="h-4 w-4 shrink-0" />,
    defaultDuration: 6000,
  },
  info: {
    colors: 'bg-blue-500/95 text-white border-blue-500/50',
    icon: <IconInfoCircle className="h-4 w-4 shrink-0" />,
    defaultDuration: 5000,
  },
} as const;

// Simplified toast deduplication system
class ToastManager {
  private activeToasts = new Map<string, string>(); // key -> toastId

  private generateKey(title: string, description?: string | string[]): string {
    const desc = Array.isArray(description) ? description.join(" ") : description || "";
    return `${title}:${desc}`.toLowerCase().trim();
  }

  // Check if this is a network/connection error
  private isNetworkError(title: string, description?: string | string[]): boolean {
    const titleLower = title.toLowerCase();
    const descLower = (Array.isArray(description) ? description.join(" ") : description || "").toLowerCase();

    return (
      titleLower.includes("conexão") ||
      titleLower.includes("connection") ||
      titleLower.includes("erro de conexão") ||
      descLower.includes("não foi possível conectar") ||
      descLower.includes("conexão com a internet") ||
      descLower.includes("connection refused")
    );
  }

  shouldShowToast(title: string, description?: string | string[]): { show: boolean; id?: string } {
    const key = this.generateKey(title, description);

    // Special handling for network errors - use a single toast that gets updated
    if (this.isNetworkError(title, description)) {
      return { show: true, id: NETWORK_ERROR_TOAST_ID };
    }

    // If duplicate exists, dismiss it and allow new one
    const existingId = this.activeToasts.get(key);
    if (existingId) {
      sonnerToast.dismiss(existingId);
    }

    return { show: true };
  }

  trackToast(toastId: string, title: string, description?: string | string[]) {
    if (this.isNetworkError(title, description)) {
      return;
    }

    const key = this.generateKey(title, description);
    this.activeToasts.set(key, toastId);

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
  const { isOpen: isSidebarOpen } = useSidebar();

  // Sidebar widths: 288px (w-72) when open, 64px (w-16) when minimized
  const sidebarWidth = isSidebarOpen ? 288 : 64;

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-right"
      visibleToasts={2}
      expand={true}
      richColors={true}
      closeButton={false}
      duration={5000}
      offset={8}
      style={{
        '--width': '280px',
        right: `${sidebarWidth + 12}px`,
      } as React.CSSProperties}
      toastOptions={{
        style: {
          padding: 0,
          background: 'transparent',
          border: 'none',
          boxShadow: 'none',
        },
      }}
      {...props}
    />
  );
};

/**
 * Renders a custom toast with unified design.
 * All toast types (success, error, warning, info) use this same layout.
 * zIndex controls layering — API toasts use TOAST_Z_API, notification toasts use TOAST_Z_NOTIFICATION.
 */
// Short header labels per toast type — used when the title is too long and gets moved to the body
const TOAST_TYPE_HEADERS: Record<keyof typeof TOAST_STYLES, string> = {
  success: 'Sucesso',
  error: 'Erro',
  warning: 'Atenção',
  info: 'Info',
};

// Max chars before the title is considered "long" and moved to description
const TITLE_MAX_LENGTH = 40;

function renderCustomToast(
  _id: string | number,
  type: keyof typeof TOAST_STYLES,
  title: string,
  description?: string,
  action?: { label: string; onClick: () => void },
  zIndex: number = TOAST_Z_API,
) {
  const style = TOAST_STYLES[type];

  // If title is long and there's no description, move title text to the body
  let displayTitle = title;
  let displayDescription = description;
  if (!description && title.length > TITLE_MAX_LENGTH) {
    displayTitle = TOAST_TYPE_HEADERS[type];
    displayDescription = title;
  }

  return (
    <div
      className={`w-full rounded-lg border p-4 shadow-sm relative ${style.colors}`}
      style={{ width: 280, zIndex }}
    >
      <button
        className="absolute top-2 right-2 p-0.5 rounded-full opacity-60 hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          toastManager.clearAll();
        }}
      >
        <IconX className="h-3.5 w-3.5" />
      </button>
      <div className="flex items-start gap-2 pr-5">
        {style.icon}
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm">{displayTitle}</div>
          {displayDescription && (
            <div className="text-sm opacity-80 mt-1 line-clamp-4">{displayDescription}</div>
          )}
          {action && (
            <button
              className="text-sm font-medium mt-2 underline underline-offset-2 opacity-80 hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                action.onClick();
                toastManager.clearAll();
              }}
            >
              {action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Creates a toast method for a given type.
 * Supports both calling conventions:
 *   toast.success("title", "description", options)
 *   toast.success("title", { id, description, ... })  // sonner-style
 */
function createToastMethod(type: keyof typeof TOAST_STYLES) {
  return (title: string, descriptionOrOptions?: string | string[] | ToastOptions, maybeOptions?: ToastOptions) => {
    let desc: string | undefined;
    let options: ToastOptions | undefined;

    // Detect if 2nd arg is an options object (sonner-style) vs a description string
    if (descriptionOrOptions && typeof descriptionOrOptions === 'object' && !Array.isArray(descriptionOrOptions)) {
      options = descriptionOrOptions as ToastOptions;
      desc = (options as any)?.description;
    } else {
      desc = Array.isArray(descriptionOrOptions) ? descriptionOrOptions.join("\n") : descriptionOrOptions as string | undefined;
      options = maybeOptions;
    }

    let dedupResult: { show: boolean; id?: string } = { show: true };
    if (!options?.allowDuplicate) {
      dedupResult = toastManager.shouldShowToast(title, desc);
    }

    const duration = (options as any)?.duration ?? TOAST_STYLES[type].defaultDuration;
    const action = (options as any)?.action as { label: string; onClick: () => void } | undefined;

    const toastId = sonnerToast.custom(
      (id) => renderCustomToast(id, type, title, desc, action),
      {
        duration,
        ...(dedupResult.id ? { id: dedupResult.id } : {}),
        ...((options as any)?.id ? { id: (options as any).id } : {}),
      },
    );

    if (!options?.allowDuplicate && toastId) {
      toastManager.trackToast(String(toastId), title, desc);
    }

    return toastId;
  };
}

// Unified toast system — all types render with the same custom design
const toast = {
  success: createToastMethod('success'),
  error: createToastMethod('error'),
  warning: createToastMethod('warning'),
  info: createToastMethod('info'),

  // Custom loading toast with consistent styling
  loading: (title: string, options?: { id?: string | number; description?: string; duration?: number }) => {
    const desc = options?.description;
    return sonnerToast.custom(
      (_id) => (
        <div
          className="w-full rounded-lg border p-4 shadow-sm relative bg-muted/95 text-foreground border-border"
          style={{ width: 280, zIndex: TOAST_Z_API }}
        >
          <div className="flex items-start gap-2">
            <IconLoader className="h-4 w-4 shrink-0 animate-spin" />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm">{title}</div>
              {desc && <div className="text-sm opacity-80 mt-1 line-clamp-3">{desc}</div>}
            </div>
          </div>
        </div>
      ),
      {
        duration: options?.duration ?? Infinity,
        ...(options?.id ? { id: options.id } : {}),
      },
    );
  },

  // For fully custom toasts and direct sonner access
  custom: sonnerToast.custom,
  promise: sonnerToast.promise,
  dismiss: sonnerToast.dismiss,

  // Clear all toasts
  clearAll: () => toastManager.clearAll(),

  // Expose manager for advanced usage
  manager: toastManager,
};

export { Toaster, toast, renderCustomToast, TOAST_Z_API, TOAST_Z_NOTIFICATION, TOAST_STYLES };
