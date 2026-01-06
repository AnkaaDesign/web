import { useState, useMemo, useRef, useCallback } from "react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { IconCategory } from "@tabler/icons-react";
import { useFormContext } from "react-hook-form";
import { useItemCategoryMutations } from "../../../../hooks";
import { getItemCategories } from "../../../../api-client";
import type { ItemCreateFormData, ItemUpdateFormData } from "../../../../schemas";
import type { ItemCategory } from "../../../../types";
import { ITEM_CATEGORY_TYPE } from "../../../../constants";
import { toast } from "@/components/ui/sonner";

type FormData = ItemCreateFormData | ItemUpdateFormData;

interface CategorySelectorProps {
  disabled?: boolean;
  required?: boolean;
  onCategoryChange?: (categoryId: string | undefined) => void;
  initialCategory?: ItemCategory;
}

export function CategorySelector({ disabled, required, onCategoryChange, initialCategory }: CategorySelectorProps) {
  const form = useFormContext<FormData>();
  const [isCreating, setIsCreating] = useState(false);
  const { createMutation } = useItemCategoryMutations();

  // Create memoized initialOptions with stable dependency
  const initialOptions = useMemo(
    () =>
      initialCategory
        ? [
            {
              value: initialCategory.id,
              label: initialCategory.name,
            },
          ]
        : [],
    [initialCategory?.id]
  );

  // Initialize cache with initial category
  const cacheRef = useRef<Map<string, ItemCategory>>(new Map());

  // Add initial category to cache on mount or when it changes
  useMemo(() => {
    if (initialCategory) {
      cacheRef.current.set(initialCategory.id, initialCategory);
    }
  }, [initialCategory?.id]);

  const fetchCategories = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const response = await getItemCategories({
        page: page,
        take: 50,
        orderBy: { name: "asc" },
        where: searchTerm && searchTerm.trim()
          ? {
              name: { contains: searchTerm.trim(), mode: "insensitive" },
            }
          : undefined,
      });

      const categories = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      // Add fetched categories to cache
      const options = categories.map((category: ItemCategory) => {
        const option = {
          value: category.id,
          label: category.name,
        };
        cacheRef.current.set(category.id, category);
        return option;
      });

      return {
        data: options,
        hasMore: hasMore,
      };
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error fetching categories:", error);
      }
      return {
        data: [],
        hasMore: false,
      };
    }
  }, []);

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
        // Set the newly created category as selected
        const newCategoryId = result.data.id;
        return newCategoryId;
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error creating category:", error);
      }
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
          <FormLabel className="flex items-center gap-2">
            <IconCategory className="h-4 w-4" />
            Categoria {required && <span className="text-destructive">*</span>}
          </FormLabel>
          <FormControl>
            <Combobox
              value={field.value || ""}
              onValueChange={(value) => {
                field.onChange(value);
                onCategoryChange?.(value || undefined);
              }}
              async={true}
              queryKey={["item-categories", "selector"]}
              queryFn={fetchCategories}
              initialOptions={initialOptions}
              minSearchLength={0}
              pageSize={50}
              debounceMs={300}
              placeholder="Pesquisar categoria..."
              emptyText="Nenhuma categoria encontrada"
              searchPlaceholder="Digite o nome da categoria..."
              disabled={disabled || isCreating}
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
