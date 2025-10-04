import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { CnpjInput } from "@/components/ui/cnpj-input";
import { IconBuilding } from "@tabler/icons-react";
import { useFormContext, type Path } from "react-hook-form";

interface FormCNPJInputProps<T extends Record<string, any>> {
  name: Path<T>;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  description?: string;
  className?: string;
}

export function FormCNPJInput<T extends Record<string, any>>({
  name,
  label = "CNPJ",
  placeholder = "00.000.000/0000-00",
  disabled = false,
  required = false,
  description,
  className,
}: FormCNPJInputProps<T>) {
  const form = useFormContext<T>();

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field: { value, onChange, ...field } }) => (
        <FormItem className={className}>
          <FormLabel className="flex items-center gap-2">
            <IconBuilding className="h-4 w-4" />
            {label}
            {required && <span className="text-destructive">*</span>}
          </FormLabel>
          <FormControl>
            <CnpjInput
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