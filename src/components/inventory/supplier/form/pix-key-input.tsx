import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconCreditCard } from "@tabler/icons-react";
import { useFormContext } from "react-hook-form";
import { formatPixKey } from "@/utils/formatters";
import type { SupplierCreateFormData, SupplierUpdateFormData } from "../../../../schemas";

type FormData = SupplierCreateFormData | SupplierUpdateFormData;

interface PixKeyInputProps {
  disabled?: boolean;
}

export function PixKeyInput({ disabled }: PixKeyInputProps) {
  const form = useFormContext<FormData>();

  return (
    <FormField
      control={form.control}
      name="pix"
      render={({ field: { value, onChange, onBlur, ref } }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconCreditCard className="h-4 w-4" />
            Chave Pix
          </FormLabel>
          <FormControl>
            <Input
              ref={ref}
              value={value || ""}
              placeholder="CPF, CNPJ, E-mail, Telefone ou Chave Aleatória"
              disabled={disabled}
              transparent={true}
              onChange={(inputValue) => {
                const val = inputValue as string | null;
                onChange(val === "" || val === null ? null : val);
              }}
              onBlur={() => {
                const currentValue = value as string | null;
                if (currentValue && currentValue.trim() !== "") {
                  const formatted = formatPixKey(currentValue);
                  if (formatted !== currentValue) {
                    onChange(formatted);
                  }
                }
                onBlur();
              }}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
