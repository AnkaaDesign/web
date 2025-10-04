import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconX, IconFilterX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import type { FilterIndicator } from "./filter-utils";

interface FilterIndicatorsProps {
  filters: FilterIndicator[];
  onClearAll: () => void;
  className?: string;
}

export function FilterIndicators({ filters, onClearAll, className }: FilterIndicatorsProps) {
  if (filters.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="flex flex-wrap items-center gap-1">
        {filters.map((filter) => (
          <Badge
            key={filter.key}
            variant="muted"
            className="flex items-center gap-1.5 px-2.5 py-1 cursor-pointer hover:bg-red-700 hover:text-white transition-all duration-200"
            onClick={filter.onRemove}
          >
            <span className="text-xs flex items-center gap-1">
              <span className="font-medium">{filter.label}:</span>
              <span className="font-normal">{Array.isArray(filter.value) ? filter.value.join(", ") : String(filter.value)}</span>
            </span>
            <IconX className="h-3 w-3 ml-0.5 text-muted-foreground" />
          </Badge>
        ))}
      </div>

      {filters.length > 1 && (
        <Button variant="ghost" size="sm" onClick={onClearAll} className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
          <IconFilterX className="h-3 w-3 mr-1" />
          Limpar todos ({filters.length})
        </Button>
      )}
    </div>
  );
}
