import { Button } from "@/components/ui/button";
import { IconX, IconFilter } from "@tabler/icons-react";
import { FilterChip } from "./FilterChip";
import { cn } from "@/lib/utils";

export interface FilterItem {
  id: string;
  label: string;
  value?: string;
  icon?: React.ReactNode;
  onRemove: () => void;
}

export interface FilterSummaryProps {
  filters: FilterItem[];
  onClearAll?: () => void;
  className?: string;
  maxVisible?: number;
  emptyMessage?: string;
}

export function FilterSummary({
  filters,
  onClearAll,
  className,
  maxVisible,
  emptyMessage = "Nenhum filtro aplicado",
}: FilterSummaryProps) {
  if (filters.length === 0) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <IconFilter className="h-4 w-4" />
        <span>{emptyMessage}</span>
      </div>
    );
  }

  const visibleFilters = maxVisible ? filters.slice(0, maxVisible) : filters;
  const hiddenCount = maxVisible && filters.length > maxVisible ? filters.length - maxVisible : 0;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <IconFilter className="h-4 w-4" />
        <span className="font-medium">Filtros ativos:</span>
      </div>

      {visibleFilters.map((filter) => (
        <FilterChip
          key={filter.id}
          label={filter.label}
          value={filter.value}
          icon={filter.icon}
          onRemove={filter.onRemove}
        />
      ))}

      {hiddenCount > 0 && (
        <span className="text-sm text-muted-foreground">
          +{hiddenCount} mais
        </span>
      )}

      {onClearAll && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="h-auto py-1 px-2 text-xs"
        >
          <IconX className="mr-1 h-3 w-3" />
          Limpar todos
        </Button>
      )}
    </div>
  );
}
