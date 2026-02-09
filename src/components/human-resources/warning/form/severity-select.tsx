import { IconAlertTriangle } from "@tabler/icons-react";

import { WARNING_SEVERITY_LABELS } from "../../../../constants";

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";

interface SeveritySelectProps {
  control: any;
  disabled?: boolean;
  required?: boolean;
}

export function SeveritySelect({ control, disabled, required }: SeveritySelectProps) {
  const severityOptions = Object.entries(WARNING_SEVERITY_LABELS).map(([key, label]) => ({
    value: key,
    label: label,
  }));

  return (
    <FormField
      control={control}
      name="severity"
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            <div className="flex items-center gap-2">
              <IconAlertTriangle className="h-4 w-4" />
              Severidade {required && <span className="text-destructive">*</span>}
            </div>
          </FormLabel>
          <FormControl>
            <Combobox
              mode="single"
              value={field.value}
              onValueChange={field.onChange}
              options={severityOptions}
              disabled={disabled}
              placeholder="Selecione a severidade"
              emptyText="Nenhuma severidade encontrada"
              searchPlaceholder="Buscar severidade..."
              clearable={!required}
              searchable={false}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
