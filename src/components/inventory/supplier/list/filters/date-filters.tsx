import { Separator } from "@/components/ui/separator";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { IconCalendarPlus, IconCalendarStats } from "@tabler/icons-react";
import type { DateRange } from "react-day-picker";

interface DateFiltersProps {
  createdAtRange?: { gte?: Date; lte?: Date };
  onCreatedAtRangeChange: (range?: { gte?: Date; lte?: Date }) => void;
  updatedAtRange?: { gte?: Date; lte?: Date };
  onUpdatedAtRangeChange: (range?: { gte?: Date; lte?: Date }) => void;
}

export function DateFilters({ createdAtRange, onCreatedAtRangeChange, updatedAtRange, onUpdatedAtRangeChange }: DateFiltersProps) {
  const handleCreatedAtChange = (dateRange: DateRange | null) => {
    if (!dateRange || (!dateRange.from && !dateRange.to)) {
      onCreatedAtRangeChange(undefined);
    } else {
      onCreatedAtRangeChange({
        ...(dateRange.from && { gte: dateRange.from }),
        ...(dateRange.to && { lte: dateRange.to }),
      });
    }
  };

  const handleUpdatedAtChange = (dateRange: DateRange | null) => {
    if (!dateRange || (!dateRange.from && !dateRange.to)) {
      onUpdatedAtRangeChange(undefined);
    } else {
      onUpdatedAtRangeChange({
        ...(dateRange.from && { gte: dateRange.from }),
        ...(dateRange.to && { lte: dateRange.to }),
      });
    }
  };

  const currentCreatedAtRange: DateRange = {
    from: createdAtRange?.gte,
    to: createdAtRange?.lte,
  };

  const currentUpdatedAtRange: DateRange = {
    from: updatedAtRange?.gte,
    to: updatedAtRange?.lte,
  };

  return (
    <div className="space-y-4">
      {/* Created At Range */}
      <DateTimeInput
        mode="date-range"
        value={currentCreatedAtRange}
        onChange={handleCreatedAtChange}
        label={
          <div className="flex items-center gap-2">
            <IconCalendarPlus className="h-4 w-4" />
            Data de Cadastro
          </div>
        }
        placeholder="Selecionar período..."
        description="Filtra por período de cadastro do fornecedor"
        numberOfMonths={2}
      />

      <Separator />

      {/* Updated At Range */}
      <DateTimeInput
        mode="date-range"
        value={currentUpdatedAtRange}
        onChange={handleUpdatedAtChange}
        label={
          <div className="flex items-center gap-2">
            <IconCalendarStats className="h-4 w-4" />
            Data de Atualização
          </div>
        }
        placeholder="Selecionar período..."
        description="Filtra por período de atualização do fornecedor"
        numberOfMonths={2}
      />
    </div>
  );
}
