import { useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { SCHEDULE_FREQUENCY, SCHEDULE_FREQUENCY_LABELS } from "../../../../constants";
import { IconClock } from "@tabler/icons-react";

interface FrequencySelectorProps {
  control: any;
  disabled?: boolean;
  required?: boolean;
}

export function FrequencySelector({ disabled = false, required = false }: FrequencySelectorProps) {
  const form = useFormContext();

  const frequencyOptions = useMemo((): ComboboxOption[] => {
    return Object.values(SCHEDULE_FREQUENCY).map((value) => ({
      value,
      label: SCHEDULE_FREQUENCY_LABELS[value] || value,
    }));
  }, []);

  return (
    <FormField
      control={form.control}
      name="frequency"
      render={({ field }) => (
        <FormItem className="flex flex-col">
          <FormLabel className="flex items-center gap-2">
            <IconClock className="h-4 w-4" />
            Frequência
            {required && <span className="text-destructive ml-1">*</span>}
          </FormLabel>
          <FormControl>
            <Combobox
              options={frequencyOptions}
              value={field.value || ""}
              onValueChange={field.onChange}
              placeholder="Selecione a frequência"
              disabled={disabled}
              searchable={false}
              clearable={!required}
              className="w-full"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
