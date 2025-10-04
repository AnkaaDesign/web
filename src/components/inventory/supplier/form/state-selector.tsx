import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { IconMapPin } from "@tabler/icons-react";
import { useFormContext } from "react-hook-form";
import { BRAZILIAN_STATES, BRAZILIAN_STATE_NAMES } from "../../../../constants";
import type { SupplierCreateFormData, SupplierUpdateFormData } from "../../../../schemas";
import { useMemo } from "react";

type FormData = SupplierCreateFormData | SupplierUpdateFormData;

interface StateSelectorProps {
  disabled?: boolean;
}

export function SupplierStateSelector({ disabled }: StateSelectorProps) {
  const form = useFormContext<FormData>();

  const stateOptions = useMemo<ComboboxOption[]>(
    () =>
      BRAZILIAN_STATES.map((state) => ({
        value: state,
        label: `${state} - ${BRAZILIAN_STATE_NAMES[state]}`,
        description: BRAZILIAN_STATE_NAMES[state],
      })),
    [],
  );

  return (
    <FormField
      control={form.control}
      name="state"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconMapPin className="h-4 w-4" />
            Estado
          </FormLabel>
          <FormControl>
            <Combobox
              value={field.value || undefined}
              onValueChange={(value) => field.onChange(value || null)}
              options={stateOptions}
              placeholder="Selecione o estado"
              searchPlaceholder="Buscar estado..."
              emptyText="Nenhum estado encontrado"
              disabled={disabled}
              searchable
              clearable
              triggerClassName="transition-all duration-200"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
