import { Control } from "react-hook-form";
import { ExpenseCreateFormData, ExpenseUpdateFormData } from "../../../../schemas";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

interface VendorInputProps {
  control: Control<ExpenseCreateFormData | ExpenseUpdateFormData>;
}

export function VendorInput({ control }: VendorInputProps) {
  return (
    <FormField
      control={control}
      name="vendor"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Fornecedor</FormLabel>
          <FormControl>
            <Input
              placeholder="Ex: Posto de Combustível ABC"
              {...field}
              maxLength={255}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}