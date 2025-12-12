import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconX, IconTrash } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

/**
 * Single filter indicator badge component
 */
export interface FilterIndicatorProps {
  label: string;
  value: string;
  onRemove: () => void;
  icon?: React.ReactNode;
  className?: string;
}

export function FilterIndicator({ label, value, onRemove, icon, className }: FilterIndicatorProps) {
  return (
    <Badge
      className={cn(
        "inline-flex items-center gap-2 px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
        "bg-neutral-400/20 text-neutral-600 border-neutral-300",
        "hover:bg-red-700 hover:text-white hover:border-red-700",
        "dark:bg-neutral-600 dark:text-neutral-300 dark:border-neutral-600",
        "dark:hover:bg-red-700 dark:hover:text-white dark:hover:border-red-700",
        className,
      )}
      onClick={onRemove}
    >
      {icon && <span className="flex items-center">{icon}</span>}
      <span className="font-medium">{label}:</span>
      <span>{value}</span>
      <IconX className="h-3 w-3 ml-1" />
    </Badge>
  );
}

/**
 * Collection of filter indicators with clear all functionality
 */
export interface FilterIndicatorsProps {
  filters: Array<{
    key: string;
    label: string;
    value: string;
    onRemove: () => void;
    icon?: React.ReactNode;
  }>;
  onClearAll?: () => void;
  className?: string;
}

export function FilterIndicators({ filters, onClearAll, className }: FilterIndicatorsProps) {
  if (filters.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="text-sm text-muted-foreground">Filtros ativos:</span>

      {filters.map((filter) => (
        <FilterIndicator key={filter.key} label={filter.label} value={filter.value} onRemove={filter.onRemove} icon={filter.icon} />
      ))}

      {filters.length > 1 && onClearAll && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className={cn("h-7 px-2 text-xs transition-colors", "text-muted-foreground hover:text-white", "hover:bg-red-700", "dark:hover:text-white dark:hover:bg-red-700")}
        >
          <IconTrash className="h-3 w-3 mr-1" />
          Limpar todos
        </Button>
      )}
    </div>
  );
}
