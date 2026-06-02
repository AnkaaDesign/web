import type { FieldErrors } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import type { ItemCategoryCreateFormData, ItemCategoryUpdateFormData } from "../../../../../schemas";
import { useItemCategoryTree } from "../../../../../hooks";
import type { ItemCategory } from "../../../../../types";
import { useMemo } from "react";

interface ParentCategorySelectorProps {
  control: any;
  errors?: FieldErrors<ItemCategoryCreateFormData | ItemCategoryUpdateFormData>;
  disabled?: boolean;
  /** The id of the category being edited, so it can't be selected as its own parent. */
  excludeId?: string;
  /** Notified when the parent changes so the form can roll up the parent's accountingType. */
  onParentChange?: (parent: ItemCategory | undefined) => void;
}

export function ParentCategorySelector({ control, disabled, excludeId, onParentChange }: ParentCategorySelectorProps) {
  // Only top-level Categorias (level 1) can be parents — a subcategory is always level 2.
  const { data: tree = [] } = useItemCategoryTree();

  const topLevel = useMemo(() => tree.filter((c) => c.categoryLevel === 1 && c.id !== excludeId), [tree, excludeId]);

  const options = useMemo(() => topLevel.map((c) => ({ value: c.id, label: c.name })), [topLevel]);

  return (
    <FormField
      control={control}
      name="parentId"
      render={({ field }) => (
        <FormItem className="space-y-2">
          <FormLabel className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            Categoria Pai (opcional)
          </FormLabel>
          <FormControl>
            <Combobox
              options={options}
              value={field.value || ""}
              onValueChange={(value) => {
                const parentId = typeof value === "string" && value ? value : undefined;
                field.onChange(parentId ?? null);
                onParentChange?.(parentId ? topLevel.find((c) => c.id === parentId) : undefined);
              }}
              placeholder="Sem categoria pai (categoria principal)"
              emptyText="Nenhuma categoria disponível"
              searchPlaceholder="Buscar categoria..."
              disabled={disabled}
              clearable
              minSearchLength={0}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
