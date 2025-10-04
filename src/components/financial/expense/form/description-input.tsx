import { Control } from "react-hook-form";
import { ExpenseCreateFormData, ExpenseUpdateFormData } from "../../../../schemas";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

interface DescriptionInputProps {
  control: Control<ExpenseCreateFormData | ExpenseUpdateFormData>;
}

export function DescriptionInput({ control }: DescriptionInputProps) {
  return (
    <FormField
      control={control}
      name="description"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Descrição *</FormLabel>
          <FormControl>
            <Input
              placeholder="Ex: Combustível para veículo da empresa"
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