import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { IconPlus, IconTrash, IconMinus } from "@tabler/icons-react";
import { PPE_TYPE, PPE_TYPE_LABELS, PPE_TYPE_ORDER } from "../../../../constants";
import type { PpeScheduleItemInput } from "../../../../types";
import { useMemo, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { getItems } from "../../../../api-client";

interface PpeItemsConfigurationProps {
  value: PpeScheduleItemInput[];
  onChange: (value: PpeScheduleItemInput[]) => void;
  className?: string;
}

// Default quantity for all PPE types
const DEFAULT_QUANTITY = 1;
const MIN_QUANTITY = 1;
const MAX_QUANTITY = 99;

export function PpeItemsConfiguration({ value = [], onChange, className }: PpeItemsConfigurationProps) {
  const itemCacheRef = useRef<Map<string, { label: string; value: string }>>(new Map());

  // Create a sorted index map for display order, but always work with original indices
  const sortedIndices = useMemo(() => {
    return value
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        const orderA = PPE_TYPE_ORDER[a.item.ppeType] || 999;
        const orderB = PPE_TYPE_ORDER[b.item.ppeType] || 999;
        if (orderA !== orderB) return orderA - orderB;
        // For same type (OTHERS), sort by itemId
        return (a.item.itemId || "").localeCompare(b.item.itemId || "");
      })
      .map(({ index }) => index);
  }, [value]);

  const addNewRow = useCallback(() => {
    // Find first unused PPE type (excluding OTHERS which can be added multiple times)
    const usedNonOthersTypes = new Set(
      value.filter((item) => item.ppeType !== PPE_TYPE.OTHERS).map((item) => item.ppeType)
    );
    const availableTypes = Object.values(PPE_TYPE).filter(
      (type) => type === PPE_TYPE.OTHERS || !usedNonOthersTypes.has(type)
    );

    if (availableTypes.length > 0) {
      // Prefer non-OTHERS type if available
      const firstAvailable = availableTypes.find((t) => t !== PPE_TYPE.OTHERS) || PPE_TYPE.OTHERS;
      const newItem: PpeScheduleItemInput = {
        ppeType: firstAvailable,
        quantity: DEFAULT_QUANTITY,
      };
      onChange([...value, newItem]);
    }
  }, [value, onChange]);

  const removePpeItem = useCallback((index: number) => {
    const newValue = value.filter((_, i) => i !== index);
    onChange(newValue);
  }, [value, onChange]);

  const updatePpeItem = useCallback((index: number, updates: Partial<PpeScheduleItemInput>) => {
    const updatedValue = value.map((item, i) => {
      if (i !== index) return item;
      const newItem = { ...item, ...updates };
      // Clear itemId when switching away from OTHERS
      if (updates.ppeType && updates.ppeType !== PPE_TYPE.OTHERS) {
        delete newItem.itemId;
      }
      return newItem;
    });
    onChange(updatedValue);
  }, [value, onChange]);

  const getAvailableTypes = useCallback((currentIndex: number) => {
    // For non-OTHERS types, each type can only be used once
    const usedNonOthersTypes = new Set(
      value
        .filter((item, index) => index !== currentIndex && item.ppeType !== PPE_TYPE.OTHERS)
        .map((item) => item.ppeType)
    );
    // OTHERS is always available (can add multiple with different items)
    return Object.values(PPE_TYPE).filter(
      (type) => type === PPE_TYPE.OTHERS || !usedNonOthersTypes.has(type)
    );
  }, [value]);

  const handleQuantityChange = useCallback((index: number, newQuantity: number) => {
    const clampedQty = Math.max(MIN_QUANTITY, Math.min(MAX_QUANTITY, newQuantity));
    updatePpeItem(index, { quantity: clampedQty });
  }, [updatePpeItem]);

  const incrementQuantity = useCallback((index: number) => {
    const currentQty = value[index]?.quantity ?? DEFAULT_QUANTITY;
    if (currentQty < MAX_QUANTITY) {
      handleQuantityChange(index, currentQty + 1);
    }
  }, [value, handleQuantityChange]);

  const decrementQuantity = useCallback((index: number) => {
    const currentQty = value[index]?.quantity ?? DEFAULT_QUANTITY;
    if (currentQty > MIN_QUANTITY) {
      handleQuantityChange(index, currentQty - 1);
    }
  }, [value, handleQuantityChange]);

  // Query items with ppeType = OTHERS for the item selector
  const queryOthersItems = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const response = await getItems({
        ppeType: PPE_TYPE.OTHERS,
        isActive: true,
        searchingFor: searchTerm?.trim() || undefined,
        orderBy: { name: "asc" },
        page,
        limit: 50,
      });
      const items = response.data || [];
      const options = items.map((item) => {
        const option = { value: item.id, label: item.name };
        itemCacheRef.current.set(item.id, option);
        return option;
      });
      return { data: options, hasMore: response.meta?.hasNextPage || false };
    } catch {
      return { data: [], hasMore: false };
    }
  }, []);

  // Check if all non-OTHERS types are used (OTHERS can always be added)
  const canAddMore = true; // Always allow adding (OTHERS can be added multiple times)

  return (
    <div className={cn("space-y-3 w-full", className)}>
      {/* Items list */}
      {sortedIndices.map((originalIndex) => {
        const item = value[originalIndex];
        if (!item) return null;

        const isOthersType = item.ppeType === PPE_TYPE.OTHERS;
        const itemKey = isOthersType
          ? `${item.ppeType}-${item.itemId || originalIndex}-${originalIndex}`
          : `${item.ppeType}-${originalIndex}`;

        // Always read quantity from the source of truth (value array)
        const currentQuantity = item.quantity ?? DEFAULT_QUANTITY;
        const canDecrement = currentQuantity > MIN_QUANTITY;
        const canIncrement = currentQuantity < MAX_QUANTITY;

        return (
          <div key={itemKey} className="space-y-1.5">
            <div className={cn(
              "grid items-center gap-1.5 w-full",
              isOthersType
                ? "grid-cols-[1fr,1fr,auto,auto,auto,auto]" // PPE Type (50%) | Item (50%) | - | qty | + | trash
                : "grid-cols-[1fr,auto,auto,auto,auto]"      // PPE Type (100%) | - | qty | + | trash
            )}>
              {/* PPE Type combobox */}
              <Combobox
                value={item.ppeType}
                onValueChange={(newType) => updatePpeItem(originalIndex, { ppeType: newType as PPE_TYPE })}
                options={getAvailableTypes(originalIndex).map((type) => ({
                  label: PPE_TYPE_LABELS[type],
                  value: type,
                }))}
                placeholder="Selecione o EPI"
                searchPlaceholder="Buscar..."
              />

              {/* Item selector for OTHERS type - inline on the same row */}
              {isOthersType && (
                <Combobox
                  async={true}
                  mode="single"
                  queryKey={["items-others"]}
                  queryFn={queryOthersItems}
                  initialOptions={item.itemId && itemCacheRef.current.has(item.itemId)
                    ? [itemCacheRef.current.get(item.itemId)!]
                    : []
                  }
                  value={item.itemId || ""}
                  onValueChange={(newItemId) => updatePpeItem(originalIndex, { itemId: newItemId || undefined })}
                  placeholder="Selecione o item..."
                  searchable={true}
                  minSearchLength={0}
                  pageSize={50}
                  debounceMs={300}
                />
              )}

              {/* - button */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 w-9 p-0 shrink-0"
                onClick={() => decrementQuantity(originalIndex)}
                disabled={!canDecrement}
              >
                <IconMinus className="h-4 w-4" />
              </Button>

              {/* quantity input */}
              <Input
                type="number"
                min={MIN_QUANTITY}
                max={MAX_QUANTITY}
                value={currentQuantity}
                onChange={(e) => {
                  const inputValue = e.target.value;
                  // Allow empty input temporarily for better UX when typing
                  if (inputValue === "") {
                    return;
                  }
                  const qty = parseInt(inputValue, 10);
                  if (!isNaN(qty)) {
                    handleQuantityChange(originalIndex, qty);
                  }
                }}
                onBlur={(e) => {
                  // On blur, ensure we have a valid value
                  const inputValue = e.target.value;
                  const qty = parseInt(inputValue, 10);
                  if (isNaN(qty) || qty < MIN_QUANTITY) {
                    handleQuantityChange(originalIndex, MIN_QUANTITY);
                  } else if (qty > MAX_QUANTITY) {
                    handleQuantityChange(originalIndex, MAX_QUANTITY);
                  }
                }}
                className="w-16 text-center h-9 shrink-0 bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />

              {/* + button */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 w-9 p-0 shrink-0"
                onClick={() => incrementQuantity(originalIndex)}
                disabled={!canIncrement}
              >
                <IconPlus className="h-4 w-4" />
              </Button>

              {/* delete icon */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removePpeItem(originalIndex)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 h-9 w-9 p-0 shrink-0"
              >
                <IconTrash className="h-4 w-4" />
              </Button>
            </div>

            {/* Validation message for OTHERS type without item selected */}
            {isOthersType && !item.itemId && (
              <p className="text-xs text-destructive ml-1">Selecione um item para o tipo "Outros"</p>
            )}
          </div>
        );
      })}

      {/* Add button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addNewRow}
        disabled={!canAddMore}
        className="w-full"
      >
        <IconPlus className="h-4 w-4 mr-2" />
        Adicionar EPI
      </Button>

      {/* Helper text explaining automatic size matching */}
      {value.length > 0 && (
        <div className="mt-2 p-3 bg-muted/50 rounded-md border border-border">
          <p className="text-xs text-muted-foreground">
            <span className="font-enhanced-unicode">ℹ</span> Os tamanhos dos EPIs serão automaticamente correspondidos com base na configuração de tamanhos de cada funcionário. Para "Outros", selecione o item específico a ser entregue.
          </p>
        </div>
      )}
    </div>
  );
}
