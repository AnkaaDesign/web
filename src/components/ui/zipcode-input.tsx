import React, { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ZipCodeInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> {
  value?: string;
  onChange?: (value: string | undefined) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
}

export function ZipCodeInput({ value, onChange, onBlur, className, placeholder = "00000-000", ...props }: ZipCodeInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [displayValue, setDisplayValue] = useState(() => formatZipCode(value || ""));

  function formatZipCode(zipCode: string): string {
    const numbers = zipCode.replace(/\D/g, "");

    if (numbers.length === 0) return "";
    if (numbers.length <= 5) return numbers;

    return `${numbers.slice(0, 5)}-${numbers.slice(5, 8)}`;
  }

  function extractNumbers(str: string): string {
    return str.replace(/\D/g, "");
  }

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      const numbers = extractNumbers(rawValue);

      if (numbers.length > 8) return;

      const formatted = formatZipCode(numbers);
      setDisplayValue(formatted);
      onChange?.(numbers.length > 0 ? numbers : undefined);
    },
    [onChange],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pastedText = e.clipboardData.getData("text");
      const numbers = extractNumbers(pastedText);

      if (numbers.length > 8) return;

      const formatted = formatZipCode(numbers);
      setDisplayValue(formatted);
      onChange?.(numbers.length > 0 ? numbers : undefined);

      // Set cursor to end of formatted value after paste
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.setSelectionRange(formatted.length, formatted.length);
        }
      }, 0);
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
        const formatted = formatZipCode(newNumbers);
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
      setDisplayValue(formatZipCode(value || ""));
    }
  }, [value]);

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      onPaste={handlePaste}
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
