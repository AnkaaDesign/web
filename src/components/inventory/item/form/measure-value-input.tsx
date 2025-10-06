import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { ItemCreateFormData, ItemUpdateFormData } from "../../../../schemas";

interface MeasureValueInputProps {
  control: any;
  disabled?: boolean;
}

export function MeasureValueInput({ control, disabled }: MeasureValueInputProps) {
  return (
    <FormField
      control={control}
      name="measures.0.value"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Valor de Medida</FormLabel>
          <FormControl>
            <Input type="decimal" min={0} decimals={2} placeholder="0" disabled={disabled} value={field.value} onChange={(value) => field.onChange(value)} transparent={true} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
