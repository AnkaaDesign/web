import { useState, useMemo, useEffect } from "react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { useItems } from "../../../../hooks";
import type { BorrowCreateFormData, BorrowUpdateFormData } from "../../../../schemas";
import { formatNumber } from "../../../../utils";
import type { Item } from "../../../../types";
import { toast } from "sonner";
import { StockStatusIndicator } from "@/components/inventory/item/list/stock-status-indicator";

interface ItemSelectorProps {
  control: any;
  name?: string;
  disabled?: boolean;
  selectedItemId?: string;
}

export function BorrowItemSelector({ control, name = "itemId", disabled, selectedItemId }: ItemSelectorProps) {
  const [search] = useState("");

  // Fetch items with their current quantities - only active tools
  const {
    data: itemsResponse,
    isLoading,
    error,
  } = useItems({
    where: {
      isActive: true,
      quantity: { gt: 0 }, // Only show items with available stock
      itemCategory: {
        type: "TOOL", // Only show tools that can be borrowed
      },
    },
    orderBy: { name: "asc" },
    take: 200, // Increased limit for better selection
    include: {
      itemCategory: true, // Include category for validation
      brand: true, // Include brand for better display
      orderItems: {
        include: {
          order: true,
        },
      },
    },
  });

  const items = itemsResponse?.data || [];

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!search) return items;

    const searchLower = search.toLowerCase();
    return items.filter((item: Item) => item.name.toLowerCase().includes(searchLower) || (item.uniCode && item.uniCode.toLowerCase().includes(searchLower)));
  }, [items, search]);

  // Get selected item for displaying available quantity
  const selectedItem = items.find((item: Item) => item.id === selectedItemId);

  const itemOptions = filteredItems.map((item: Item) => ({
    value: item.id,
    label: item.uniCode ? `${item.uniCode} - ${item.name}` : item.name,
    searchableText: `${item.uniCode || ""} ${item.name} ${item.brand?.name || ""} ${item.itemCategory?.name || ""}`.toLowerCase(),
    quantity: item.quantity,
    category: item.itemCategory?.name,
    brand: item.brand?.name,
    isActive: item.isActive,
  }));

  // Show warning if no tools are available
  const hasNoAvailableTools = !isLoading && itemOptions.length === 0;

  // Validate selected item
  useEffect(() => {
    if (selectedItem) {
      // Check if item is still active
      if (!selectedItem.isActive) {
        toast.error("Item selecionado está inativo");
      }
      // Check if item has stock
      if (selectedItem.quantity <= 0) {
        toast.error("Item selecionado não possui estoque disponível");
      }
      // Check if item is a tool
      if (selectedItem.itemCategory?.type !== "TOOL") {
        toast.error("Apenas ferramentas podem ser emprestadas");
      }
    }
  }, [selectedItem]);

  // Custom render function for item options
  const renderItemOption = (option: any, isSelected: boolean) => {
    const item = filteredItems.find((i) => i.id === option.value);
    if (!item) return option.label;

    return (
      <div className="flex items-center justify-between w-full">
        <span className="truncate">{option.label}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <StockStatusIndicator item={item} showQuantity={true} className="text-sm" />
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
              value={field.value || ""}
              onValueChange={field.onChange}
              options={itemOptions}
              placeholder="Selecione um item"
              emptyText="Nenhum item disponível"
              disabled={disabled || isLoading}
              renderOption={renderItemOption}
            />
          </FormControl>
          {selectedItem && (
            <FormDescription className="space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <StockStatusIndicator item={selectedItem} showQuantity={true} />
                  <span className="text-muted-foreground">{selectedItem.measureUnit || "unidade(s)"}</span>
                </div>
                {selectedItem.itemCategory && (
                  <Badge variant="secondary" className="text-xs">
                    {selectedItem.itemCategory.name}
                  </Badge>
                )}
                {selectedItem.brand && (
                  <Badge variant="outline" className="text-xs">
                    {selectedItem.brand.name}
                  </Badge>
                )}
              </div>
            </FormDescription>
          )}
          {hasNoAvailableTools && (
            <FormDescription className="text-amber-600">⚠️ Nenhuma ferramenta disponível para empréstimo. Verifique se há ferramentas ativas com estoque.</FormDescription>
          )}
          {error && <FormDescription className="text-destructive">Erro ao carregar itens. Tente novamente.</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
