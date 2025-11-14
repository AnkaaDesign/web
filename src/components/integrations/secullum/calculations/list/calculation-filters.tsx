import React from "react";
import { IconFilter, IconX } from "@tabler/icons-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
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
  filters,
  onFilterChange,
}: CalculationFiltersProps) {
  const handleClearAll = () => {
    onFilterChange({
      selectedMonth: new Date(), // Reset to current month
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filtros de Cálculos
          </SheetTitle>
          <SheetDescription>
            Configure os filtros para visualizar os cálculos desejados
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Informação</Label>
            <p className="text-sm text-muted-foreground">
              Use o seletor de mês e funcionário na parte superior para filtrar os cálculos.
              Os dados são agrupados por período de folha de pagamento (25º do mês anterior ao 25º do mês selecionado).
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mt-6 pt-4 border-t">
            <Button variant="outline" onClick={handleClearAll} className="flex-1">
              <IconX className="h-4 w-4 mr-2" />
              Limpar Filtros
            </Button>
            <Button onClick={() => onOpenChange(false)} className="flex-1">
              Fechar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}