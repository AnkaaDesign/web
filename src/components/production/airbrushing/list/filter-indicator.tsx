import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconX, IconFilterX } from "@tabler/icons-react";
import type { ActiveFilter } from "./filter-utils";

interface FilterIndicatorsProps {
  filters: ActiveFilter[];
  onClearFilter: (filterKey: string) => void;
  onClearAll: () => void;
}

export function FilterIndicators({ filters, onClearFilter, onClearAll }: FilterIndicatorsProps) {
  if (filters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Filtros ativos:</span>

      {filters.map((filter) => (
        <Badge key={filter.key} variant="secondary" className="flex items-center gap-1 pr-1">
          <span className="font-medium">{filter.label}:</span>
          <span className="max-w-[200px] truncate">{filter.value}</span>
          <Button variant="ghost" size="sm" className="h-auto p-0.5 hover:bg-transparent" onClick={() => onClearFilter(filter.key)}>
            <IconX className="h-3 w-3" />
          </Button>
        </Badge>
      ))}

      <Button variant="ghost" size="sm" onClick={onClearAll} className="h-6 px-2 text-xs hover:bg-destructive/10 hover:text-destructive">
        <IconFilterX className="h-3 w-3 mr-1" />
        Limpar todos
      </Button>
    </div>
  );
}
