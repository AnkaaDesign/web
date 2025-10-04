import { Control } from "react-hook-form";
import { ExpenseCreateFormData, ExpenseUpdateFormData } from "../../../../schemas";
import { EXPENSE_PAYMENT_METHOD, EXPENSE_PAYMENT_METHOD_LABELS } from "../../../../constants";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PaymentMethodSelectProps {
  control: Control<ExpenseCreateFormData | ExpenseUpdateFormData>;
}

export function PaymentMethodSelect({ control }: PaymentMethodSelectProps) {
  return (
    <FormField
      control={control}
      name="paymentMethod"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Método de Pagamento</FormLabel>
          <Select onValueChange={field.onChange} defaultValue={field.value}>
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um método" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectItem value="">Não informado</SelectItem>
              {Object.values(EXPENSE_PAYMENT_METHOD).map((method) => (
                <SelectItem key={method} value={method}>
                  {EXPENSE_PAYMENT_METHOD_LABELS[method]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}