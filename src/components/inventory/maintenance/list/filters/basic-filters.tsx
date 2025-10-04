import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { MAINTENANCE_STATUS, MAINTENANCE_STATUS_LABELS, SCHEDULE_FREQUENCY, SCHEDULE_FREQUENCY_LABELS } from "../../../../../constants";

interface MaintenanceBasicFiltersProps {
  status?: MAINTENANCE_STATUS[];
  onStatusChange: (value: MAINTENANCE_STATUS[] | undefined) => void;
  frequency?: SCHEDULE_FREQUENCY[];
  onFrequencyChange: (value: SCHEDULE_FREQUENCY[] | undefined) => void;
  isPending?: boolean;
  onIsPendingChange: (value: boolean | undefined) => void;
  isLate?: boolean;
  onIsLateChange: (value: boolean | undefined) => void;
}

export function MaintenanceBasicFilters({
  status,
  onStatusChange,
  frequency,
  onFrequencyChange,
  isPending,
  onIsPendingChange,
  isLate,
  onIsLateChange,
}: MaintenanceBasicFiltersProps) {
  const handleStatusToggle = (statusValue: MAINTENANCE_STATUS) => {
    const currentStatus = status || [];
    const newStatus = currentStatus.includes(statusValue) ? currentStatus.filter((s) => s !== statusValue) : [...currentStatus, statusValue];
    onStatusChange(newStatus.length > 0 ? newStatus : undefined);
  };

  const handleFrequencyToggle = (frequencyValue: SCHEDULE_FREQUENCY) => {
    const currentFrequency = frequency || [];
    const newFrequency = currentFrequency.includes(frequencyValue) ? currentFrequency.filter((f) => f !== frequencyValue) : [...currentFrequency, frequencyValue];
    onFrequencyChange(newFrequency.length > 0 ? newFrequency : undefined);
  };

  return (
    <div className="space-y-6">
      {/* Quick Filters */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Filtros Rápidos</Label>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="isPending" className="text-sm font-normal">
              Apenas pendentes
            </Label>
            <Switch id="isPending" checked={isPending === true} onCheckedChange={(checked) => onIsPendingChange(checked ? true : undefined)} />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="isLate" className="text-sm font-normal">
              Apenas atrasadas
            </Label>
            <Switch id="isLate" checked={isLate === true} onCheckedChange={(checked) => onIsLateChange(checked ? true : undefined)} />
          </div>
        </div>
      </div>

      <Separator />

      {/* Status Filter */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Status</Label>

        <div className="grid grid-cols-2 gap-2">
          {Object.entries(MAINTENANCE_STATUS_LABELS).map(([statusKey, statusLabel]) => {
            const statusValue = statusKey as MAINTENANCE_STATUS;
            const isChecked = status?.includes(statusValue) || false;

            return (
              <div key={statusKey} className="flex items-center space-x-2">
                <Checkbox id={`status-${statusKey}`} checked={isChecked} onCheckedChange={() => handleStatusToggle(statusValue)} />
                <Label htmlFor={`status-${statusKey}`} className="text-sm font-normal cursor-pointer">
                  {statusLabel}
                </Label>
              </div>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Frequency Filter */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Frequência</Label>

        <div className="grid grid-cols-2 gap-2">
          {Object.entries(SCHEDULE_FREQUENCY_LABELS).map(([frequencyKey, frequencyLabel]) => {
            const frequencyValue = frequencyKey as SCHEDULE_FREQUENCY;
            const isChecked = frequency?.includes(frequencyValue) || false;

            return (
              <div key={frequencyKey} className="flex items-center space-x-2">
                <Checkbox id={`frequency-${frequencyKey}`} checked={isChecked} onCheckedChange={() => handleFrequencyToggle(frequencyValue)} />
                <Label htmlFor={`frequency-${frequencyKey}`} className="text-sm font-normal cursor-pointer">
                  {frequencyLabel}
                </Label>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
