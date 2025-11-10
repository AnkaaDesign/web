import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconMapPin } from "@tabler/icons-react";
import { useFormContext } from "react-hook-form";
import type { SupplierCreateFormData, SupplierUpdateFormData } from "../../../../schemas";

type FormData = SupplierCreateFormData | SupplierUpdateFormData;

interface AddressInputProps {
  disabled?: boolean;
}

export function AddressInput({ disabled }: AddressInputProps) {
  const form = useFormContext<FormData>();

  return (
    <FormField
      control={form.control}
      name="address"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconMapPin className="h-4 w-4" />
            Endereço *
          </FormLabel>
          <FormControl>
            <Input
              value={field.value || ""}
              onChange={(value) => {
                field.onChange(value);
              }}
              name={field.name}
              onBlur={field.onBlur}
              ref={field.ref}
              placeholder="Digite o endereço completo..."
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
