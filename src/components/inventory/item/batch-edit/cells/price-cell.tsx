import React from "react";
import { Input } from "@/components/ui/input";
import { FormField, FormItem, FormControl, FormMessage } from "@/components/ui/form";
import { formatCurrency } from "../../../../../utils";
import { IconAlertTriangle } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface PriceCellProps {
  control: any;
  index: number;
  disabled?: boolean;
  required?: boolean;
  min?: number;
  max?: number;
  fieldName?: string;
}

export function PriceCell({ control, index, disabled = false, required = false, min = 0, max, fieldName = "totalPrice" }: PriceCellProps) {
  const name = `items.${index}.data.${fieldName}`;

  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const hasError = !!fieldState.error;
        const value = field.value;
        const isZero = value === 0;
        const isNegative = value < 0;
        const exceedsMax = max !== undefined && value > max;
        const belowMin = min !== undefined && value < min;

        const hasWarning = (required && isZero) || isNegative || exceedsMax || belowMin;

        return (
          <FormItem>
            <FormControl>
              <div className="relative">
                <Input
                  type="currency"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  disabled={disabled}
                  className={cn(
                    "h-10",
                    hasError && "border-destructive focus-visible:ring-destructive",
                    hasWarning && !hasError && "border-amber-500 focus-visible:ring-amber-500",
                  )}
                  placeholder="R$ 0,00"
                  title={hasError ? fieldState.error?.message : hasWarning ? "Atenção: verifique o valor inserido" : undefined}
                  ref={field.ref}
                  name={field.name}
                />

                {/* Warning/Error Icon */}
                {(hasError || hasWarning) && (
                  <IconAlertTriangle className={cn("absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4", hasError ? "text-destructive" : "text-amber-500")} />
                )}
              </div>
            </FormControl>

            {/* Show field error if exists */}
            <FormMessage />

            {/* Show validation warnings */}
            {!hasError && hasWarning && (
              <div className="text-xs text-amber-600 mt-1">
                {required && isZero && "⚠️ Preço obrigatório"}
                {isNegative && "⚠️ Preço não pode ser negativo"}
                {exceedsMax && `⚠️ Preço não pode exceder ${formatCurrency(max!)}`}
                {belowMin && `⚠️ Preço deve ser maior que ${formatCurrency(min!)}`}
              </div>
            )}
          </FormItem>
        );
      }}
    />
  );
}
