import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { IconMapPin } from "@tabler/icons-react";
import { useFormContext } from "react-hook-form";
import { BRAZILIAN_STATE_NAMES } from "../../constants";
import { useMemo } from "react";

interface StateSelectorProps {
  disabled?: boolean;
  name?: string;
}

export function StateSelector({ disabled, name = "state" }: StateSelectorProps) {
  const form = useFormContext();

  // Convert states to combobox options
  const options: ComboboxOption[] = useMemo(() => {
    return Object.entries(BRAZILIAN_STATE_NAMES).map(([code, stateName]) => ({
      value: code,
      label: `${code} - ${stateName}`,
    }));
  }, []);

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconMapPin className="h-4 w-4" />
            Estado
          </FormLabel>
          <FormControl>
            <Combobox
              value={field.value}
              onValueChange={field.onChange}
              options={options}
              mode="single"
              placeholder="Selecione um estado"
              disabled={disabled}
              clearable={true}
              searchPlaceholder="Pesquisar estado..."
              emptyText="Nenhum estado encontrado"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
