import React from "react";
import { IconLoader2, IconAlertTriangle, IconRefresh, IconWifi, IconWifiOff } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface LoadingStateProps {
  className?: string;
  size?: "sm" | "default" | "lg";
}

export interface ErrorStateProps extends LoadingStateProps {
  error: Error | any;
  onRetry?: () => void;
  retryLabel?: string;
}

export interface EmptyStateProps extends LoadingStateProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

// Loading states for different scenarios
export function PaginationInitialLoading({ className, size = "default" }: LoadingStateProps) {
  const sizeStyles = {
    sm: "py-4",
    default: "py-8",
    lg: "py-12",
  };

  return (
    <div className={cn("flex items-center justify-center", sizeStyles[size], className)}>
      <div className="flex items-center gap-3">
        <IconLoader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-muted-foreground">Carregando dados...</span>
      </div>
    </div>
  );
}

export function PaginationPageLoading({ className, size = "default" }: LoadingStateProps) {
  const sizeStyles = {
    sm: "py-2",
    default: "py-4",
    lg: "py-6",
  };

  return (
    <div className={cn("flex items-center justify-center", sizeStyles[size], className)}>
      <div className="flex items-center gap-2">
        <IconLoader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Carregando página...</span>
      </div>
    </div>
  );
}

export function PaginationRefreshing({ className }: LoadingStateProps) {
  return (
    <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
      <IconRefresh className="h-3 w-3 animate-spin" />
      <span>Atualizando...</span>
    </div>
  );
}

// Error states
export function PaginationError({ error, onRetry, retryLabel = "Tentar novamente", className, size = "default" }: ErrorStateProps) {
  const sizeStyles = {
    sm: "py-4",
    default: "py-8",
    lg: "py-12",
  };

  const isNetworkError = error?.message?.includes("network") || error?.name === "NetworkError" || error?.code === "NETWORK_ERROR";

  return (
    <div className={cn("flex flex-col items-center justify-center gap-4", sizeStyles[size], className)}>
      <div className="flex items-center gap-2 text-destructive">
        {isNetworkError ? <IconWifiOff className="h-5 w-5" /> : <IconAlertTriangle className="h-5 w-5" />}
        <span className="font-medium">{isNetworkError ? "Erro de conexão" : "Erro ao carregar dados"}</span>
      </div>

      <p className="text-sm text-muted-foreground text-center max-w-md">
        {isNetworkError ? "Verifique sua conexão com a internet e tente novamente." : error?.message || "Ocorreu um erro inesperado. Tente novamente."}
      </p>

      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
          <IconRefresh className="h-4 w-4" />
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

export function PaginationNetworkError({ onRetry, className, size = "default" }: ErrorStateProps) {
  return <PaginationError error={{ name: "NetworkError", message: "Falha na conexão" }} onRetry={onRetry} className={className} size={size} />;
}

// Empty states
export function PaginationEmpty({
  title = "Nenhum resultado encontrado",
  description = "Tente ajustar os filtros ou criar um novo item.",
  action,
  className,
  size = "default",
}: EmptyStateProps) {
  const sizeStyles = {
    sm: "py-4",
    default: "py-8",
    lg: "py-12",
  };

  return (
    <div className={cn("flex flex-col items-center justify-center gap-4", sizeStyles[size], className)}>
      <div className="text-center">
        <h3 className="font-medium text-muted-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function PaginationEmptyFiltered({ onClearFilters, className, size = "default" }: EmptyStateProps & { onClearFilters?: () => void }) {
  return (
    <PaginationEmpty
      title="Nenhum resultado encontrado"
      description="Nenhum item corresponde aos filtros aplicados."
      action={
        onClearFilters && (
          <Button variant="outline" size="sm" onClick={onClearFilters}>
            Limpar filtros
          </Button>
        )
      }
      className={className}
      size={size}
    />
  );
}

// Out of bounds state
export function PaginationOutOfBounds({
  currentPage,
  totalPages,
  onGoToLastPage,
  className,
  size = "default",
}: EmptyStateProps & {
  currentPage: number;
  totalPages: number;
  onGoToLastPage?: () => void;
}) {
  const sizeStyles = {
    sm: "py-4",
    default: "py-8",
    lg: "py-12",
  };

  return (
    <div className={cn("flex flex-col items-center justify-center gap-4", sizeStyles[size], className)}>
      <div className="flex items-center gap-2 text-warning">
        <IconAlertTriangle className="h-5 w-5" />
        <span className="font-medium">Página não encontrada</span>
      </div>

      <p className="text-sm text-muted-foreground text-center">
        A página {currentPage} não existe. O total de páginas é {totalPages}.
      </p>

      {onGoToLastPage && (
        <Button variant="outline" size="sm" onClick={onGoToLastPage}>
          Ir para a última página
        </Button>
      )}
    </div>
  );
}

// Skeleton loading for table rows
export function PaginationTableSkeleton({ rows = 5, columns = 4, className }: { rows?: number; columns?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div key={colIndex} className={cn("h-4 bg-muted animate-pulse rounded", colIndex === 0 ? "w-8" : "flex-1")} />
          ))}
        </div>
      ))}
    </div>
  );
}

// Network status indicator
export function NetworkStatusIndicator({ isOnline = true, className }: { isOnline?: boolean; className?: string }) {
  if (isOnline) return null;

  return (
    <div className={cn("flex items-center gap-2 px-3 py-2 bg-destructive/10 text-destructive text-sm rounded-md", className)}>
      <IconWifiOff className="h-4 w-4" />
      <span>Sem conexão com a internet</span>
    </div>
  );
}

// Progress indicator for long operations
export function PaginationProgress({
  progress,
  label,
  className,
}: {
  progress: number; // 0-100
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <IconLoader2 className="h-4 w-4 animate-spin" />
          <span>{label}</span>
        </div>
      )}
      <div className="w-full bg-muted rounded-full h-2">
        <div className="bg-primary h-2 rounded-full transition-all duration-300 ease-out" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
      </div>
      <div className="text-xs text-muted-foreground text-right">{Math.round(progress)}%</div>
    </div>
  );
}

// Comprehensive state renderer
export interface PaginationStateProps {
  state: "loading" | "error" | "empty" | "success" | "out-of-bounds";
  data?: any[];
  error?: any;
  totalRecords?: number;
  currentPage?: number;
  totalPages?: number;
  hasFilters?: boolean;
  onRetry?: () => void;
  onClearFilters?: () => void;
  onGoToLastPage?: () => void;
  className?: string;
  size?: "sm" | "default" | "lg";
}

export function PaginationStateRenderer({
  state,
  data = [],
  error,
  totalRecords = 0,
  currentPage = 1,
  totalPages = 1,
  hasFilters = false,
  onRetry,
  onClearFilters,
  onGoToLastPage,
  className,
  size = "default",
}: PaginationStateProps) {
  switch (state) {
    case "loading":
      return data.length === 0 ? <PaginationInitialLoading className={className} size={size} /> : <PaginationPageLoading className={className} size={size} />;

    case "error":
      return <PaginationError error={error} onRetry={onRetry} className={className} size={size} />;

    case "empty":
      return hasFilters ? <PaginationEmptyFiltered onClearFilters={onClearFilters} className={className} size={size} /> : <PaginationEmpty className={className} size={size} />;

    case "out-of-bounds":
      return <PaginationOutOfBounds currentPage={currentPage} totalPages={totalPages} onGoToLastPage={onGoToLastPage} className={className} size={size} />;

    case "success":
    default:
      return null; // Render the actual content
  }
}
