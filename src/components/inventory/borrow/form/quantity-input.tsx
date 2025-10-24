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
                const inputValue = e.target.value;

                // If empty, set to undefined (will be handled by default value or onBlur)
                if (inputValue === "" || inputValue === null || inputValue === undefined) {
                  field.onChange(undefined);
                  return;
                }

                const numericValue = Number(inputValue);

                // Validate input immediately
                if (!isNaN(numericValue) && typeof numericValue === "number") {
                  if (numericValue > availableQuantity && availableQuantity > 0) {
                    // Don't allow input beyond available quantity
                    field.onChange(availableQuantity);
                    return;
                  }
                  if (numericValue < 1) {
                    // Don't allow negative or zero values
                    field.onChange(1);
                    return;
                  }
                  // Set the valid numeric value
                  field.onChange(numericValue);
                } else {
                  // Invalid number, set to undefined
                  field.onChange(undefined);
                }
              }}
              onBlur={(e) => {
                // Ensure we have a valid number on blur
                const inputValue = e.target.value;
                const numericValue = Number(inputValue);

                if (inputValue === "" || isNaN(numericValue) || numericValue <= 0) {
                  // If empty or invalid, default to 1
                  field.onChange(1);
                } else if (numericValue > availableQuantity && availableQuantity > 0) {
                  // If exceeds available, cap at available quantity
                  field.onChange(availableQuantity);
                } else {
                  // Ensure the value is set as a number
                  field.onChange(numericValue);
                }
                field.onBlur();
              }}
              value={field.value ?? ""}
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
