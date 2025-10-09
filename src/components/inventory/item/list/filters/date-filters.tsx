import { Separator } from "@/components/ui/separator";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { IconCalendarPlus, IconCalendarStats } from "@tabler/icons-react";

interface DateFiltersProps {
  createdAtRange?: { gte?: Date; lte?: Date };
  onCreatedAtRangeChange: (range?: { gte?: Date; lte?: Date }) => void;
  updatedAtRange?: { gte?: Date; lte?: Date };
  onUpdatedAtRangeChange: (range?: { gte?: Date; lte?: Date }) => void;
}

export function DateFilters({ createdAtRange, onCreatedAtRangeChange, updatedAtRange, onUpdatedAtRangeChange }: DateFiltersProps) {
  const handleCreatedAtFromChange = (date: Date | null) => {
    if (!date && !createdAtRange?.lte) {
      onCreatedAtRangeChange(undefined);
    } else {
      onCreatedAtRangeChange({
        ...(date && { gte: date }),
        ...(createdAtRange?.lte && { lte: createdAtRange.lte }),
      });
    }
  };

  const handleCreatedAtToChange = (date: Date | null) => {
    if (!date && !createdAtRange?.gte) {
      onCreatedAtRangeChange(undefined);
    } else {
      onCreatedAtRangeChange({
        ...(createdAtRange?.gte && { gte: createdAtRange.gte }),
        ...(date && { lte: date }),
      });
    }
  };

  const handleUpdatedAtFromChange = (date: Date | null) => {
    if (!date && !updatedAtRange?.lte) {
      onUpdatedAtRangeChange(undefined);
    } else {
      onUpdatedAtRangeChange({
        ...(date && { gte: date }),
        ...(updatedAtRange?.lte && { lte: updatedAtRange.lte }),
      });
    }
  };

  const handleUpdatedAtToChange = (date: Date | null) => {
    if (!date && !updatedAtRange?.gte) {
      onUpdatedAtRangeChange(undefined);
    } else {
      onUpdatedAtRangeChange({
        ...(updatedAtRange?.gte && { gte: updatedAtRange.gte }),
        ...(date && { lte: date }),
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Created At Range */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <IconCalendarPlus className="h-4 w-4" />
          Data de Criação
        </div>
        <div className="space-y-3 pl-6">
          <DateTimeInput
            mode="date"
            value={createdAtRange?.gte}
            onChange={handleCreatedAtFromChange}
            label="De"
            placeholder="Selecionar data inicial..."
          />
          <DateTimeInput
            mode="date"
            value={createdAtRange?.lte}
            onChange={handleCreatedAtToChange}
            label="Até"
            placeholder="Selecionar data final..."
          />
        </div>
      </div>

      <Separator />

      {/* Updated At Range */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <IconCalendarStats className="h-4 w-4" />
          Data de Atualização
        </div>
        <div className="space-y-3 pl-6">
          <DateTimeInput
            mode="date"
            value={updatedAtRange?.gte}
            onChange={handleUpdatedAtFromChange}
            label="De"
            placeholder="Selecionar data inicial..."
          />
          <DateTimeInput
            mode="date"
            value={updatedAtRange?.lte}
            onChange={handleUpdatedAtToChange}
            label="Até"
            placeholder="Selecionar data final..."
          />
        </div>
      </div>
    </div>
  );
}
