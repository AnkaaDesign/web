import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconCurrencyReal } from "@tabler/icons-react";
import { useFormContext, type Path } from "react-hook-form";

interface FormMoneyInputProps<T extends Record<string, any>> {
  name: Path<T>;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}

export function FormMoneyInput<T extends Record<string, any>>({
  name,
  label = "Valor",
  placeholder = "R$ 0,00",
  disabled = false,
  required = false,
}: FormMoneyInputProps<T>) {
  const form = useFormContext<T>();

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconCurrencyReal className="h-4 w-4" />
            {label}
            {required && <span className="text-destructive">*</span>}
          </FormLabel>
          <FormControl>
            <Input
              type="currency"
              value={field.value ?? ""}
              onChange={(value) => {
                field.onChange(value as any);
                form.setValue(name, value as any, { shouldDirty: true, shouldValidate: true });
              }}
              onBlur={field.onBlur}
              placeholder={placeholder}
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
