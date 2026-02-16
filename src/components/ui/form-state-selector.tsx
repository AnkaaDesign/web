import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { IconMapPin } from "@tabler/icons-react";
import { useFormContext, type Path } from "react-hook-form";
import { BRAZILIAN_STATES, BRAZILIAN_STATE_NAMES } from "../../constants";
import { useMemo } from "react";

interface FormStateSelectorProps<T extends Record<string, any>> {
  name: Path<T>;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}

export function FormStateSelector<T extends Record<string, any>>({
  name,
  label = "Estado",
  placeholder = "Selecione o estado",
  disabled = false,
  required = false,
}: FormStateSelectorProps<T>) {
  const form = useFormContext<T>();

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
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconMapPin className="h-4 w-4" />
            {label}
            {required && <span className="text-destructive">*</span>}
          </FormLabel>
          <FormControl>
            <Combobox
              value={field.value || undefined}
              onValueChange={(value) => field.onChange(value || null)}
              options={stateOptions}
              placeholder={placeholder}
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
