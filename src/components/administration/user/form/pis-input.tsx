import { useFormContext } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconCreditCard } from "@tabler/icons-react";
import { formatPIS } from "../../../../utils";
import type { UserCreateFormData, UserUpdateFormData } from "../../../../schemas";

interface PISInputProps {
  disabled?: boolean;
}

export function PISInput({ disabled }: PISInputProps) {
  const form = useFormContext<UserCreateFormData | UserUpdateFormData>();

  return (
    <FormField
      control={form.control}
      name="pis"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconCreditCard className="h-4 w-4 text-muted-foreground" />
            PIS
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              value={field.value ? formatPIS(field.value) : ""}
              onChange={(e) => {
                // Remove non-numeric characters and apply formatting
                const value = e.target.value.replace(/\D/g, "");
                field.onChange(value || null);
              }}
              placeholder="Digite o PIS do colaborador"
              disabled={disabled}
              maxLength={14} // 11 digits + 3 formatting chars
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}