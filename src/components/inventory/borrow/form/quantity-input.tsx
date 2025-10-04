import { useEffect } from "react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useItem } from "../../../../hooks";
import type { BorrowCreateFormData, BorrowUpdateFormData } from "../../../../schemas";
import { formatNumber } from "../../../../utils";

interface QuantityInputProps {
  control: any;
  name?: string;
  label?: string;
  disabled?: boolean;
  selectedItemId?: string;
  currentQuantity?: number;
}

export function QuantityInput({ control, name = "quantity", label, disabled, selectedItemId, currentQuantity }: QuantityInputProps) {
  // Fetch the selected item to get available quantity
  const { data: itemResponse } = useItem(selectedItemId || "", {
    enabled: !!selectedItemId,
  });

  const item = itemResponse?.data;
  const availableQuantity = item ? item.quantity + (currentQuantity || 0) : 0;

  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem>
          {label && <FormLabel>{label} *</FormLabel>}
          <FormControl>
            <Input
              type="number"
              min="1"
              max={availableQuantity || undefined}
              step="1"
              placeholder="1"
              {...field}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const value = e.target.value === "" ? "" : Number(e.target.value);

                // Validate input immediately
                if (value && typeof value === "number") {
                  if (value > availableQuantity && availableQuantity > 0) {
                    // Don't allow input beyond available quantity
                    field.onChange(availableQuantity);
                    return;
                  }
                  if (value < 1) {
                    // Don't allow negative or zero values
                    field.onChange(1);
                    return;
                  }
                }

                field.onChange(value);
              }}
              onBlur={(e) => {
                // Ensure we have a valid number on blur
                const value = Number(e.target.value);
                if (isNaN(value) || value <= 0) {
                  field.onChange(1);
                } else if (value > availableQuantity && availableQuantity > 0) {
                  field.onChange(availableQuantity);
                }
                field.onBlur();
              }}
              value={field.value || ""}
              disabled={disabled || !selectedItemId}
              className={fieldState.error ? "border-destructive" : ""}
            />
          </FormControl>
          {selectedItemId && item && (
            <FormDescription>
              {currentQuantity
                ? `Quantidade atual emprestada: ${formatNumber(currentQuantity)}. Disponível para ajuste: ${formatNumber(availableQuantity)}`
                : `Máximo disponível: ${formatNumber(item.quantity)}`}
              {item.measureUnit && ` ${item.measureUnit}`}
            </FormDescription>
          )}
          {!selectedItemId && <FormDescription>Selecione um item primeiro para definir a quantidade</FormDescription>}
          {fieldState.error && <FormMessage>{fieldState.error.message}</FormMessage>}
        </FormItem>
      )}
    />
  );
}
