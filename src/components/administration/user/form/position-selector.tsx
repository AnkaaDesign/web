import { useState, useMemo } from "react";
import type { FieldValues } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { IconBriefcase } from "@tabler/icons-react";
import { usePositionsInfinite } from "../../../../hooks";
import type { Position, PositionGetManyResponse } from "../../../../types";

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
}: PositionSelectorProps<T>) {
  const [isCreating, setIsCreating] = useState(false);

  const { data: positionsPages, isLoading } = usePositionsInfinite({
    limit: 50,
    orderBy: { name: "asc" },
  });

  // Flatten all pages into a single array
  const allPositions = useMemo(() => {
    if (!positionsPages?.pages) return [];

    const positions: Position[] = [];
    positionsPages.pages.forEach((page: PositionGetManyResponse) => {
      if (page?.data) {
        positions.push(...page.data);
      }
    });

    // Filter out excluded IDs
    return positions.filter((position) => !excludeIds.includes(position.id));
  }, [positionsPages?.pages, excludeIds]);

  const positionOptions = allPositions.map((position) => ({
    value: position.id,
    label: position.name,
  }));

  const handleCreatePosition = async (name: string): Promise<string | null> => {
    if (!onQuickCreate) return null;

    setIsCreating(true);
    try {
      const newPosition = await onQuickCreate(name);
      return newPosition?.id || null;
    } catch (error) {
      console.error("Error creating position:", error);
      return null;
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreate = async (value: string): Promise<void> => {
    await handleCreatePosition(value);
  };

  if (!control) {
    return null; // or some fallback UI
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
              value={field.value ?? ""}
              onValueChange={field.onChange}
              options={positionOptions}
              placeholder={placeholder}
              emptyText={emptyMessage}
              disabled={disabled || isLoading || isCreating}
              clearable={!required}
              allowCreate={!!onQuickCreate}
              createLabel={(value: string) => `Criar cargo "${value}"`}
              onCreate={onQuickCreate ? handleCreate : undefined}
              isCreating={isCreating}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
