import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useFormContext } from "react-hook-form";
import type { ItemCreateFormData, ItemUpdateFormData } from "../../../../schemas";

type FormData = ItemCreateFormData | ItemUpdateFormData;

interface LeadTimeInputProps {
  disabled?: boolean;
}

export function LeadTimeInput({ disabled }: LeadTimeInputProps) {
  const form = useFormContext<FormData>();

  return (
    <FormField
      control={form.control}
      name="estimatedLeadTime"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Prazo de Entrega Estimado</FormLabel>
          <FormControl>
            <div className="flex items-center gap-2">
              <Input type="number" min={1} step={1} placeholder="30" disabled={disabled} value={field.value} onChange={(value) => field.onChange(value)} transparent={false} className="flex-1" />
              <span className="text-sm text-muted-foreground">dias</span>
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
