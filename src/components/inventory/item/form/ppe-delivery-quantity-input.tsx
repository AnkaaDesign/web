import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconHash } from "@tabler/icons-react";

interface PpeDeliveryQuantityInputProps {
  control: any;
  name?: string;
  disabled?: boolean;
  required?: boolean;
}

export function PpeDeliveryQuantityInput({ control, name = "ppeConfig.standardQuantity", disabled, required = false }: PpeDeliveryQuantityInputProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconHash className="h-4 w-4" />
            Quantidade Padrão de Entrega
            {required && <span className="text-destructive ml-1">*</span>}
          </FormLabel>
          <FormControl>
            <Input type="number" min={1} placeholder="Ex: 2" disabled={disabled} value={field.value} onChange={(value) => field.onChange(value)} transparent={true} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
