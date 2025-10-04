import { useFormContext } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconHash } from "@tabler/icons-react";
import type { UserCreateFormData, UserUpdateFormData } from "../../../../schemas";

interface PayrollNumberInputProps {
  disabled?: boolean;
}

export function PayrollNumberInput({ disabled }: PayrollNumberInputProps) {
  const form = useFormContext<UserCreateFormData | UserUpdateFormData>();

  return (
    <FormField
      control={form.control}
      name="payrollNumber"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconHash className="h-4 w-4 text-muted-foreground" />
            Número da Folha de Pagamento
          </FormLabel>
          <FormControl>
            <Input
              value={field.value ?? ""}
              onChange={(newValue) => {
                // Input component passes the cleaned string value, not an event
                // Clean the value to only numbers
                const stringValue = String(newValue || "");
                const cleaned = stringValue.replace(/[^0-9]/g, "");
                const numberValue = cleaned ? parseInt(cleaned, 10) : null;

                // Update form state
                form.setValue("payrollNumber", numberValue, { shouldDirty: true, shouldValidate: true });
              }}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
              placeholder="Digite o número da folha de pagamento"
              disabled={disabled}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={10}
              transparent={true}
              className="transition-all duration-200"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
