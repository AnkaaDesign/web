import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { MEASURE_UNIT, MEASURE_UNIT_LABELS } from "../../constants";
import { Combobox, type ComboboxOption } from "./combobox";
import { Label } from "./label";

interface MeasureSelectorProps {
  value?: MEASURE_UNIT | MEASURE_UNIT[];
  onValueChange?: (value: MEASURE_UNIT | MEASURE_UNIT[] | undefined) => void;
  className?: string;
  mode?: "single" | "multiple";
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  clearable?: boolean;
  required?: boolean;
  name?: string;
}

export function MeasureSelector({
  value,
  onValueChange,
  className,
  mode = "single",
  placeholder = "Selecione uma unidade de medida",
  label,
  disabled = false,
  clearable = true,
  required = false,
  name,
}: MeasureSelectorProps) {
  // Convert measure units to combobox options
  const options: ComboboxOption[] = useMemo(() => {
    return Object.values(MEASURE_UNIT).map((unit) => ({
      value: unit,
      label: MEASURE_UNIT_LABELS[unit],
    }));
  }, []);

  return (
    <div className={cn("space-y-2", className)}>
      {label && <Label>{label}</Label>}
      <Combobox
        value={typeof value === 'string' ? value : Array.isArray(value) ? value : value ?? ''}
        onValueChange={(newValue) => {
          if (typeof newValue === 'string') {
            onValueChange?.(newValue as MEASURE_UNIT);
          } else if (Array.isArray(newValue)) {
            onValueChange?.(newValue as MEASURE_UNIT[]);
          } else {
            onValueChange?.(undefined);
          }
        }}
        options={options}
        mode={mode}
        placeholder={placeholder}
        disabled={disabled}
        clearable={clearable}
        required={required}
        name={name}
        searchPlaceholder="Pesquisar unidade..."
        emptyText="Nenhuma unidade encontrada"
      />
    </div>
  );
}
