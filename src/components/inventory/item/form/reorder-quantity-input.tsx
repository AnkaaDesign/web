import { FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { ItemCreateFormData, ItemUpdateFormData } from "../../../../schemas";

interface ReorderQuantityInputProps {
  control: any;
  disabled?: boolean;
  required?: boolean;
}

export function ReorderQuantityInput({ control, disabled, required }: ReorderQuantityInputProps) {
  return (
    <FormField
      control={control}
      name="reorderQuantity"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Quantidade de Reposição {required && <span className="text-destructive">*</span>}</FormLabel>
          <FormControl>
            <Input type="number" min={1} placeholder="Quantidade de reposição" disabled={disabled} value={field.value} onChange={(value) => field.onChange(value)} />
          </FormControl>
          <FormDescription>Quantidade a ser solicitada quando atingir o ponto de reposição</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
