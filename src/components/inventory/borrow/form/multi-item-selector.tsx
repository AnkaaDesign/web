import { FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { useItems } from "../../../../hooks";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "../../../../utils";
import type { Item } from "../../../../types";

interface MultiItemSelectorProps {
  control: any;
  name?: string;
  label?: string;
  description?: string;
  disabled?: boolean;
  placeholder?: string;
  emptyText?: string;
  searchPlaceholder?: string;
}

export function MultiItemSelector({
  control,
  name = "itemIds",
  label = "Itens",
  description,
  disabled,
  placeholder = "Selecione os itens",
  emptyText = "Nenhum item disponível",
  searchPlaceholder = "Pesquisar por nome ou código...",
}: MultiItemSelectorProps) {
  // Fetch items with their current quantities - only tools
  const { data: itemsResponse, isLoading } = useItems({
    where: {
      isActive: true,
      quantity: { gt: 0 }, // Only show items with available stock
      itemCategory: {
        type: "TOOL", // Only show tools that can be borrowed
      },
    },
    orderBy: { name: "asc" },
    take: 40,
  });

  const items = itemsResponse?.data || [];

  // Create options for MultiCombobox
  const itemOptions = items.map((item) => ({
    value: item.id,
    label: item.uniCode ? `${item.uniCode} - ${item.name}` : item.name,
  }));

  // Custom render for option to show available quantity
  const renderOption = (option: { value: string; label: string }) => {
    const item = items.find((i: Item) => i.id === option.value);
    if (!item) return null;

    return (
      <div className="flex items-center justify-between w-full">
        <div className="flex flex-col">
          <span className="font-medium">{option.label}</span>
        </div>
        <Badge variant="secondary" className="ml-2 shrink-0">
          {formatNumber(item.quantity)} disponível
        </Badge>
      </div>
    );
  };

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          {label && <FormLabel>{label}</FormLabel>}
          <FormControl>
            <Combobox
              value={field.value || []}
              onValueChange={field.onChange}
              options={itemOptions}
              mode="multiple"
              placeholder={placeholder}
              emptyText={emptyText}
              searchPlaceholder={searchPlaceholder}
              disabled={disabled || isLoading}
              className="w-full"
              renderOption={renderOption}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

// Export for convenience
export default MultiItemSelector;
