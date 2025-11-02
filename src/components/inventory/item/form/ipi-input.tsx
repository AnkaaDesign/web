import { useState } from "react";
import type { Control, UseFormWatch } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import type { ItemCreateFormData, ItemUpdateFormData } from "../../../../schemas";

interface IpiInputProps {
  control: Control<ItemCreateFormData | ItemUpdateFormData>;
  disabled?: boolean;
  required?: boolean;
  priceFieldName?: "price";
  onPriceUpdate?: (newPrice: number) => void;
  watch?: UseFormWatch<ItemCreateFormData | ItemUpdateFormData>;
}

export function IpiInput({ control, disabled, required, priceFieldName, onPriceUpdate, watch }: IpiInputProps) {
  const [taxIncluded, setTaxIncluded] = useState(false);

  const handleTaxIncludedChange = (checked: boolean, currentPrice: number, ipiRate: number) => {
    setTaxIncluded(checked);

    if (checked && currentPrice && ipiRate && onPriceUpdate) {
      // Subtract IPI percentage from price: newPrice = price - (price * ipi/100)
      const ipiAmount = currentPrice * (ipiRate / 100);
      const newPrice = currentPrice - ipiAmount;
      onPriceUpdate(Math.round(newPrice * 100) / 100);
    }
  };

  return (
    <FormField
      control={control}
      name="ipi"
      render={({ field }) => (
        <FormItem>
          <FormLabel>IPI {required && <span className="text-destructive">*</span>}</FormLabel>
          <FormControl>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  type="decimal"
                  min={0}
                  max={100}
                  value={field.value ?? 0}
                  onChange={(value) => {
                    // IMPORTANT: Custom Input component passes value directly, not event object
                    field.onChange(value);
                  }}
                  placeholder="0"
                  disabled={disabled}
                  className="flex-1 bg-transparent"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              {priceFieldName && onPriceUpdate && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="ipi-included"
                    checked={taxIncluded}
                    onCheckedChange={(checked) => {
                      if (priceFieldName && watch) {
                        const currentPrice = watch(priceFieldName) || 0;
                        handleTaxIncludedChange(checked as boolean, currentPrice, field.value || 0);
                      }
                    }}
                    disabled={disabled}
                  />
                  <label
                    htmlFor="ipi-included"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Imbutir no preço
                  </label>
                </div>
              )}
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
