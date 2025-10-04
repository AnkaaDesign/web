import { FormField, FormItem, FormControl, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { useSectors } from "../../../../../hooks";
import type { UserBatchEditFormData } from "../types";

interface SectorCellProps {
  control: any;
  index: number;
  disabled?: boolean;
  currentSectorName?: string;
}

export function SectorCell({ control, index, disabled, currentSectorName }: SectorCellProps) {
  const { data: sectors, isLoading } = useSectors({
    orderBy: { name: "asc" },
  });

  const sectorOptions =
    sectors?.data?.map((sector) => ({
      value: sector.id,
      label: sector.name,
    })) || [];

  // Add "none" option for clearing the sector
  const optionsWithNone = [{ value: "none", label: "Nenhum" }, ...sectorOptions];

  return (
    <FormField
      control={control}
      name={`users.${index}.data.sectorId`}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <Combobox
              value={field.value || "none"}
              onValueChange={(value: string | undefined) => field.onChange(value === "none" ? null : value)}
              options={optionsWithNone}
              placeholder={currentSectorName || "Selecione um setor"}
              emptyText="Nenhum setor encontrado"
              disabled={disabled || isLoading}
              className="h-8"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
