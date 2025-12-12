import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { CPFInput } from "@/components/ui/cpf-input";
import { IconIdBadge2 } from "@tabler/icons-react";
import { useFormContext, type Path } from "react-hook-form";

interface FormCPFInputProps<T extends Record<string, any>> {
  name: Path<T>;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  description?: string;
  className?: string;
}

export function FormCPFInput<T extends Record<string, any>>({
  name,
  label = "CPF",
  placeholder = "000.000.000-00",
  disabled = false,
  required = false,
  description,
  className,
}: FormCPFInputProps<T>) {
  const form = useFormContext<T>();

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field: { value, onChange, ...field } }) => (
        <FormItem className={className}>
          <FormLabel className="flex items-center gap-2">
            <IconIdBadge2 className="h-4 w-4" />
            {label}
            {required && <span className="text-destructive">*</span>}
          </FormLabel>
          <FormControl>
            <CPFInput
              {...field}
              value={value || ""}
              onChange={(newValue) => {
                // Convert empty string or undefined to null for consistent handling
                onChange(newValue === "" || newValue === undefined ? null : newValue);
              }}
              placeholder={placeholder}
              disabled={disabled}
            />
          </FormControl>
          {description && (
            <p className="text-sm text-muted-foreground">
              {description}
            </p>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}