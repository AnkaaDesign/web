import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";

interface HolidaysFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (filters: { year?: number; month?: number }) => void;
  currentYear: number;
  selectedYear?: number;
  selectedMonth?: number;
}

export function HolidaysFilters({ open, onOpenChange, onApply, currentYear, selectedYear = currentYear, selectedMonth }: HolidaysFiltersProps) {
  const [year, setYear] = useState<number | undefined>(selectedYear);
  const [month, setMonth] = useState<number | undefined>(selectedMonth);

  // Update local state when props change (when modal opens)
  useEffect(() => {
    if (open) {
      setYear(selectedYear || currentYear);
      setMonth(selectedMonth);
    }
  }, [open, selectedYear, selectedMonth, currentYear]);

  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  const handleApply = () => {
    onApply({
      year: year || currentYear,
      month,
    });
  };

  const handleClear = () => {
    setYear(currentYear);
    setMonth(undefined);
    onApply({
      year: currentYear,
    });
  };

  // Generate year options (current year - 2 to current year + 2)
  const yearOptions = [];
  for (let y = currentYear - 2; y <= currentYear + 2; y++) {
    yearOptions.push(y);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Filtrar Feriados</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="year">Ano</Label>
            <Combobox
              value={year?.toString() || currentYear.toString()}
              onValueChange={(value) => setYear(value ? parseInt(value) : currentYear)}
              options={yearOptions.map((y) => ({
                value: y.toString(),
                label: y.toString(),
              }))}
              placeholder="Selecione o ano"
              searchable={false}
              clearable={false}
              name="year"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="month">Mês</Label>
            <Combobox
              value={month?.toString() || "all"}
              onValueChange={(value) => setMonth(value === "all" ? undefined : value ? parseInt(value) : undefined)}
              options={[
                { value: "all", label: "Todos os meses" },
                ...monthNames.map((name, index) => ({
                  value: (index + 1).toString(),
                  label: name,
                })),
              ]}
              placeholder="Todos os meses"
              searchable={false}
              clearable={false}
              name="month"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClear}>
            Limpar
          </Button>
          <Button onClick={handleApply}>Aplicar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
