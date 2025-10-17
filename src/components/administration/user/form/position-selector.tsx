import { useMemo, useCallback } from "react";
import type { FieldValues } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { IconBriefcase } from "@tabler/icons-react";
import { getPositions } from "../../../../api-client";
import type { Position } from "../../../../types";

interface PositionSelectorProps<T extends FieldValues = FieldValues> {
  control?: any;
  name?: string;
  label?: string;
  disabled?: boolean;
  placeholder?: string;
  emptyMessage?: string;
  required?: boolean;
  className?: string;
  excludeIds?: string[];
  onQuickCreate?: (name: string) => Promise<Position | null>;
  initialPosition?: Position;
}

export function PositionSelector<T extends FieldValues = FieldValues>({
  control,
  name = "positionId",
  label = "Cargo",
  disabled,
  placeholder = "Selecione o cargo do colaborador",
  emptyMessage = "Nenhum cargo encontrado",
  required = false,
  className,
  excludeIds = [],
  onQuickCreate,
  initialPosition,
}: PositionSelectorProps<T>) {
  // Memoize initial options
  const initialOptions = useMemo(() => {
    if (!initialPosition) return [];
    return [{
      value: initialPosition.id,
      label: initialPosition.name,
    }];
  }, [initialPosition]);

  // Async query function for the combobox
  const queryPositions = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const queryParams: any = {
        orderBy: { name: "asc" },
        page: page,
        take: 50,
      };

      // Only add searchingFor if there's a search term
      if (searchTerm && searchTerm.trim()) {
        queryParams.searchingFor = searchTerm.trim();
      }

      const response = await getPositions(queryParams);
      const positions = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      // Filter out excluded IDs
      const filteredPositions = positions.filter((position) => !excludeIds.includes(position.id));

      // Convert positions to options format
      const options = filteredPositions.map((position) => ({
        value: position.id,
        label: position.name,
      }));

      return {
        data: options,
        hasMore: hasMore,
      };
    } catch (error) {
      console.error("Error fetching positions:", error);
      return {
        data: [],
        hasMore: false,
      };
    }
  }, [excludeIds]);

  const handleCreate = async (value: string): Promise<void> => {
    if (onQuickCreate) {
      await onQuickCreate(value);
    }
  };

  if (!control) {
    return null;
  }

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel className="flex items-center gap-2">
            <IconBriefcase className="h-4 w-4 text-muted-foreground" />
            {label}
            {required && <span className="text-destructive">*</span>}
          </FormLabel>
          <FormControl>
            <Combobox
              async={true}
              queryKey={["positions"]}
              queryFn={queryPositions}
              initialOptions={initialOptions}
              value={field.value ?? ""}
              onValueChange={field.onChange}
              placeholder={placeholder}
              emptyText={emptyMessage}
              disabled={disabled}
              clearable={!required}
              searchable={true}
              allowCreate={!!onQuickCreate}
              createLabel={(value: string) => `Criar cargo "${value}"`}
              onCreate={onQuickCreate ? handleCreate : undefined}
              minSearchLength={0}
              pageSize={50}
              debounceMs={300}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
