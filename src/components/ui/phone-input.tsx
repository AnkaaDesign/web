import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconPhone } from "@tabler/icons-react";
import { type Path, type Control } from "react-hook-form";

interface PhoneInputProps<T extends Record<string, any>> {
  control: Control<T>;
  name: Path<T>;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  multiple?: boolean;
  maxPhones?: number;
}

export function PhoneInput<T extends Record<string, any>>({
  control,
  name,
  label = "Telefone",
  placeholder = "(00) 00000-0000",
  disabled = false,
  required = false,
  multiple: _multiple = false,
  maxPhones: _maxPhones = 5,
}: PhoneInputProps<T>) {
  // If multiple is true, this component is actually for array handling
  // For now, we'll just render a single phone input
  // The PhoneArrayInput component handles multiple phones properly

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconPhone className="h-4 w-4" />
            {label}
            {required && <span className="text-destructive">*</span>}
          </FormLabel>
          <FormControl>
            <Input
              type="phone"
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

// BasePhoneInput for non-form usage
interface BasePhoneInputProps {
  value?: string | null;
  onChange?: (value: string | null) => void;
  onBlur?: () => void;
  onKeyPress?: (e: React.KeyboardEvent) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function BasePhoneInput({
  value,
  onChange,
  onBlur,
  onKeyPress,
  placeholder = "(00) 00000-0000",
  disabled = false,
  className,
}: BasePhoneInputProps) {
  return (
    <Input
      type="phone"
      value={value ?? ""}
      onChange={(newValue) => {
        onChange?.(newValue === "" ? null : (newValue as string));
      }}
      onBlur={onBlur}
      onKeyDown={onKeyPress as any}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      transparent={true}
    />
  );
}
