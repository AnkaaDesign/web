import React, { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface CnpjInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> {
  value?: string;
  onChange?: (value: string | undefined) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
}

export function CnpjInput({ value, onChange, onBlur, className, placeholder = "00.000.000/0000-00", ...props }: CnpjInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Clean the value first in case it comes formatted
  const [displayValue, setDisplayValue] = useState(() => {
    const cleanValue = value ? value.replace(/\D/g, "") : "";
    return formatCnpj(cleanValue);
  });

  function formatCnpj(cnpj: string): string {
    const numbers = cnpj.replace(/\D/g, "");

    if (numbers.length === 0) return "";
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 5) return `${numbers.slice(0, 2)}.${numbers.slice(2)}`;
    if (numbers.length <= 8) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5)}`;
    if (numbers.length <= 12) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8)}`;

    return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8, 12)}-${numbers.slice(12, 14)}`;
  }

  function extractNumbers(str: string): string {
    return str.replace(/\D/g, "");
  }

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      const numbers = extractNumbers(rawValue);

      if (numbers.length > 14) return;

      const formatted = formatCnpj(numbers);
      setDisplayValue(formatted);

      // Only send numbers if there are any, otherwise send undefined for empty input
      // This allows for proper clearing of the field
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
        const formatted = formatCnpj(newNumbers);
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
      // Clean the value first in case it comes formatted
      // Handle null values properly
      const cleanValue = extractNumbers(value || "");
      const formattedValue = formatCnpj(cleanValue);

      // Only update display if the formatted value actually changed
      // This prevents unnecessary re-renders and validation triggers
      if (displayValue !== formattedValue) {
        setDisplayValue(formattedValue);
      }
    }
  }, [value, displayValue]);

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
