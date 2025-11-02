// apps/web/src/components/production/task/batch-edit/cells/general-painting-cell.tsx

import { FormField, FormItem, FormControl } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { usePaints } from "../../../../../hooks";

interface GeneralPaintingCellProps {
  control: any;
  index: number;
}

export function GeneralPaintingCell({ control, index }: GeneralPaintingCellProps) {
  const { data: paints } = usePaints({
    orderBy: { name: "asc" },
    take: 100,
  });

  const paintOptions = [
    { value: "", label: "Nenhuma" },
    ...(paints?.data?.map((paint) => ({
      value: paint.id,
      label: paint.name,
    })) || []),
  ];

  return (
    <FormField
      control={control}
      name={`tasks.${index}.data.paintId`}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <Combobox
              value={field.value || ""}
              onValueChange={(value) => field.onChange(value || null)}
              options={paintOptions}
              placeholder="Selecionar tinta"
              emptyMessage="Nenhuma tinta encontrada"
              searchPlaceholder="Buscar tinta..."
              allowClear
            />
          </FormControl>
        </FormItem>
      )}
    />
  );
}
