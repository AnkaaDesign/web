import { useMemo, useEffect, useCallback } from "react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "../../../../utils";
import type { Item } from "../../../../types";
import { toast } from "sonner";
import { StockStatusIndicator } from "@/components/inventory/item/list/stock-status-indicator";
import { getItems } from "../../../../api-client";

interface ItemSelectorProps {
  control: any;
  name?: string;
  disabled?: boolean;
  selectedItemId?: string;
  initialItem?: Item;
}

export function BorrowItemSelector({ control, name = "itemId", disabled, selectedItemId, initialItem }: ItemSelectorProps) {
  // Memoize initialOptions with stable dependency
  const initialOptions = useMemo(() => {
    if (!initialItem) return [];

    return [{
      value: initialItem.id,
      label: initialItem.uniCode ? `${initialItem.uniCode} - ${initialItem.name}` : initialItem.name,
      description: `Estoque: ${initialItem.quantity || 0}`,
    }];
  }, [initialItem?.id]);

  // Async query function for Combobox with pagination
  const queryFn = useCallback(async (searchTerm: string, page: number = 1) => {
    const pageSize = 50;
    const response = await getItems({
      take: pageSize,
      skip: (page - 1) * pageSize,
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
      orderBy: { name: "asc" },
      include: {
        category: true,
        brand: true,
      },
    });

    const items = response.data || [];
    const total = response.total || 0;
    const hasMore = (page * pageSize) < total;

    return {
      data: items.map((item) => ({
        value: item.id,
        label: item.uniCode ? `${item.uniCode} - ${item.name}` : item.name,
        description: `Estoque: ${item.quantity || 0}`,
        metadata: {
          quantity: item.quantity,
          category: item.category,
          brand: item.brand,
          isActive: item.isActive,
        },
      })),
      hasMore,
      total,
    };
  }, []);

  // Custom render function for item options
  const renderItemOption = (option: any) => {
    const metadata = option.metadata;
    if (!metadata) return option.label;

    return (
      <div className="flex items-center justify-between w-full">
        <span className="truncate">{option.label}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge variant="secondary" className="text-xs">
            {formatNumber(metadata.quantity)} disponível
          </Badge>
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
          <FormLabel>Item *</FormLabel>
          <FormControl>
            <Combobox
              async
              queryKey={["items", "borrow-selector"]}
              queryFn={queryFn}
              initialOptions={initialOptions}
              minSearchLength={0}
              pageSize={50}
              debounceMs={300}
              value={field.value || ""}
              onValueChange={field.onChange}
              placeholder="Selecione um item"
              emptyText="Nenhum item disponível"
              disabled={disabled}
              renderOption={renderItemOption}
              searchable
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
