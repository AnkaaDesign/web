import { FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconReload } from "@tabler/icons-react";
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
          <FormLabel className="flex items-center gap-2">
            <IconReload className="h-4 w-4" />
            Quantidade de Reposição {required && <span className="text-destructive">*</span>}
          </FormLabel>
          <FormControl>
            <Input type="number" min={1} placeholder="Quantidade de reposição" disabled={disabled} value={field.value} onChange={(value) => field.onChange(value)} transparent={true} />
          </FormControl>
          <FormDescription>Quantidade a ser solicitada quando atingir o ponto de reposição</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
