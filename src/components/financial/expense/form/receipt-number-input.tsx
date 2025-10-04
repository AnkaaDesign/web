import { Control } from "react-hook-form";
import { ExpenseCreateFormData, ExpenseUpdateFormData } from "../../../../schemas";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

interface ReceiptNumberInputProps {
  control: Control<ExpenseCreateFormData | ExpenseUpdateFormData>;
}

export function ReceiptNumberInput({ control }: ReceiptNumberInputProps) {
  return (
    <FormField
      control={control}
      name="receiptNumber"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Número do Recibo</FormLabel>
          <FormControl>
            <Input
              placeholder="Ex: 123456"
              {...field}
              maxLength={100}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}