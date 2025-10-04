import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { useGarageLanes } from "../../../../hooks";
import type { ParkingSpotCreateFormData, ParkingSpotUpdateFormData } from "../../../../schemas";
import { IconRoad } from "@tabler/icons-react";

interface GarageLaneSelectorProps {
  control: any;
  disabled?: boolean;
  garageId?: string; // Filter lanes by garage
}

export function GarageLaneSelector({ control, disabled, garageId }: GarageLaneSelectorProps) {
  // Fetch garage lanes for selection
  const { data: lanesResponse, isLoading } = useGarageLanes({
    where: garageId ? { garageId } : undefined,
    include: {
      garage: true,
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  const lanes = lanesResponse?.data || [];

  // Create combobox options with lane info
  const laneOptions: ComboboxOption[] = lanes.map((lane) => {
    const laneName = lane.name || `Faixa ${lane.id.slice(0, 8)}`;
    const garageName = lane.garage?.name || "Garagem";

    return {
      value: lane.id,
      label: `${laneName} - ${garageName}`,
      description: `${lane.width}m × ${lane.length}m | Posição: (${lane.xPosition}, ${lane.yPosition})`,
    };
  });

  return (
    <FormField
      control={control}
      name="garageLaneId"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconRoad className="h-4 w-4 text-muted-foreground" />
            Faixa da Garagem
            <span className="text-destructive">*</span>
          </FormLabel>
          <FormControl>
            <Combobox
              options={laneOptions}
              value={field.value || ""}
              onValueChange={field.onChange}
              placeholder="Selecione a faixa..."
              emptyText="Nenhuma faixa encontrada"
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
