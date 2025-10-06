import React, { useEffect, useState } from "react";
import { IconCheck, IconLoader2, IconArrowUp, IconArrowDown, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import type { SortConfig } from "@/utils/table-sort-utils";

/**
 * Sort feedback state types
 */
export type SortFeedbackState = "idle" | "loading" | "success" | "error";

/**
 * Sort feedback configuration
 */
export interface SortFeedbackConfig {
  state: SortFeedbackState;
  message?: string;
  duration?: number;
  showIcon?: boolean;
  variant?: "minimal" | "detailed" | "toast";
}

/**
 * Props for the sort feedback component
 */
interface TableSortFeedbackProps {
  config: SortFeedbackConfig;
  sortConfigs: SortConfig[];
  columnLabels?: Record<string, string>;
  onDismiss?: () => void;
  className?: string;
}

/**
 * Immediate feedback component for sort operations
 * Shows loading states, success confirmations, and error messages
 */
export function TableSortFeedback({ config, sortConfigs, columnLabels = {}, onDismiss, className }: TableSortFeedbackProps) {
  const [isVisible, setIsVisible] = useState(false);

  const { state = "idle", message, duration = 3000, showIcon = true, variant = "minimal" } = config;

  // Auto-show/hide based on state
  useEffect(() => {
    if (state !== "idle") {
      setIsVisible(true);

      if (state === "success" && duration > 0) {
        const timer = setTimeout(() => {
          setIsVisible(false);
          onDismiss?.();
        }, duration);

        return () => clearTimeout(timer);
      }
    } else {
      setIsVisible(false);
    }
  }, [state, duration, onDismiss]);

  // Don't render if idle or not visible
  if (state === "idle" || !isVisible) {
    return null;
  }

  // Get appropriate icon based on state
  const getIcon = () => {
    if (!showIcon) return null;

    switch (state) {
      case "loading":
        return <IconLoader2 className="h-4 w-4 animate-spin" />;
      case "success":
        return <IconCheck className="h-4 w-4 text-green-600" />;
      case "error":
        return <IconX className="h-4 w-4 text-red-600" />;
      default:
        return null;
    }
  };

  // Get color classes based on state
  const getColorClasses = () => {
    switch (state) {
      case "loading":
        return "bg-blue-50 border-blue-200 text-blue-800";
      case "success":
        return "bg-green-50 border-green-200 text-green-800";
      case "error":
        return "bg-red-50 border-red-200 text-red-800";
      default:
        return "bg-gray-50 border-gray-200 text-gray-800";
    }
  };

  // Generate default message based on sort configs
  const getDefaultMessage = () => {
    if (message) return message;

    switch (state) {
      case "loading":
        return "Aplicando ordenação...";
      case "success":
        if (sortConfigs.length === 0) {
          return "Ordenação removida";
        } else if (sortConfigs.length === 1) {
          const config = sortConfigs[0];
          const columnLabel = columnLabels[config.column] || config.column;
          const direction = config.direction === "asc" ? "crescente" : "decrescente";
          return `Ordenado por ${columnLabel} (${direction})`;
        } else {
          return `Ordenação aplicada (${sortConfigs.length} colunas)`;
        }
      case "error":
        return "Erro ao aplicar ordenação";
      default:
        return "";
    }
  };

  // Toast variant (floating notification)
  if (variant === "toast") {
    return (
      <div
        className={cn(
          "fixed top-4 right-4 z-50 max-w-sm w-full",
          "transform transition-all duration-300 ease-in-out",
          isVisible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0",
          className,
        )}
      >
        <div className={cn("flex items-center gap-3 p-4 rounded-lg border shadow-lg", getColorClasses())}>
          {getIcon()}
          <div className="flex-1">
            <p className="text-sm font-medium">{getDefaultMessage()}</p>
            {variant === "detailed" && sortConfigs.length > 0 && (
              <div className="mt-1 text-xs opacity-80">
                {sortConfigs.map((config, index) => (
                  <div key={config.column} className="flex items-center gap-1">
                    <span>{columnLabels[config.column] || config.column}</span>
                    {config.direction === "asc" ? <IconArrowUp className="h-3 w-3" /> : <IconArrowDown className="h-3 w-3" />}
                    {index < sortConfigs.length - 1 && <span>, </span>}
                  </div>
                ))}
              </div>
            )}
          </div>
          {onDismiss && (
            <button
              onClick={() => {
                setIsVisible(false);
                onDismiss();
              }}
              className="p-1 hover:bg-black/10 rounded transition-colors"
              aria-label="Fechar"
            >
              <IconX className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Detailed variant (expanded information)
  if (variant === "detailed") {
    return (
      <div className={cn("flex items-start gap-3 p-4 rounded-lg border", getColorClasses(), className)}>
        {getIcon()}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{getDefaultMessage()}</p>
          {sortConfigs.length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-xs font-medium opacity-80">Ordenação ativa:</p>
              <div className="flex flex-wrap gap-2">
                {sortConfigs.map((config, index) => (
                  <div key={config.column} className="inline-flex items-center gap-1 px-2 py-1 bg-white/50 rounded text-xs">
                    <span className="font-medium">
                      {index + 1}. {columnLabels[config.column] || config.column}
                    </span>
                    {config.direction === "asc" ? <IconArrowUp className="h-3 w-3" /> : <IconArrowDown className="h-3 w-3" />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={() => {
              setIsVisible(false);
              onDismiss();
            }}
            className="p-1 hover:bg-black/10 rounded transition-colors"
            aria-label="Fechar"
          >
            <IconX className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  // Minimal variant (default)
  return (
    <div className={cn("inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm", getColorClasses(), className)}>
      {getIcon()}
      <span>{getDefaultMessage()}</span>
      {onDismiss && state !== "loading" && (
        <button
          onClick={() => {
            setIsVisible(false);
            onDismiss();
          }}
          className="ml-2 p-0.5 hover:bg-black/10 rounded transition-colors"
          aria-label="Fechar"
        >
          <IconX className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

/**
 * Hook for managing sort feedback state
 */
export function useSortFeedback(
  options: {
    enableFeedback?: boolean;
    feedbackDuration?: number;
    feedbackVariant?: "minimal" | "detailed" | "toast";
  } = {},
) {
  const { enableFeedback = true, feedbackDuration = 3000, feedbackVariant = "minimal" } = options;

  const [feedbackConfig, setFeedbackConfig] = useState<SortFeedbackConfig>({
    state: "idle",
    duration: feedbackDuration,
    variant: feedbackVariant,
  });

  // Show loading feedback
  const showLoading = (message?: string) => {
    if (!enableFeedback) return;

    setFeedbackConfig({
      state: "loading",
      message,
      duration: 0, // Don't auto-hide loading
      variant: feedbackVariant,
    });
  };

  // Show success feedback
  const showSuccess = (message?: string) => {
    if (!enableFeedback) return;

    setFeedbackConfig({
      state: "success",
      message,
      duration: feedbackDuration,
      variant: feedbackVariant,
    });
  };

  // Show error feedback
  const showError = (message?: string) => {
    if (!enableFeedback) return;

    setFeedbackConfig({
      state: "error",
      message,
      duration: feedbackDuration * 2, // Show errors longer
      variant: feedbackVariant,
    });
  };

  // Hide feedback
  const hideFeedback = () => {
    setFeedbackConfig((prev) => ({ ...prev, state: "idle" }));
  };

  return {
    feedbackConfig,
    showLoading,
    showSuccess,
    showError,
    hideFeedback,
    isActive: feedbackConfig.state !== "idle",
  };
}

/**
 * Sort progress indicator for long-running sorts
 */
interface SortProgressProps {
  isVisible: boolean;
  progress?: number;
  total?: number;
  message?: string;
  className?: string;
}

export function SortProgress({ isVisible, progress = 0, total = 100, message = "Processando...", className }: SortProgressProps) {
  if (!isVisible) return null;

  const percentage = Math.min(100, Math.max(0, (progress / total) * 100));

  return (
    <div className={cn("flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg", className)}>
      <IconLoader2 className="h-4 w-4 animate-spin text-blue-600" />
      <div className="flex-1">
        <p className="text-sm font-medium text-blue-800">{message}</p>
        <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
          <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${percentage}%` }} />
        </div>
        {total > 0 && (
          <p className="text-xs text-blue-600 mt-1">
            {progress} de {total} ({Math.round(percentage)}%)
          </p>
        )}
      </div>
    </div>
  );
}
