import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconX, IconFilter } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import type { ActiveFilter } from "./filter-utils";

interface FilterIndicatorProps {
  filter: ActiveFilter;
  onRemove: () => void;
  className?: string;
}

export function FilterIndicator({ filter, onRemove, className }: FilterIndicatorProps) {
  const getVariant = () => {
    switch (filter.type) {
      case "boolean":
        return "secondary" as const;
      case "date":
        return "outline" as const;
      case "array":
        return "default" as const;
      default:
        return "default" as const;
    }
  };

  return (
    <Badge variant={getVariant()} className={cn("gap-2 pr-1 max-w-xs", className)}>
      <span className="truncate">
        <span className="font-medium">{filter.label}:</span> {filter.value}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      >
        <IconX className="h-3 w-3" />
      </Button>
    </Badge>
  );
}

interface FilterIndicatorsProps {
  filters: ActiveFilter[];
  onClearFilter: (filterKey: string) => void;
  onClearAll: () => void;
  className?: string;
}

export function FilterIndicators({ filters, onClearFilter, onClearAll, className }: FilterIndicatorsProps) {
  if (filters.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      <div className="flex items-center gap-1 text-muted-foreground">
        <IconFilter className="h-4 w-4" />
        <span className="text-sm font-medium">Filtros ativos:</span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {filters.map((filter) => (
          <FilterIndicator key={filter.key} filter={filter} onRemove={() => onClearFilter(filter.key)} />
        ))}
      </div>
      {filters.length > 1 && (
        <Button variant="ghost" size="sm" onClick={onClearAll} className="text-muted-foreground hover:text-destructive h-6 px-2">
          Limpar todos
        </Button>
      )}
    </div>
  );
}
