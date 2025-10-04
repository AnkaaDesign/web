import { FormField, FormItem, FormControl, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { usePositions } from "../../../../../hooks";
import type { UserBatchEditFormData } from "../types";

interface PositionCellProps {
  control: any;
  index: number;
  disabled?: boolean;
  currentPositionName?: string;
}

export function PositionCell({ control, index, disabled, currentPositionName }: PositionCellProps) {
  const { data: positions, isLoading } = usePositions({
    orderBy: { name: "asc" },
  });

  const positionOptions =
    positions?.data?.map((position) => ({
      value: position.id,
      label: position.name,
    })) || [];

  // Add "none" option for clearing the position
  const optionsWithNone = [{ value: "none", label: "Nenhum" }, ...positionOptions];

  return (
    <FormField
      control={control}
      name={`users.${index}.data.positionId`}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <Combobox
              value={field.value || "none"}
              onValueChange={(value: string | undefined) => field.onChange(value === "none" ? null : value)}
              options={optionsWithNone}
              placeholder={currentPositionName || "Selecione um cargo"}
              emptyText="Nenhum cargo encontrado"
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
