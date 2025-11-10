import React, { useCallback } from "react";
import { IconX as X } from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { Badge } from "@/components/ui/badge";
import { EXTERNAL_WITHDRAWAL_TYPE } from "../../../../constants";

interface ExternalWithdrawalItemCardProps {
  itemId: string;
  itemName: string;
  itemCode?: string | null;
  itemBrand?: string | null;
  itemCategory?: string | null;
  currentStock: number;
  itemPrice?: number | null;
  quantity: number;
  unitPrice?: number | null;
  type: EXTERNAL_WITHDRAWAL_TYPE;
  onQuantityChange: (quantity: number) => void;
  onPriceChange?: (price: number | undefined) => void;
  onRemove: () => void;
}

export function ExternalWithdrawalItemCard({
  itemId: _itemId,
  itemName,
  itemCode,
  itemBrand,
  itemCategory,
  currentStock,
  itemPrice,
  quantity,
  unitPrice,
  type,
  onQuantityChange,
  onPriceChange,
  onRemove,
}: ExternalWithdrawalItemCardProps) {
  // Calculate final stock after withdrawal
  const finalStock = currentStock - quantity;
  const isNegativeStock = finalStock < 0;

  // Handle quantity change with validation
  const handleQuantityChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newQuantity = Math.max(0.01, Number(e.target.value) || 0.01);
      onQuantityChange(newQuantity);
    },
    [onQuantityChange],
  );

  // Handle price change with validation
  const handlePriceChange = useCallback(
    (value: string | number | null) => {
      if (onPriceChange) {
        const price = typeof value === "number" ? value : undefined;
        onPriceChange(price);
      }
    },
    [onPriceChange],
  );

  // Get default price for display
  const displayPrice = unitPrice ?? itemPrice ?? 0;

  return (
    <div className="flex items-center gap-4 p-4 border rounded-lg">
      <div className="flex-1 min-w-0">
        {/* Item name and code */}
        <div className="flex items-center gap-2">
          <TruncatedTextWithTooltip text={itemCode ? `${itemCode} - ${itemName}` : itemName} className="font-medium" />
        </div>

        {/* Brand and category */}
        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
          {itemBrand && <span>Marca: {itemBrand}</span>}
          {itemCategory && <span>Categoria: {itemCategory}</span>}
        </div>

        {/* Stock information */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
          <span>Estoque atual: {currentStock}</span>
          <span className={isNegativeStock ? "text-destructive font-medium" : ""}>Estoque após retirada: {finalStock}</span>
        </div>

        {/* Price information (only if type is CHARGEABLE) */}
        {type === EXTERNAL_WITHDRAWAL_TYPE.CHARGEABLE && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
            <span>Preço item: R$ {(itemPrice ?? 0).toFixed(2)}</span>
            {unitPrice && unitPrice !== itemPrice && (
              <Badge variant="outline" className="text-xs">
                Preço personalizado
              </Badge>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Quantity input */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Quantidade</span>
          <Input
            type="decimal"
            decimals={2}
            value={quantity}
            onChange={(value) => handleQuantityChange({ target: { value: value?.toString() || "0" } } as any)}
            min={0.01}
            className="w-24"
            placeholder="Qtd"
          />
        </div>

        {/* Price input (only if type is CHARGEABLE) */}
        {type === EXTERNAL_WITHDRAWAL_TYPE.CHARGEABLE && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Preço unitário</span>
            <div className="w-32">
              <Input type="currency" value={displayPrice} onChange={handlePriceChange} placeholder="R$ 0,00" />
            </div>
          </div>
        )}

        {/* Remove button */}
        <Button type="button" variant="ghost" size="icon" onClick={onRemove} className="self-end" title="Remover item">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
