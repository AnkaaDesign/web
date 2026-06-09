import { IconFilter } from "@tabler/icons-react";
import { FilterDrawer } from "@/components/common/filters/ui/FilterDrawer";
import { Label } from "@/components/ui/label";

interface CalculationFilters {
  userId?: string;
  selectedMonth?: Date;
  searchingFor?: string;
}

interface CalculationFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: CalculationFilters;
  onFilterChange: (filters: Partial<CalculationFilters>) => void;
}

export function CalculationFilters({
  open,
  onOpenChange,
  filters: _filters,
  onFilterChange,
}: CalculationFiltersProps) {
  const handleClearAll = () => {
    onFilterChange({
      selectedMonth: new Date(), // Reset to current month
    });
  };

  return (
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Filtros de Cálculos"
      titleIcon={<IconFilter className="h-5 w-5" />}
      description="Configure os filtros para visualizar os cálculos desejados"
      onApply={() => onOpenChange(false)}
      onReset={handleClearAll}
      applyLabel="Fechar"
      resetLabel="Limpar Filtros"
    >
      <div className="space-y-2">
        <Label className="text-sm font-medium">Informação</Label>
        <p className="text-sm text-muted-foreground">
          Use o seletor de mês e funcionário na parte superior para filtrar os cálculos.
          Os dados são agrupados por período de folha de pagamento (25º do mês anterior ao 25º do mês selecionado).
        </p>
      </div>
    </FilterDrawer>
  );
}