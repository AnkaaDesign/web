import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { DateTimeInput } from "@/components/ui/date-time-input";

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
  const handleNextRunFromChange = (date: Date | null) => {
    if (!date && !nextRunRange?.lte) {
      onNextRunRangeChange(undefined);
    } else {
      onNextRunRangeChange({
        ...(date && { gte: date }),
        ...(nextRunRange?.lte && { lte: nextRunRange.lte }),
      });
    }
  };

  const handleNextRunToChange = (date: Date | null) => {
    if (!date && !nextRunRange?.gte) {
      onNextRunRangeChange(undefined);
    } else {
      onNextRunRangeChange({
        ...(nextRunRange?.gte && { gte: nextRunRange.gte }),
        ...(date && { lte: date }),
      });
    }
  };

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
      {/* Next Run Date Range */}
      <div className="space-y-3">
        <div className="text-sm font-medium">Próxima Manutenção</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
            <DateTimeInput
              mode="date"
              value={nextRunRange?.gte}
              onChange={handleNextRunFromChange}
              hideLabel
              placeholder="Selecionar data inicial..."
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
            <DateTimeInput
              mode="date"
              value={nextRunRange?.lte}
              onChange={handleNextRunToChange}
              hideLabel
              placeholder="Selecionar data final..."
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Created Date Range */}
      <div className="space-y-3">
        <div className="text-sm font-medium">Data de Criação</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
            <DateTimeInput
              mode="date"
              value={createdAtRange?.gte}
              onChange={handleCreatedAtFromChange}
              hideLabel
              placeholder="Selecionar data inicial..."
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
            <DateTimeInput
              mode="date"
              value={createdAtRange?.lte}
              onChange={handleCreatedAtToChange}
              hideLabel
              placeholder="Selecionar data final..."
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Updated Date Range */}
      <div className="space-y-3">
        <div className="text-sm font-medium">Data de Atualização</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
            <DateTimeInput
              mode="date"
              value={updatedAtRange?.gte}
              onChange={handleUpdatedAtFromChange}
              hideLabel
              placeholder="Selecionar data inicial..."
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
            <DateTimeInput
              mode="date"
              value={updatedAtRange?.lte}
              onChange={handleUpdatedAtToChange}
              hideLabel
              placeholder="Selecionar data final..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
