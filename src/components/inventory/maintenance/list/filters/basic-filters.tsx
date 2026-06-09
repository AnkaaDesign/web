import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { Separator } from "@/components/ui/separator";
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
  const quickSelected: string[] = [];
  if (isPending) quickSelected.push("isPending");
  if (isLate) quickSelected.push("isLate");

  const handleQuickChange = (value: string | string[] | null | undefined) => {
    const values = Array.isArray(value) ? value : value ? [value] : [];
    onIsPendingChange(values.includes("isPending") ? true : undefined);
    onIsLateChange(values.includes("isLate") ? true : undefined);
  };

  return (
    <div className="space-y-6">
      {/* Quick Filters */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Filtros Rápidos</Label>
        <Combobox
          mode="multiple"
          value={quickSelected}
          onValueChange={handleQuickChange}
          options={[
            { value: "isPending", label: "Apenas pendentes" },
            { value: "isLate", label: "Apenas atrasadas" },
          ]}
          placeholder="Selecione..."
          searchable={false}
          clearable
        />
      </div>

      <Separator />

      {/* Status Filter */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Status</Label>
        <Combobox
          mode="multiple"
          value={status || []}
          onValueChange={(value) => {
            const values = Array.isArray(value) ? (value as MAINTENANCE_STATUS[]) : [];
            onStatusChange(values.length > 0 ? values : undefined);
          }}
          options={Object.entries(MAINTENANCE_STATUS_LABELS).map(([statusKey, statusLabel]) => ({
            value: statusKey,
            label: statusLabel,
          }))}
          placeholder="Selecione..."
          searchable={false}
          clearable
        />
      </div>

      <Separator />

      {/* Frequency Filter */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Frequência</Label>
        <Combobox
          mode="multiple"
          value={frequency || []}
          onValueChange={(value) => {
            const values = Array.isArray(value) ? (value as SCHEDULE_FREQUENCY[]) : [];
            onFrequencyChange(values.length > 0 ? values : undefined);
          }}
          options={Object.entries(SCHEDULE_FREQUENCY_LABELS).map(([frequencyKey, frequencyLabel]) => ({
            value: frequencyKey,
            label: frequencyLabel,
          }))}
          placeholder="Selecione..."
          searchable={false}
          clearable
        />
      </div>
    </div>
  );
}
