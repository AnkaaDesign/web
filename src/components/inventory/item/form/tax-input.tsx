import type { Control } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { ItemCreateFormData, ItemUpdateFormData } from "../../../../schemas";

interface TaxInputProps {
  control: Control<ItemCreateFormData | ItemUpdateFormData>;
  disabled?: boolean;
  required?: boolean;
}

export function TaxInput({ control, disabled, required }: TaxInputProps) {
  return (
    <FormField
      control={control}
      name="tax"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Taxa {required && <span className="text-destructive">*</span>}</FormLabel>
          <FormControl>
            <div className="flex items-center gap-2">
              <Input
                {...field}
                type="number"
                min="0"
                max="100"
                step="0.01"
                placeholder="0"
                disabled={disabled}
                onChange={(e) => field.onChange(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
