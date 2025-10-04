import { Combobox } from "@/components/ui/combobox";
import { FormField, FormItem, FormControl } from "@/components/ui/form";
import { useItemCategories } from "../../../../../hooks";
import { ITEM_CATEGORY_TYPE } from "../../../../../constants";

interface CategoryCellProps {
  control: any;
  index: number;
  disabled?: boolean;
}

export function CategoryCell({ control, index, disabled }: CategoryCellProps) {
  const { data: response, isLoading } = useItemCategories();
  const categories = response?.data || [];

  return (
    <FormField
      control={control}
      name={`items.${index}.data.categoryId`}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <Combobox
              disabled={disabled || isLoading}
              value={field.value || ""}
              onValueChange={field.onChange}
              options={
                categories?.map((category) => ({
                  label: `${category.name}${category.type === ITEM_CATEGORY_TYPE.PPE ? " (EPI)" : ""}`,
                  value: category.id,
                })) || []
              }
              placeholder={isLoading ? "Carregando..." : "Selecione"}
              searchPlaceholder="Buscar categoria..."
              className="h-10"
            />
          </FormControl>
        </FormItem>
      )}
    />
  );
}
