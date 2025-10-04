import React from "react";
import { cn } from "@/lib/utils";

// Loading Spinner Component
interface LoadingSpinnerProps {
  size?: "sm" | "default" | "lg";
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = "default", className }) => {
  const sizeClasses = {
    sm: "h-4 w-4",
    default: "h-6 w-6",
    lg: "h-8 w-8",
  };

  return (
    <div className={cn("inline-flex items-center justify-center", className)} role="progressbar" aria-label="Loading">
      <div className={cn("animate-spin", sizeClasses[size])}>
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/20" />
          <path d="M12 2a10 10 0 0 1 0 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-primary" />
        </svg>
      </div>
    </div>
  );
};

// Loading Overlay Component
interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
  className?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isVisible, message = "Carregando...", className }) => {
  if (!isVisible) return null;

  return (
    <div className={cn("fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm", className)} role="progressbar" aria-label={message}>
      <div className="flex flex-col items-center gap-3 p-6 rounded-lg shadow-lg bg-card border">
        <LoadingSpinner size="lg" />
        <p className="text-sm font-medium text-center text-muted-foreground">{message}</p>
      </div>
    </div>
  );
};

// Loading Dots Component
interface LoadingDotsProps {
  size?: "sm" | "default" | "lg";
  className?: string;
}

export const LoadingDots: React.FC<LoadingDotsProps> = ({ size = "default", className }) => {
  const sizeClasses = {
    sm: "h-1 w-1",
    default: "h-2 w-2",
    lg: "h-3 w-3",
  };

  const gapClasses = {
    sm: "gap-1",
    default: "gap-2",
    lg: "gap-3",
  };

  return (
    <div className={cn("inline-flex items-center", gapClasses[size], className)} role="progressbar" aria-label="Loading">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className={cn("rounded-full bg-primary animate-pulse", sizeClasses[size])}
          style={{
            animationDelay: `${index * 200}ms`,
          }}
        />
      ))}
    </div>
  );
};

// Skeleton Component
interface SkeletonProps {
  className?: string;
  children?: React.ReactNode;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className, children }) => {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", "motion-reduce:animate-none", className)}
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="Carregando conteúdo"
    >
      {children}
    </div>
  );
};

// Common skeleton patterns
interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export const SkeletonText: React.FC<SkeletonTextProps> = ({ lines = 1, className }) => {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-4", i === lines - 1 && lines > 1 ? "w-3/4" : "w-full")} />
      ))}
    </div>
  );
};

interface SkeletonCardProps {
  className?: string;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({ className }) => {
  return (
    <div className={cn("p-6 space-y-4 rounded-lg bg-card border", className)}>
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <SkeletonText lines={3} />
    </div>
  );
};

interface SkeletonAvatarProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const SkeletonAvatar: React.FC<SkeletonAvatarProps> = ({ size = "md", className }) => {
  const sizeMap = {
    sm: "h-8 w-8",
    md: "h-12 w-12",
    lg: "h-16 w-16",
  };

  return <Skeleton className={cn("rounded-full", sizeMap[size], className)} />;
};

// Progress Component
interface ProgressProps {
  value: number;
  max?: number;
  showValue?: boolean;
  className?: string;
}

export const Progress: React.FC<ProgressProps> = ({ value, max = 100, showValue = false, className }) => {
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div className={cn("w-full", className)}>
      {showValue && (
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm text-muted-foreground">{Math.round(percentage)}%</span>
        </div>
      )}
      <div className="w-full h-2 rounded overflow-hidden bg-secondary">
        <div
          className="h-full rounded transition-all duration-300 ease-out bg-primary"
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>
    </div>
  );
};

// Pulse Animation for loading states
interface PulseViewProps {
  children: React.ReactNode;
  isLoading?: boolean;
  className?: string;
}

export const PulseView: React.FC<PulseViewProps> = ({ children, isLoading = false, className }) => {
  return <div className={cn(isLoading && "animate-pulse", className)}>{children}</div>;
};
