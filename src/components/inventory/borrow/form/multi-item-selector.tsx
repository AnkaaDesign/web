import { useRef, useCallback } from "react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "../../../../utils";
import { getItems } from "../../../../api-client";

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
  // Create a stable cache for fetched items
  const cacheRef = useRef<Map<string, { label: string; value: string; metadata?: any }>>(new Map());

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
          quantity: { gt: 0 }, // Only show items with available stock
          category: {
            type: "TOOL", // Only show tools that can be borrowed
          },
          ...(searchTerm ? {
            OR: [
              { name: { contains: searchTerm, mode: "insensitive" } },
              { uniCode: { contains: searchTerm, mode: "insensitive" } },
            ],
          } : {}),
        },
      });

      const items = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      const options = items.map((item) => {
        const label = item.uniCode ? `${item.uniCode} - ${item.name}` : item.name;
        const option = {
          label,
          value: item.id,
          metadata: {
            quantity: item.quantity,
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

  // Custom render for option to show available quantity
  const renderOption = (option: { value: string; label: string; metadata?: any }) => {
    if (!option.metadata) return option.label;

    return (
      <div className="flex items-center justify-between w-full">
        <div className="flex flex-col">
          <span className="font-medium">{option.label}</span>
        </div>
        <Badge variant="secondary" className="ml-2 shrink-0">
          {formatNumber(option.metadata.quantity)} disponível
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
              async
              queryKey={["items", "borrow-multi-selector"]}
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
              searchable
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
