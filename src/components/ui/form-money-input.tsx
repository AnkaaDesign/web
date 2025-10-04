import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { CurrencyInput } from "@/components/ui/currency-input";
import { IconCurrencyReal } from "@tabler/icons-react";
import { useFormContext } from "react-hook-form";

interface FormMoneyInputProps {
  name: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export function FormMoneyInput({
  name,
  label = "Valor",
  placeholder = "R$ 0,00",
  disabled = false,
  required = false,
  className,
}: FormMoneyInputProps) {
  const form = useFormContext();

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel className="flex items-center gap-2">
            <IconCurrencyReal className="h-4 w-4 text-muted-foreground" />
            {label}
            {required && <span className="text-destructive">*</span>}
          </FormLabel>
          <FormControl>
            <CurrencyInput
              value={field.value}
              onChange={field.onChange}
              placeholder={placeholder}
              disabled={disabled}
              className="transition-all duration-200 focus:ring-2 focus:ring-ring/20"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}