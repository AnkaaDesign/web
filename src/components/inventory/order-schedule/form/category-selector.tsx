import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { Skeleton } from "@/components/ui/skeleton";
import { useItemCategories } from "../../../../hooks";
import { ITEM_CATEGORY_STATUS } from "../../../../constants";
import type { OrderScheduleCreateFormData } from "../../../../schemas";

interface CategorySelectorProps {
  control: any;
  disabled?: boolean;
  required?: boolean;
}

export function OrderScheduleCategorySelector({ control, disabled = false, required = false }: CategorySelectorProps) {
  // Fetch active item categories
  const { data: response, isLoading } = useItemCategories({
    where: {
      status: ITEM_CATEGORY_STATUS.ACTIVE,
    },
    orderBy: {
      name: "asc",
    },
  });

  const categories = response?.data || [];

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <FormField
      control={control}
      name="categoryId"
      render={({ field }) => (
        <FormItem>
          <FormLabel className={required ? "after:content-['*'] after:ml-0.5 after:text-red-500" : ""}>Categoria</FormLabel>
          <FormControl>
            <Combobox
              value={field.value || "_no_category"}
              onValueChange={(value) => field.onChange(value === "_no_category" ? "" : value)}
              options={[
                { label: "Nenhuma categoria selecionada", value: "_no_category" },
                ...(categories?.map((category) => ({
                  label: category.name,
                  value: category.id,
                })) || []),
              ]}
              placeholder="Selecione a categoria"
              searchPlaceholder="Buscar categoria..."
              disabled={disabled}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export default OrderScheduleCategorySelector;
