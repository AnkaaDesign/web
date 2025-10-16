import type { ActivityGetManyFormData } from "../../../../../schemas";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { IconCalendarPlus } from "@tabler/icons-react";

interface ActivityDateFiltersProps {
  filters: Partial<ActivityGetManyFormData>;
  updateFilter: <K extends keyof ActivityGetManyFormData>(key: K, value: ActivityGetManyFormData[K] | undefined) => void;
}

export const ActivityDateFilters = ({ filters, updateFilter }: ActivityDateFiltersProps) => {
  const handleCreatedAtFromChange = (date: Date | null) => {
    if (!date && !filters.createdAt?.lte) {
      updateFilter("createdAt", undefined);
    } else {
      updateFilter("createdAt", {
        ...(date && { gte: date }),
        ...(filters.createdAt?.lte && { lte: filters.createdAt.lte }),
      });
    }
  };

  const handleCreatedAtToChange = (date: Date | null) => {
    if (!date && !filters.createdAt?.gte) {
      updateFilter("createdAt", undefined);
    } else {
      updateFilter("createdAt", {
        ...(filters.createdAt?.gte && { gte: filters.createdAt.gte }),
        ...(date && { lte: date }),
      });
    }
  };

  return (
    <div className="grid gap-4">
      {/* Created At Date Range */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <IconCalendarPlus className="h-4 w-4" />
          Data de Criação
        </div>
        <div className="grid grid-cols-2 gap-3">
          <DateTimeInput
            mode="date"
            value={filters.createdAt?.gte}
            onChange={handleCreatedAtFromChange}
            label="De"
            placeholder="Selecionar data inicial..."
          />
          <DateTimeInput
            mode="date"
            value={filters.createdAt?.lte}
            onChange={handleCreatedAtToChange}
            label="Até"
            placeholder="Selecionar data final..."
          />
        </div>
      </div>
    </div>
  );
};
