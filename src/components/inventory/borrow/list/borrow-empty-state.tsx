import { IconPackage, IconSearch, IconPlus } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BorrowEmptyStateProps {
  hasFilters?: boolean;
  onClearFilters?: () => void;
  onCreateNew?: () => void;
  className?: string;
}

export function BorrowEmptyState({ hasFilters = false, onClearFilters, onCreateNew, className }: BorrowEmptyStateProps) {
  const Icon = hasFilters ? IconSearch : IconPackage;
  const title = hasFilters ? "Nenhum empréstimo encontrado" : "Nenhum empréstimo registrado";
  const description = hasFilters ? "Tente ajustar os filtros para ver mais resultados." : "Comece registrando um novo empréstimo de item.";

  return (
    <div className={cn("border border-border rounded-lg p-8 text-center bg-card", className)}>
      <div className="flex justify-center mb-4">
        <Icon className="h-12 w-12 text-muted-foreground" />
      </div>

      <div className="text-lg font-medium mb-2">{title}</div>
      <div className="text-sm text-muted-foreground mb-6">{description}</div>

      <div className="flex gap-2 justify-center">
        {hasFilters && onClearFilters && (
          <Button variant="outline" onClick={onClearFilters}>
            Limpar filtros
          </Button>
        )}

        {onCreateNew && (
          <Button onClick={onCreateNew} className="gap-2">
            <IconPlus className="h-4 w-4" />
            Novo Empréstimo
          </Button>
        )}
      </div>
    </div>
  );
}
