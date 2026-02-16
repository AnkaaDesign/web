import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconCertificate } from "@tabler/icons-react";
import { useFormContext } from "react-hook-form";
import type { SupplierCreateFormData, SupplierUpdateFormData } from "../../../../schemas";

type FormData = SupplierCreateFormData | SupplierUpdateFormData;

interface CorporateNameInputProps {
  disabled?: boolean;
}

export function CorporateNameInput({ disabled }: CorporateNameInputProps) {
  const form = useFormContext<FormData>();

  return (
    <FormField
      control={form.control}
      name="corporateName"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconCertificate className="h-4 w-4" />
            Razão Social
          </FormLabel>
          <FormControl>
            <Input
              ref={field.ref}
              value={field.value || ""}
              onChange={(value: string | number | null) => field.onChange(typeof value === 'string' ? (value || null) : (value === null ? null : String(value)))}
              onBlur={field.onBlur}
              placeholder="Ex: Fornecedor ABC Comercial Ltda"
              disabled={disabled}
              transparent={true}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
