import { useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { MAINTENANCE_STATUS, MAINTENANCE_STATUS_LABELS } from "../../../../constants";
import { IconSettings } from "@tabler/icons-react";

interface StatusSelectorProps {
  disabled?: boolean;
  required?: boolean;
}

export function MaintenanceStatusSelector({ disabled = false, required = false }: StatusSelectorProps) {
  const form = useFormContext();

  const statusOptions = useMemo((): ComboboxOption[] => {
    return Object.values(MAINTENANCE_STATUS).map((value) => ({
      value,
      label: MAINTENANCE_STATUS_LABELS[value] || value,
    }));
  }, []);

  return (
    <FormField
      control={form.control}
      name="status"
      render={({ field }) => (
        <FormItem className="flex flex-col">
          <FormLabel className="flex items-center gap-2">
            <IconSettings className="h-4 w-4" />
            Status
            {required && <span className="text-destructive ml-1">*</span>}
          </FormLabel>
          <FormControl>
            <Combobox
              options={statusOptions}
              value={field.value || ""}
              onValueChange={field.onChange}
              placeholder="Selecione o status"
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
