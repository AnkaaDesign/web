import { useRef, useCallback } from "react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "../../../../utils";
import { getItems } from "../../../../api-client";

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
  // Create a stable cache for fetched items
  const cacheRef = useRef<Map<string, ComboboxOption>>(new Map());

  // Async query function for items
  const queryItems = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const pageSize = 50;
      const response = await getItems({
        orderBy: { name: "asc" },
        page: page,
        take: pageSize,
        where: {
          isActive: true,
          ...(searchTerm ? {
            OR: [
              { name: { contains: searchTerm, mode: "insensitive" } },
              { uniCode: { contains: searchTerm, mode: "insensitive" } },
            ],
          } : {}),
        },
        include: {
          supplier: true,
        },
      });

      const items = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      const options: ComboboxOption[] = items.map((item) => {
        const label = item.uniCode ? `${item.uniCode} - ${item.name}` : item.name;
        const option: ComboboxOption = {
          label,
          value: item.id,
          metadata: {
            supplier: item.supplier,
            quantity: item.quantity,
            reorderPoint: item.reorderPoint,
          },
        };
        cacheRef.current.set(item.id, option);
        return option;
      });

      return {
        data: options,
        hasMore: hasMore,
      };
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error fetching items:", error);
      }
      return {
        data: [],
        hasMore: false,
      };
    }
  }, []);

  // Custom render for option to show current stock and reorder info
  const renderOption = (option: ComboboxOption) => {
    const metadata = option.metadata;
    if (!metadata) return option.label;

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
              async
              queryKey={["items", "order-schedule-selector"]}
              queryFn={queryItems}
              initialOptions={[]}
              minSearchLength={0}
              pageSize={50}
              debounceMs={300}
              value={field.value || []}
              onValueChange={field.onChange}
              mode="multiple"
              placeholder={placeholder}
              emptyText={emptyText}
              searchPlaceholder={searchPlaceholder}
              disabled={disabled}
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
