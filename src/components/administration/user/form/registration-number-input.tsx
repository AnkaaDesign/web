import { useFormContext } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconIdBadge2 } from "@tabler/icons-react";
import type { UserCreateFormData, UserUpdateFormData } from "../../../../schemas";

interface RegistrationNumberInputProps {
  disabled?: boolean;
}

export function RegistrationNumberInput({ disabled }: RegistrationNumberInputProps) {
  const form = useFormContext<UserCreateFormData | UserUpdateFormData>();

  return (
    <FormField
      control={form.control}
      name="payrollNumber"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconIdBadge2 className="h-4 w-4" />
            Número de Registro
          </FormLabel>
          <FormControl>
            <Input
              ref={field.ref}
              value={field.value || ""}
              onChange={(value: string) => {
                // Clean input to only alphanumeric characters and convert to uppercase
                const cleanedValue = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
                field.onChange(cleanedValue || null);
              }}
              onBlur={field.onBlur}
              placeholder="Ex: EMP001, REG123"
              disabled={disabled}
              maxLength={50}
              className="transition-all duration-200 "
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
