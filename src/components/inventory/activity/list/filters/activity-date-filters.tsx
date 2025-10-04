import type { ActivityGetManyFormData } from "../../../../../schemas";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { IconCalendarPlus } from "@tabler/icons-react";
import type { DateRange } from "react-day-picker";

interface ActivityDateFiltersProps {
  filters: Partial<ActivityGetManyFormData>;
  updateFilter: <K extends keyof ActivityGetManyFormData>(key: K, value: ActivityGetManyFormData[K] | undefined) => void;
}

export const ActivityDateFilters = ({ filters, updateFilter }: ActivityDateFiltersProps) => {
  const handleCreatedAtChange = (dateRange: DateRange | null) => {
    if (!dateRange || (!dateRange.from && !dateRange.to)) {
      updateFilter("createdAt", undefined);
    } else {
      updateFilter("createdAt", {
        ...(dateRange.from && { gte: dateRange.from }),
        ...(dateRange.to && { lte: dateRange.to }),
      });
    }
  };

  const currentCreatedAtRange: DateRange = {
    from: filters.createdAt?.gte,
    to: filters.createdAt?.lte,
  };

  return (
    <div className="grid gap-4">
      {/* Created At Date Range */}
      <DateTimeInput
        mode="date-range"
        value={currentCreatedAtRange}
        onChange={handleCreatedAtChange}
        label="Data de Criação"
        placeholder="Selecionar período..."
        description="Filtra por período de criação da atividade"
        numberOfMonths={2}
      />
    </div>
  );
};
