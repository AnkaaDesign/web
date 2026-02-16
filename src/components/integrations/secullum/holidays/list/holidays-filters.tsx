import { useState, useEffect } from "react";
import { IconFilter, IconX } from "@tabler/icons-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";

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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filtrar Feriados
          </SheetTitle>
          <SheetDescription>
            Filtre os feriados por ano e mês
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="year">Ano</Label>
            <Combobox
              value={year?.toString() || currentYear.toString()}
              onValueChange={(value) => {
                const yearValue = Array.isArray(value) ? value[0] : value;
                setYear(yearValue ? parseInt(yearValue) : currentYear);
              }}
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
              onValueChange={(value) => {
                const monthValue = Array.isArray(value) ? value[0] : value;
                setMonth(monthValue === "all" ? undefined : monthValue ? parseInt(monthValue) : undefined);
              }}
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

          <div className="flex gap-2 mt-6 pt-4 border-t">
            <Button variant="outline" onClick={handleClear} className="flex-1">
              <IconX className="h-4 w-4 mr-2" />
              Limpar Filtros
            </Button>
            <Button onClick={handleApply} className="flex-1">
              Aplicar Filtros
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
