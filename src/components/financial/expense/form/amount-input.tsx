import { Control } from "react-hook-form";
import { ExpenseCreateFormData, ExpenseUpdateFormData } from "../../../../schemas";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "../../../../utils";

interface AmountInputProps {
  control: Control<ExpenseCreateFormData | ExpenseUpdateFormData>;
}

export function AmountInput({ control }: AmountInputProps) {
  return (
    <FormField
      control={control}
      name="amount"
      render={({ field: { onChange, value, ...field } }) => (
        <FormItem>
          <FormLabel>Valor *</FormLabel>
          <FormControl>
            <Input
              type="number"
              step="0.01"
              min="0"
              max="1000000"
              placeholder="0,00"
              value={value || ""}
              onChange={(e) => {
                const numValue = parseFloat(e.target.value);
                onChange(isNaN(numValue) ? 0 : numValue);
              }}
              {...field}
            />
          </FormControl>
          <FormMessage />
          {value > 0 && (
            <p className="text-sm text-muted-foreground">
              {formatCurrency(value)}
            </p>
          )}
        </FormItem>
      )}
    />
  );
}