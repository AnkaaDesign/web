import { FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconAlertTriangle } from "@tabler/icons-react";
import type { ItemCreateFormData, ItemUpdateFormData } from "../../../../schemas";

interface ReorderPointInputProps {
  control: any;
  disabled?: boolean;
  required?: boolean;
}

export function ReorderPointInput({ control, disabled, required }: ReorderPointInputProps) {
  return (
    <FormField
      control={control}
      name="reorderPoint"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconAlertTriangle className="h-4 w-4" />
            Ponto de Reposição {required && <span className="text-destructive">*</span>}
          </FormLabel>
          <FormControl>
            <Input type="number" min={0} placeholder="0" disabled={disabled} value={field.value} onChange={(value) => field.onChange(value)} transparent={true} />
          </FormControl>
          <FormDescription>Quantidade mínima em estoque para gerar alerta de reposição</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
