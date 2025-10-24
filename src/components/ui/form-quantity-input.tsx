import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconHash } from "@tabler/icons-react";
import { useFormContext } from "react-hook-form";

interface FormQuantityInputProps {
  name: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  min?: number;
  max?: number;
  step?: number;
  integer?: boolean;
  transparent?: boolean;
}

export function FormQuantityInput({
  name,
  label = "Quantidade",
  placeholder = "0",
  disabled = false,
  required = false,
  className,
  min = 0,
  max,
  step = 1,
  integer = false,
  transparent = true,
}: FormQuantityInputProps) {
  const form = useFormContext();

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => {
        const handleChange = (value: string | number | null) => {
          if (value === null || value === "" || value === undefined) {
            field.onChange(null);
            return;
          }

          const numericValue = integer ? parseInt(String(value), 10) : parseFloat(String(value));

          if (isNaN(numericValue)) {
            return;
          }

          // Apply min/max constraints
          let constrainedValue = numericValue;
          if (min !== undefined && constrainedValue < min) {
            constrainedValue = min;
          }
          if (max !== undefined && constrainedValue > max) {
            constrainedValue = max;
          }

          field.onChange(constrainedValue);
        };

        return (
          <FormItem className={className}>
            <FormLabel className="flex items-center gap-2">
              <IconHash className="h-4 w-4 text-muted-foreground" />
              {label}
              {required && <span className="text-destructive">*</span>}
            </FormLabel>
            <FormControl>
              <Input
                name={field.name}
                ref={field.ref}
                value={field.value ?? ""}
                onChange={handleChange}
                onBlur={field.onBlur}
                type="number"
                placeholder={placeholder}
                disabled={disabled}
                min={min}
                max={max}
                step={step}
                inputMode={integer ? "numeric" : "decimal"}
                transparent={transparent}
                className="transition-all duration-200"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
