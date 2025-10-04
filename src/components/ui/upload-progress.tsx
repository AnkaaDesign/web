import * as React from "react";
import { cn } from "@/lib/utils";
import { IconCheck, IconX, IconAlertTriangle, IconLoader2 } from "@tabler/icons-react";

export interface UploadProgressProps {
  className?: string;
  value?: number;
  status?: "idle" | "uploading" | "processing" | "completed" | "error" | "cancelled";
  showPercentage?: boolean;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
  animated?: boolean;
  message?: string;
}

const statusConfig = {
  idle: {
    color: "bg-muted",
    indicatorColor: "bg-muted-foreground/20",
    icon: null,
    textColor: "text-muted-foreground",
  },
  uploading: {
    color: "bg-blue-50 dark:bg-blue-950/20",
    indicatorColor: "bg-blue-500 dark:bg-blue-400",
    icon: IconLoader2,
    textColor: "text-blue-600 dark:text-blue-400",
  },
  processing: {
    color: "bg-amber-50 dark:bg-amber-950/20",
    indicatorColor: "bg-amber-500 dark:bg-amber-400",
    icon: IconLoader2,
    textColor: "text-amber-600 dark:text-amber-400",
  },
  completed: {
    color: "bg-green-50 dark:bg-green-950/20",
    indicatorColor: "bg-green-500 dark:bg-green-400",
    icon: IconCheck,
    textColor: "text-green-600 dark:text-green-400",
  },
  error: {
    color: "bg-red-50 dark:bg-red-950/20",
    indicatorColor: "bg-red-500 dark:bg-red-400",
    icon: IconX,
    textColor: "text-red-600 dark:text-red-400",
  },
  cancelled: {
    color: "bg-gray-50 dark:bg-gray-950/20",
    indicatorColor: "bg-gray-400 dark:bg-gray-600",
    icon: IconAlertTriangle,
    textColor: "text-gray-600 dark:text-gray-400",
  },
};

const sizeConfig = {
  sm: {
    height: "h-2",
    iconSize: "w-3 h-3",
    textSize: "text-xs",
    padding: "px-2 py-1",
  },
  md: {
    height: "h-3",
    iconSize: "w-4 h-4",
    textSize: "text-sm",
    padding: "px-3 py-2",
  },
  lg: {
    height: "h-4",
    iconSize: "w-5 h-5",
    textSize: "text-base",
    padding: "px-4 py-3",
  },
};

export const UploadProgress = React.forwardRef<HTMLDivElement, UploadProgressProps>(
  ({ className, value = 0, status = "idle", showPercentage = false, showIcon = false, size = "md", animated = true, message }, ref) => {
    const config = statusConfig[status];
    const sizeConf = sizeConfig[size];
    const IconComponent = config.icon;
    const isAnimated = status === "uploading" || status === "processing";

    return (
      <div className={cn("w-full space-y-1", className)}>
        {/* Progress bar container */}
        <div className="relative">
          <div
            ref={ref}
            className={cn("relative w-full overflow-hidden rounded-full transition-colors duration-300", sizeConf.height, config.color)}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={value}
          >
            <div
              className={cn("h-full w-full flex-1 transition-all duration-500 ease-out", config.indicatorColor, animated && isAnimated && "transition-transform duration-300")}
              style={{
                transform: `translateX(-${100 - Math.max(0, Math.min(100, value))}%)`,
                ...(isAnimated && {
                  background: `linear-gradient(90deg, 
                  ${
                    config.indicatorColor.includes("blue")
                      ? "#3b82f6"
                      : config.indicatorColor.includes("amber")
                        ? "#f59e0b"
                        : config.indicatorColor.includes("green")
                          ? "#10b981"
                          : config.indicatorColor.includes("red")
                            ? "#ef4444"
                            : "#6b7280"
                  } 0%, 
                  ${
                    config.indicatorColor.includes("blue")
                      ? "#1d4ed8"
                      : config.indicatorColor.includes("amber")
                        ? "#d97706"
                        : config.indicatorColor.includes("green")
                          ? "#059669"
                          : config.indicatorColor.includes("red")
                            ? "#dc2626"
                            : "#4b5563"
                  } 100%)`,
                  backgroundSize: isAnimated ? "200% 100%" : "100% 100%",
                  animation: isAnimated ? "shimmer 2s ease-in-out infinite" : "none",
                }),
              }}
            />

            {/* Animated shimmer effect for active states */}
            {isAnimated && (
              <div className="absolute inset-0 overflow-hidden rounded-full">
                <div className={cn("absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent", "animate-shimmer-progress")} />
              </div>
            )}
          </div>
        </div>

        {/* Status information */}
        {(showPercentage || showIcon || message) && (
          <div
            className={cn(
              "flex items-center justify-between gap-2",
              sizeConf.padding.split(" ")[0], // Only horizontal padding
            )}
          >
            {/* Left side - Icon and message */}
            <div className="flex items-center gap-2 min-w-0">
              {showIcon && IconComponent && <IconComponent className={cn(sizeConf.iconSize, config.textColor, isAnimated && "animate-spin")} />}
              {message && <span className={cn(sizeConf.textSize, config.textColor, "font-medium truncate")}>{message}</span>}
            </div>

            {/* Right side - Percentage */}
            {showPercentage && <span className={cn(sizeConf.textSize, config.textColor, "font-mono font-semibold tabular-nums")}>{Math.round(value)}%</span>}
          </div>
        )}
      </div>
    );
  },
);

UploadProgress.displayName = "UploadProgress";

// Integrated progress overlay component for upload cards
export interface CardProgressOverlayProps {
  progress: number;
  status: UploadProgressProps["status"];
  className?: string;
  showPercentage?: boolean;
  message?: string;
}

export const CardProgressOverlay = React.forwardRef<HTMLDivElement, CardProgressOverlayProps>(({ progress, status = "idle", className, showPercentage = true, message }, ref) => {
  const isVisible = status !== "idle";

  if (!isVisible) return null;

  return (
    <div
      ref={ref}
      className={cn(
        "absolute inset-0 bg-background/90 backdrop-blur-sm",
        "flex flex-col items-center justify-center gap-2",
        "rounded-lg border transition-opacity duration-300",
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none",
        className,
      )}
    >
      <div className="w-full max-w-[80%]">
        <UploadProgress value={progress} status={status} showPercentage={showPercentage} showIcon={true} size="sm" message={message} className="w-full" />
      </div>
    </div>
  );
});

CardProgressOverlay.displayName = "CardProgressOverlay";

export { UploadProgress as Progress };
