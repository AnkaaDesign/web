import type { PositionCreateFormData, PositionUpdateFormData } from "../../../../schemas";

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

interface NameInputProps {
  control: any;
  disabled?: boolean;
  required?: boolean;
}

export function NameInput({ control, disabled, required }: NameInputProps) {
  return (
    <FormField
      control={control}
      name="name"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Nome do Cargo {required && <span className="text-destructive">*</span>}</FormLabel>
          <FormControl>
            <Input value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} placeholder="Ex: Gerente de Vendas" disabled={disabled} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
