import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconMapPin2 } from "@tabler/icons-react";
import { useFormContext } from "react-hook-form";
import type { SupplierCreateFormData, SupplierUpdateFormData } from "../../../../schemas";

type FormData = SupplierCreateFormData | SupplierUpdateFormData;

interface AddressComplementInputProps {
  disabled?: boolean;
}

export function AddressComplementInput({ disabled }: AddressComplementInputProps) {
  const form = useFormContext<FormData>();

  return (
    <FormField
      control={form.control}
      name="addressComplement"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconMapPin2 className="h-4 w-4" />
            Complemento
          </FormLabel>
          <FormControl>
            <Input
              ref={field.ref}
              value={field.value || ""}
              onChange={(value: string | number | null) => field.onChange(typeof value === 'string' ? (value || null) : (value === null ? null : String(value)))}
              onBlur={field.onBlur}
              placeholder="Ex: Sala 10, Bloco A"
              disabled={disabled}
              className="transition-all duration-200"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
