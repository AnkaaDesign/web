import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconX, IconSearch } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface FilterItem {
  key: string;
  label: string;
  value?: string;
  onRemove: () => void;
  iconType?: string;
}

interface FilterIndicatorsProps {
  filters: FilterItem[];
  onClearAll: () => void;
  className?: string;
}

export function FilterIndicators({ filters, onClearAll, className }: FilterIndicatorsProps) {
  if (filters.length === 0) return null;

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      <span className="text-sm text-muted-foreground">Filtros ativos:</span>
      {filters.map((filter) => (
        <Badge
          key={filter.key}
          variant="secondary"
          className="gap-1 pr-1 cursor-pointer hover:bg-secondary/80"
          onClick={filter.onRemove}
        >
          {filter.iconType === "search" && <IconSearch className="h-3 w-3" />}
          <span className="font-medium">{filter.label}:</span>
          {filter.value && <span>{filter.value}</span>}
          <Button
            variant="ghost"
            size="icon"
            className="h-4 w-4 p-0 hover:bg-transparent"
            onClick={(e) => {
              e.stopPropagation();
              filter.onRemove();
            }}
          >
            <IconX className="h-3 w-3" />
          </Button>
        </Badge>
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={onClearAll}
        className="h-6 px-2 text-xs"
      >
        Limpar todos
      </Button>
    </div>
  );
}