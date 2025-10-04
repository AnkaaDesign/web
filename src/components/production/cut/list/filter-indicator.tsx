import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconX } from "@tabler/icons-react";
import { CUT_STATUS_LABELS, CUT_STATUS } from "../../../../constants";

interface FilterIndicatorProps {
  hasFilters: boolean;
  onClear: () => void;
  searchingFor?: string;
  status?: CUT_STATUS;
  onRemoveFilter: (key: string) => void;
}

export function FilterIndicator({ hasFilters, onClear, searchingFor, status, onRemoveFilter }: FilterIndicatorProps) {
  if (!hasFilters) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-muted-foreground">Filtros ativos:</span>

      {searchingFor && (
        <Badge variant="secondary" className="gap-1">
          Busca: {searchingFor}
          <button onClick={() => onRemoveFilter("searchingFor")} className="ml-1 hover:text-destructive">
            <IconX className="h-3 w-3" />
          </button>
        </Badge>
      )}

      {status && (
        <Badge variant="secondary" className="gap-1">
          Status: {CUT_STATUS_LABELS[status]}
          <button onClick={() => onRemoveFilter("status")} className="ml-1 hover:text-destructive">
            <IconX className="h-3 w-3" />
          </button>
        </Badge>
      )}

      <Button variant="ghost" size="sm" onClick={onClear} className="h-6 px-2">
        Limpar todos
      </Button>
    </div>
  );
}
