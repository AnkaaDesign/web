import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Filtros de Cálculos</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Informação</Label>
            <p className="text-sm text-muted-foreground mt-1">
              Use o seletor de mês e funcionário na parte superior para filtrar os cálculos.
              Os dados são agrupados por período de folha de pagamento (25º do mês anterior ao 25º do mês selecionado).
            </p>
          </div>

          <Separator />

          <div className="flex justify-between">
            <Button variant="outline" onClick={handleClearAll}>
              Limpar Filtros
            </Button>
            <Button onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}