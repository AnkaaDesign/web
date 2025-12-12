import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { IconAlertTriangle, IconRefresh } from "@tabler/icons-react";
import React from "react";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
  icon?: React.ReactNode;
}

export function ErrorState({
  title = "Erro ao carregar dados",
  description = "Ocorreu um erro ao buscar as informações. Tente novamente.",
  onRetry,
  className,
  icon = <IconAlertTriangle className="h-8 w-8" />,
}: ErrorStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 px-4 text-center", className)}>
      <div className="mb-4 text-destructive">{icon}</div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="mt-2 text-sm text-muted-foreground max-w-md">{description}</p>}
      {onRetry && (
        <Button onClick={onRetry} variant="outline" className="mt-6">
          <IconRefresh className="h-4 w-4 mr-2" />
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
