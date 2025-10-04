import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { useGarages } from "../../../../hooks";
import type { GarageLaneCreateFormData, GarageLaneUpdateFormData } from "../../../../schemas";
import { IconBuilding } from "@tabler/icons-react";

interface GarageSelectorProps {
  control: any;
  disabled?: boolean;
}

export function GarageSelector({ control, disabled }: GarageSelectorProps) {
  // Fetch garages for selection
  const { data: garagesResponse, isLoading } = useGarages({
    orderBy: { name: "asc" },
    take: 100,
  });

  const garages = garagesResponse?.data || [];

  // Create combobox options with garage info
  const garageOptions: ComboboxOption[] = garages.map((garage) => ({
    value: garage.id,
    label: garage.name,
    description: `${garage.width}m × ${garage.length}m${garage.location ? ` | ${garage.location}` : ""}`,
  }));

  return (
    <FormField
      control={control}
      name="garageId"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconBuilding className="h-4 w-4 text-muted-foreground" />
            Garagem
            <span className="text-destructive">*</span>
          </FormLabel>
          <FormControl>
            <Combobox
              options={garageOptions}
              value={field.value || ""}
              onValueChange={field.onChange}
              placeholder="Selecione a garagem..."
              emptyText="Nenhuma garagem encontrada"
              disabled={disabled || isLoading}
              searchable={true}
              className="w-full"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
