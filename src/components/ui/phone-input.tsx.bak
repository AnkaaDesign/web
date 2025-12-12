import React, { useCallback, useRef, useState } from "react";
import { type Control, useFieldArray, useWatch } from "react-hook-form";
import { cn } from "@/lib/utils";
import { FormField, FormItem, FormLabel, FormMessage, FormControl } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { IconPlus, IconTrash, IconPhone } from "@tabler/icons-react";

// Base phone input component with proper Brazilian formatting
interface BasePhoneInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> {
  value?: string | null;
  onChange?: (value: string | undefined) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
}

function BasePhoneInput({ value, onChange, onBlur, className, placeholder = "(00) 00000-0000", ...props }: BasePhoneInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [displayValue, setDisplayValue] = useState(() => formatPhone(value || ""));

  function formatPhone(phone: string): string {
    const numbers = phone.replace(/\D/g, "");

    if (numbers.length === 0) return "";
    if (numbers.length <= 2) return `(${numbers}`;
    if (numbers.length <= 3) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 3)}${numbers.slice(3)}`;
    if (numbers.length <= 11) {
      const hasNinthDigit = numbers.length === 11;
      if (hasNinthDigit) {
        return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
      }
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6, 10)}`;
    }

    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  }

  function extractNumbers(str: string): string {
    return str.replace(/\D/g, "");
  }

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      const numbers = extractNumbers(rawValue);

      if (numbers.length > 11) return;

      const formatted = formatPhone(numbers);
      setDisplayValue(formatted);
      onChange?.(numbers.length > 0 ? numbers : undefined);
    },
    [onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const navigationKeys = ["ArrowLeft", "ArrowRight", "Home", "End", "Tab"];
      if (navigationKeys.includes(e.key)) return;

      if (e.key === "Backspace") {
        e.preventDefault();
        const numbers = extractNumbers(displayValue);
        const newNumbers = numbers.slice(0, -1);
        const formatted = formatPhone(newNumbers);
        setDisplayValue(formatted);
        onChange?.(newNumbers.length > 0 ? newNumbers : undefined);
        return;
      }

      if (!/^\d$/.test(e.key)) {
        e.preventDefault();
      }
    },
    [displayValue, onChange],
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      onBlur?.(e);
    },
    [onBlur],
  );

  const handleFocus = useCallback((_e: React.FocusEvent<HTMLInputElement>) => {
    setTimeout(() => {
      if (inputRef.current) {
        const length = inputRef.current.value.length;
        inputRef.current.setSelectionRange(length, length);
      }
    }, 0);
  }, []);

  React.useEffect(() => {
    if (!inputRef.current?.matches(":focus")) {
      setDisplayValue(formatPhone(value || ""));
    }
  }, [value]);

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      onFocus={handleFocus}
      placeholder={placeholder}
      className={cn(
        "flex h-10 w-full rounded-lg border border-border bg-input px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/[var(--focus-opacity)] focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-[var(--disabled-opacity)] transition-opacity md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

// Single phone input props (for entities like User)
interface SinglePhoneInputProps {
  control: Control<any>;
  name: string;
  label?: string;
  disabled?: boolean;
  required?: boolean;
}

// Multiple phones input props (for entities like Customer, Supplier)
interface MultiplePhoneInputProps {
  control: Control<any>;
  name: string;
  label?: string;
  disabled?: boolean;
  maxPhones?: number;
}

// Main phone input component
interface PhoneInputProps {
  control: Control<any>;
  name: string;
  label?: string;
  disabled?: boolean;
  required?: boolean;
  multiple?: boolean;
  maxPhones?: number;
}

export function PhoneInput({ 
  control, 
  name, 
  label = "Telefone", 
  disabled, 
  required, 
  multiple = false,
  maxPhones = 5
}: PhoneInputProps) {
  if (multiple) {
    return (
      <MultiplePhoneInputComponent
        control={control}
        name={name}
        label={label}
        disabled={disabled}
        maxPhones={maxPhones}
      />
    );
  }

  return (
    <SinglePhoneInputComponent
      control={control}
      name={name}
      label={label}
      disabled={disabled}
      required={required}
    />
  );
}

// Single phone input implementation
function SinglePhoneInputComponent({ control, name, label, disabled, required }: SinglePhoneInputProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-1">
            <IconPhone className="h-4 w-4" />
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </FormLabel>
          <FormControl>
            <BasePhoneInput
              value={field.value || ""}
              onChange={(value) => field.onChange(value || null)}
              onBlur={field.onBlur}
              disabled={disabled}
              placeholder="(00) 00000-0000"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

// Multiple phones input implementation
function MultiplePhoneInputComponent({ control, name, label, disabled, maxPhones }: MultiplePhoneInputProps) {
  const [newPhone, setNewPhone] = useState("");

  // Watch the phones array
  const watchedPhones = useWatch({
    control,
    name,
  });

  // Ensure phones is always an array
  const phones = Array.isArray(watchedPhones) ? watchedPhones : [];

  const { append, remove } = useFieldArray({
    control,
    name,
  });

  const handleAddPhone = () => {
    const cleanPhone = newPhone.replace(/\D/g, "");
    if (cleanPhone && !phones.includes(cleanPhone) && phones.length < (maxPhones ?? 5)) {
      append(cleanPhone);
      setNewPhone("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddPhone();
    }
  };

  const canAddMore = phones.length < (maxPhones ?? 5);
  const cleanNewPhone = newPhone.replace(/\D/g, "");
  const isDuplicate = phones.includes(cleanNewPhone);
  const isAddDisabled = disabled || !cleanNewPhone || isDuplicate || !canAddMore;

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        // Ensure field.value is always an array
        if (!Array.isArray(field.value)) {
          field.onChange([]);
        }

        return (
          <FormItem>
            <FormLabel className="flex items-center gap-2 justify-between">
              <div className="flex items-center gap-1">
                <IconPhone className="h-4 w-4" />
                {label}
                {phones.length > 0 && (
                  <span className="text-sm text-muted-foreground ml-2">
                    ({phones.length}/{maxPhones ?? 5})
                  </span>
                )}
              </div>
              {!canAddMore && (
                <span className="text-xs text-muted-foreground">
                  Limite atingido
                </span>
              )}
            </FormLabel>

            <div className="space-y-3">
              {/* Add new phone input */}
              {canAddMore && (
                <div className="flex gap-2">
                  <BasePhoneInput
                    value={newPhone}
                    onChange={(value) => setNewPhone(value || "")}
                    onKeyPress={handleKeyPress}
                    placeholder="(00) 00000-0000"
                    disabled={disabled}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    onClick={handleAddPhone}
                    disabled={isAddDisabled}
                    size="icon"
                    variant="outline"
                    title={
                      isDuplicate 
                        ? "Telefone já existe" 
                        : !cleanNewPhone 
                        ? "Digite um telefone válido" 
                        : "Adicionar telefone"
                    }
                  >
                    <IconPlus className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Show validation message for new phone */}
              {isDuplicate && newPhone && (
                <p className="text-sm text-muted-foreground">
                  Este telefone já foi adicionado
                </p>
              )}

              {/* List existing phones */}
              {Array.isArray(phones) && phones.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Telefones adicionados:
                  </p>
                  {phones.map((phone: string, index: number) => {
                    const formatted = phone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3") || 
                                    phone.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3") ||
                                    phone;
                    
                    return (
                      <div key={`phone-${index}`} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                        <IconPhone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="flex-1 font-mono">{formatted}</span>
                        <Button
                          type="button"
                          onClick={() => remove(index)}
                          disabled={disabled}
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Remover telefone"
                        >
                          <IconTrash className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

// Export the base component as well for direct use if needed
export { BasePhoneInput };
