import { Separator } from "@/components/ui/separator";
import { DateTimeInput } from "@/components/ui/date-time-input";
import type { DateRange } from "react-day-picker";

interface MaintenanceDateFiltersProps {
  nextRunRange?: { gte?: Date; lte?: Date };
  onNextRunRangeChange: (range: { gte?: Date; lte?: Date } | undefined) => void;
  createdAtRange?: { gte?: Date; lte?: Date };
  onCreatedAtRangeChange: (range: { gte?: Date; lte?: Date } | undefined) => void;
  updatedAtRange?: { gte?: Date; lte?: Date };
  onUpdatedAtRangeChange: (range: { gte?: Date; lte?: Date } | undefined) => void;
}

export function MaintenanceDateFilters({
  nextRunRange,
  onNextRunRangeChange,
  createdAtRange,
  onCreatedAtRangeChange,
  updatedAtRange,
  onUpdatedAtRangeChange,
}: MaintenanceDateFiltersProps) {
  const handleNextRunRangeChange = (dateRange: DateRange | null) => {
    if (!dateRange || (!dateRange.from && !dateRange.to)) {
      onNextRunRangeChange(undefined);
    } else {
      onNextRunRangeChange({
        ...(dateRange.from && { gte: dateRange.from }),
        ...(dateRange.to && { lte: dateRange.to }),
      });
    }
  };

  const handleCreatedAtRangeChange = (dateRange: DateRange | null) => {
    if (!dateRange || (!dateRange.from && !dateRange.to)) {
      onCreatedAtRangeChange(undefined);
    } else {
      onCreatedAtRangeChange({
        ...(dateRange.from && { gte: dateRange.from }),
        ...(dateRange.to && { lte: dateRange.to }),
      });
    }
  };

  const handleUpdatedAtRangeChange = (dateRange: DateRange | null) => {
    if (!dateRange || (!dateRange.from && !dateRange.to)) {
      onUpdatedAtRangeChange(undefined);
    } else {
      onUpdatedAtRangeChange({
        ...(dateRange.from && { gte: dateRange.from }),
        ...(dateRange.to && { lte: dateRange.to }),
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Next Run Date Range */}
      <DateTimeInput
        mode="date-range"
        value={{
          from: nextRunRange?.gte,
          to: nextRunRange?.lte,
        }}
        onChange={handleNextRunRangeChange}
        label="Próxima Manutenção"
        context="maintenance"
        placeholder="Selecionar período..."
        description="Filtra por período da próxima manutenção agendada"
        numberOfMonths={2}
      />

      <Separator />

      {/* Created Date Range */}
      <DateTimeInput
        mode="date-range"
        value={{
          from: createdAtRange?.gte,
          to: createdAtRange?.lte,
        }}
        onChange={handleCreatedAtRangeChange}
        label="Data de Criação"
        placeholder="Selecionar período..."
        description="Filtra por período de criação da manutenção"
        numberOfMonths={2}
      />

      <Separator />

      {/* Updated Date Range */}
      <DateTimeInput
        mode="date-range"
        value={{
          from: updatedAtRange?.gte,
          to: updatedAtRange?.lte,
        }}
        onChange={handleUpdatedAtRangeChange}
        label="Data de Atualização"
        placeholder="Selecionar período..."
        description="Filtra por período da última atualização"
        numberOfMonths={2}
      />
    </div>
  );
}
