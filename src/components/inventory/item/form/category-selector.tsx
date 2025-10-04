import { useState } from "react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { useFormContext } from "react-hook-form";
import { useItemCategories, useItemCategoryMutations } from "../../../../hooks";
import type { ItemCreateFormData, ItemUpdateFormData } from "../../../../schemas";
import { ITEM_CATEGORY_TYPE } from "../../../../constants";
import { toast } from "@/components/ui/sonner";

type FormData = ItemCreateFormData | ItemUpdateFormData;

interface CategorySelectorProps {
  disabled?: boolean;
  required?: boolean;
  onCategoryChange?: (categoryId: string | undefined) => void;
}

export function CategorySelector({ disabled, required, onCategoryChange }: CategorySelectorProps) {
  const form = useFormContext<FormData>();
  const [isCreating, setIsCreating] = useState(false);

  const {
    data: categories,
    isLoading,
    refetch,
  } = useItemCategories({
    orderBy: { name: "asc" },
  });

  const { createMutation } = useItemCategoryMutations();

  const categoryOptions =
    categories?.data?.map((category) => ({
      value: category.id,
      label: category.name,
    })) || [];

  const handleCreateCategory = async (name: string) => {
    setIsCreating(true);
    try {
      const result = await createMutation.mutateAsync({
        data: {
          name,
          type: ITEM_CATEGORY_TYPE.REGULAR,
        },
      });

      if (result.success && result.data) {
        toast.success("Categoria criada", `A categoria "${name}" foi criada com sucesso.`);

        // Refetch categories to update the list
        await refetch();

        // Set the newly created category as selected
        const newCategoryId = result.data.id;
        return newCategoryId;
      }
    } catch (error) {
      toast.error("Erro ao criar categoria", "Não foi possível criar a categoria. Tente novamente.");
      throw error;
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <FormField
      control={form.control}
      name="categoryId"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Categoria {required && <span className="text-destructive">*</span>}</FormLabel>
          <FormControl>
            <Combobox
              value={field.value || undefined}
              onValueChange={(value) => {
                field.onChange(value);
                const category = categories?.data?.find((c) => c.id === value);
                onCategoryChange?.(category?.id);
              }}
              options={categoryOptions}
              placeholder="Selecione (opcional)"
              emptyText="Nenhuma categoria encontrada"
              disabled={disabled || isLoading || isCreating}
              allowCreate={true}
              createLabel={(value) => `Criar categoria "${value}"`}
              onCreate={async (name) => {
                const newCategoryId = await handleCreateCategory(name);
                if (newCategoryId) {
                  field.onChange(newCategoryId);
                  onCategoryChange?.(newCategoryId);
                }
              }}
              isCreating={isCreating}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
