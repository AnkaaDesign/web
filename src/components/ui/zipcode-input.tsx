import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconMailbox } from "@tabler/icons-react";
import { type Path, type Control } from "react-hook-form";

interface ZipCodeInputProps {
  value?: string | null;
  onChange?: (value: string | null) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function ZipCodeInput({
  value,
  onChange,
  onBlur,
  placeholder = "00000-000",
  disabled = false,
  className,
}: ZipCodeInputProps) {
  return (
    <Input
      type="cep"
      value={value ?? ""}
      onChange={(newValue) => {
        // Convert empty string or undefined to null for consistent handling
        onChange?.(newValue === "" || newValue === undefined ? null : (newValue as string));
      }}
      onBlur={onBlur as any}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      transparent={true}
    />
  );
}

interface FormZipcodeInputProps<T extends Record<string, any>> {
  control: Control<T>;
  name: Path<T>;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}

export function FormZipcodeInput<T extends Record<string, any>>({
  control,
  name,
  label = "CEP",
  placeholder = "00000-000",
  disabled = false,
  required = false,
}: FormZipcodeInputProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconMailbox className="h-4 w-4" />
            {label}
            {required && <span className="text-destructive">*</span>}
          </FormLabel>
          <FormControl>
            <Input
              type="cep"
              value={field.value ?? ""}
              onChange={(value) => {
                field.onChange(value);
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
