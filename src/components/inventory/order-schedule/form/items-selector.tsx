import { FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { useItems } from "../../../../hooks";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "../../../../utils";

interface ItemsSelectorProps {
  control: any;
  name?: string;
  label?: string;
  description?: string;
  disabled?: boolean;
  placeholder?: string;
  emptyText?: string;
  searchPlaceholder?: string;
  required?: boolean;
}

export function ItemsSelector({
  control,
  name = "items",
  label = "Itens",
  description = "Selecione os itens que serão incluídos nos pedidos automáticos",
  disabled,
  placeholder = "Selecione os itens",
  emptyText = "Nenhum item disponível",
  searchPlaceholder = "Pesquisar por nome ou código...",
  required = false,
}: ItemsSelectorProps) {
  // Fetch items - all active items for order scheduling
  const { data: itemsResponse, isLoading } = useItems({
    where: {
      isActive: true,
    },
    orderBy: { name: "asc" },
    take: 100, // More items for order scheduling
  });

  const items = itemsResponse?.data || [];

  // Create options for Combobox with metadata
  const itemOptions: ComboboxOption[] = items.map((item) => ({
    value: item.id,
    label: item.uniCode ? `${item.uniCode} - ${item.name}` : item.name,
    metadata: {
      supplier: item.supplier,
      quantity: item.quantity,
      reorderPoint: item.reorderPoint,
    },
  }));

  // Custom render for option to show current stock and reorder info
  const renderOption = (option: ComboboxOption) => {
    const metadata = option.metadata;
    if (!metadata) return null;

    return (
      <div className="flex items-center justify-between w-full">
        <div className="flex flex-col">
          <span className="font-medium">{option.label}</span>
          {metadata.supplier && <span className="text-xs text-muted-foreground">Fornecedor: {metadata.supplier.fantasyName}</span>}
        </div>
        <div className="flex flex-col gap-1 items-end ml-2 shrink-0">
          <Badge variant="secondary" className="text-xs">
            Estoque: {formatNumber(metadata.quantity)}
          </Badge>
          {metadata.reorderPoint && (
            <Badge variant={metadata.quantity <= metadata.reorderPoint ? "destructive" : "outline"} className="text-xs">
              Min: {formatNumber(metadata.reorderPoint)}
            </Badge>
          )}
        </div>
      </div>
    );
  };

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className={required ? "after:content-['*'] after:ml-0.5 after:text-red-500" : ""}>{label}</FormLabel>
          <FormControl>
            <Combobox<ComboboxOption>
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
              searchable={true}
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
export default ItemsSelector;
