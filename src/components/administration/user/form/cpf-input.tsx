import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { CPFInput as CPFInputComponent } from "@/components/ui/cpf-input";
import { IconId } from "@tabler/icons-react";
import { useFormContext } from "react-hook-form";
import type { UserCreateFormData, UserUpdateFormData } from "../../../../schemas";

interface CPFInputProps {
  disabled?: boolean;
}

export function CPFInput({ disabled }: CPFInputProps) {
  const form = useFormContext<UserCreateFormData | UserUpdateFormData>();

  return (
    <FormField
      control={form.control}
      name="cpf"
      render={({ field: { value, onChange, ...field } }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconId className="h-4 w-4 text-muted-foreground" />
            CPF
          </FormLabel>
          <FormControl>
            <CPFInputComponent
              {...field}
              value={value || ""}
              onChange={(newValue) => {
                // Convert empty string or undefined to null for consistent handling
                onChange(newValue === "" || newValue === undefined ? null : newValue);
              }}
              placeholder="Digite o CPF do colaborador"
              disabled={disabled}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}