import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { TRUCK_MANUFACTURER, TRUCK_MANUFACTURER_LABELS } from "../../../constants";
import { IconTruck } from "@tabler/icons-react";

interface ManufacturerSelectorProps {
  control: any;
  disabled?: boolean;
  required?: boolean;
}

export function ManufacturerSelector({ control, disabled, required }: ManufacturerSelectorProps) {
  const options: ComboboxOption[] = [
    { value: "none", label: "Nenhuma" },
    ...Object.values(TRUCK_MANUFACTURER).map((manufacturer) => ({
      value: manufacturer,
      label: TRUCK_MANUFACTURER_LABELS[manufacturer],
    })),
  ];

  return (
    <FormField
      control={control}
      name="manufacturer"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconTruck className="h-4 w-4" />
            Montadora
            {required && <span className="text-destructive ml-1">*</span>}
          </FormLabel>
          <FormControl>
            <Combobox
              options={options}
              value={field.value || "none"}
              onValueChange={(value) => field.onChange(value === "none" ? null : value)}
              placeholder="Selecione a montadora (opcional)"
              disabled={disabled}
              searchable={false}
              className="bg-transparent"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
