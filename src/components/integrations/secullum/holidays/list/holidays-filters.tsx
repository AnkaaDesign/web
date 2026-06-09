import { useState, useEffect } from "react";
import { IconFilter } from "@tabler/icons-react";
import { FilterDrawer } from "@/components/common/filters/ui/FilterDrawer";
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
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Filtrar Feriados"
      titleIcon={<IconFilter className="h-5 w-5" />}
      description="Filtre os feriados por ano e mês"
      onApply={handleApply}
      onReset={handleClear}
      applyLabel="Aplicar Filtros"
      resetLabel="Limpar Filtros"
    >
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
    </FilterDrawer>
  );
}
