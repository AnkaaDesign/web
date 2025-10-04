import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import type { PaintCreateFormData, PaintUpdateFormData } from "../../../schemas";
import { TRUCK_MANUFACTURER, TRUCK_MANUFACTURER_LABELS } from "../../../constants";

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
          <FormLabel>
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
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
