import { IconCalendarOff, IconClock, IconFileX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  title?: string;
  description?: string;
  icon?: "calendar" | "clock" | "file";
}

export function EmptyState({
  className,
  size = "md",
  title = "Nenhum registro encontrado",
  description = "Tente ajustar os filtros ou selecionar um período diferente",
  icon = "calendar",
}: EmptyStateProps) {
  const sizeClasses = {
    sm: "h-32",
    md: "h-48",
    lg: "h-96",
  };

  const iconSizes = {
    sm: "h-12 w-12",
    md: "h-16 w-16",
    lg: "h-24 w-24",
  };

  const textSizes = {
    sm: { title: "text-sm", description: "text-xs" },
    md: { title: "text-lg", description: "text-sm" },
    lg: { title: "text-xl", description: "text-base" },
  };

  const IconComponent = {
    calendar: IconCalendarOff,
    clock: IconClock,
    file: IconFileX,
  }[icon];

  return (
    <div className={cn("flex items-center justify-center", sizeClasses[size], className)}>
      <div className="flex flex-col items-center gap-4 text-center max-w-md">
        <div className="rounded-full bg-muted/50 p-4">
          <IconComponent className={cn("text-muted-foreground/70", iconSizes[size])} />
        </div>
        <div className="space-y-2">
          <div className={cn("font-medium text-foreground", textSizes[size].title)}>{title}</div>
          <div className={cn("text-muted-foreground", textSizes[size].description)}>{description}</div>
        </div>
      </div>
    </div>
  );
}
