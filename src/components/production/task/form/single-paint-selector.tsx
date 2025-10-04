import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { usePaints } from "../../../../hooks";
import type { TaskCreateFormData, TaskUpdateFormData } from "../../../../schemas";

interface SinglePaintSelectorProps {
  control: any;
  disabled?: boolean;
}

export function SinglePaintSelector({ control, disabled }: SinglePaintSelectorProps) {
  // Fetch paints
  const { data: paints, isLoading } = usePaints({
    orderBy: { name: "asc" },
    take: 100,
  });

  const paintOptions =
    paints?.data?.map((paint) => ({
      value: paint.id,
      label: paint.name,
    })) || [];

  return (
    <FormField
      control={control}
      name="paintId"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Tinta Geral</FormLabel>
          <FormControl>
            <Combobox
              value={field.value || undefined}
              onValueChange={field.onChange}
              options={paintOptions}
              placeholder="Selecione uma tinta..."
              emptyText="Nenhuma tinta disponível"
              disabled={disabled || isLoading}
              className="w-full"
              searchable={true}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
