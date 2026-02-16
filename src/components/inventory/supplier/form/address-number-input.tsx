import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconHash } from "@tabler/icons-react";
import { useFormContext } from "react-hook-form";
import type { SupplierCreateFormData, SupplierUpdateFormData } from "../../../../schemas";

type FormData = SupplierCreateFormData | SupplierUpdateFormData;

interface AddressNumberInputProps {
  disabled?: boolean;
}

export function AddressNumberInput({ disabled }: AddressNumberInputProps) {
  const form = useFormContext<FormData>();

  return (
    <FormField
      control={form.control}
      name="addressNumber"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconHash className="h-4 w-4" />
            Número
          </FormLabel>
          <FormControl>
            <Input
              ref={field.ref}
              value={field.value || ""}
              onChange={(value: string | number | null) => field.onChange(typeof value === 'string' ? (value || null) : (value === null ? null : String(value)))}
              onBlur={field.onBlur}
              placeholder="Ex: 123"
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
