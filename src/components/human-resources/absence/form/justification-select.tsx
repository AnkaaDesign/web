import { IconClipboardList } from "@tabler/icons-react";

import type { SecullumJustificativaCategory } from "../../../../constants";
import {
  AUSENCIA_JUSTIFICATIVA_IDS,
  FALTA_JUSTIFICATIVA_IDS,
  SECULLUM_JUSTIFICATIVAS,
} from "../../../../constants";

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";

interface JustificationSelectProps {
  control: any;
  name?: string;
  category?: SecullumJustificativaCategory; // restricts dropdown to AUSENCIA or FALTA ids
  disabled?: boolean;
  required?: boolean;
}

export function JustificationSelect({ control, name = "justificativaId", category, disabled, required }: JustificationSelectProps) {
  const allowedIds = category === "AUSENCIA"
    ? AUSENCIA_JUSTIFICATIVA_IDS
    : category === "FALTA"
      ? FALTA_JUSTIFICATIVA_IDS
      : Object.keys(SECULLUM_JUSTIFICATIVAS).map(Number);

  const options = allowedIds
    .map((id) => SECULLUM_JUSTIFICATIVAS[id])
    .filter(Boolean)
    .map((j) => ({ value: j.id, label: j.label, description: j.abreviado }));

  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem className="flex flex-col">
          <FormLabel>
            <div className="flex items-center gap-2">
              <IconClipboardList className="h-4 w-4" />
              Justificativa {required && <span className="text-destructive">*</span>}
            </div>
          </FormLabel>
          <FormControl>
            <Combobox
              value={field.value}
              onValueChange={(v) => field.onChange(typeof v === "string" ? Number(v) : v)}
              disabled={disabled}
              placeholder="Selecione a justificativa..."
              options={options as any}
              getOptionLabel={(o: any) => o.label}
              getOptionValue={(o: any) => o.value}
              renderOption={(o: any) => (
                <div>
                  <p className="font-medium">{o.label}</p>
                  <p className="text-xs text-muted-foreground">{o.description}</p>
                </div>
              )}
              error={!!fieldState.error}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
