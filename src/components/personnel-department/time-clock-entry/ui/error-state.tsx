import { IconAlertCircle, IconRefresh } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  showRetryButton?: boolean;
}

export function ErrorState({
  className,
  size = "md",
  title = "Erro ao carregar dados",
  description = "Ocorreu um erro ao buscar os registros. Verifique sua conexão e tente novamente.",
  onRetry,
  retryLabel = "Tentar novamente",
  showRetryButton = true,
}: ErrorStateProps) {
  const sizeClasses = {
    sm: "h-32",
    md: "h-48",
    lg: "h-96",
  };

  const iconSizes = {
    sm: "h-8 w-8",
    md: "h-12 w-12",
    lg: "h-16 w-16",
  };

  const textSizes = {
    sm: { title: "text-sm", description: "text-xs" },
    md: { title: "text-lg", description: "text-sm" },
    lg: { title: "text-xl", description: "text-base" },
  };

  const buttonSizes = {
    sm: "sm" as const,
    md: "default" as const,
    lg: "lg" as const,
  };

  return (
    <div className={cn("flex items-center justify-center", sizeClasses[size], className)}>
      <div className="flex flex-col items-center gap-4 text-center max-w-md">
        <div className="rounded-full bg-destructive/10 p-3">
          <IconAlertCircle className={cn("text-destructive", iconSizes[size])} />
        </div>
        <div className="space-y-2">
          <div className={cn("font-medium text-foreground", textSizes[size].title)}>{title}</div>
          <div className={cn("text-muted-foreground", textSizes[size].description)}>{description}</div>
        </div>
        {showRetryButton && onRetry && (
          <Button onClick={onRetry} variant="outline" size={buttonSizes[size]} className="gap-2">
            <IconRefresh className="h-4 w-4" />
            {retryLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
