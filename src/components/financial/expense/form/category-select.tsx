import { Control } from "react-hook-form";
import { ExpenseCreateFormData, ExpenseUpdateFormData } from "../../../../schemas";
import { EXPENSE_CATEGORY, EXPENSE_CATEGORY_LABELS } from "../../../../constants";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CategorySelectProps {
  control: Control<ExpenseCreateFormData | ExpenseUpdateFormData>;
}

export function CategorySelect({ control }: CategorySelectProps) {
  return (
    <FormField
      control={control}
      name="category"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Categoria *</FormLabel>
          <Select onValueChange={field.onChange} defaultValue={field.value}>
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {Object.values(EXPENSE_CATEGORY).map((category) => (
                <SelectItem key={category} value={category}>
                  {EXPENSE_CATEGORY_LABELS[category]}
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