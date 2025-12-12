import { IconLoader2 } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  message?: string;
}

export function LoadingState({ className, size = "md", message = "Carregando registros..." }: LoadingStateProps) {
  const sizeClasses = {
    sm: "h-32",
    md: "h-48",
    lg: "h-96",
  };

  const iconSizes = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  return (
    <div className={cn("flex items-center justify-center", sizeClasses[size], className)}>
      <div className="flex flex-col items-center gap-3">
        <IconLoader2 className={cn("animate-spin text-muted-foreground", iconSizes[size])} />
        <div className="text-center">
          <div className="text-sm text-muted-foreground font-medium">{message}</div>
        </div>
      </div>
    </div>
  );
}
