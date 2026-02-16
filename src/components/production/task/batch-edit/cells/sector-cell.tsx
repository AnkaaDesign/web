// apps/web/src/components/production/task/batch-edit/cells/sector-cell.tsx

import { FormField, FormItem, FormControl } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { useSectors } from "../../../../../hooks";

interface SectorCellProps {
  control: any;
  index: number;
}

export function SectorCell({ control, index }: SectorCellProps) {
  const { data: sectors } = useSectors({
    orderBy: { name: "asc" },
  });

  const sectorOptions = [
    { value: "", label: "Nenhum" },
    ...(sectors?.data?.map((sector) => ({
      value: sector.id,
      label: sector.name,
    })) || []),
  ];

  return (
    <FormField
      control={control}
      name={`tasks.${index}.data.sectorId`}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <Combobox
              value={field.value || ""}
              onValueChange={(value) => field.onChange(value || null)}
              options={sectorOptions}
              placeholder="Selecionar setor"
              emptyText="Nenhum setor encontrado"
              searchPlaceholder="Buscar setor..."
              clearable
            />
          </FormControl>
        </FormItem>
      )}
    />
  );
}
