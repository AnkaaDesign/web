import { Input } from "@/components/ui/input";
import { IconSearch, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";

export interface SearchFilterProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  debounceMs?: number;
  onDebouncedChange?: (value: string) => void;
}

export function SearchFilter({
  value,
  onChange,
  placeholder = "Buscar...",
  className,
  debounceMs = 300,
  onDebouncedChange,
}: SearchFilterProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  const handleChange = (newValue: string) => {
    setDisplayValue(newValue);
    onChange(newValue);

    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new timeout for debounced callback
    if (onDebouncedChange) {
      debounceTimeoutRef.current = setTimeout(() => {
        onDebouncedChange(newValue);
      }, debounceMs);
    }
  };

  const handleClear = () => {
    handleChange("");
  };

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className={cn("relative", className)}>
      <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        placeholder={placeholder}
        value={displayValue}
        onChange={(e) => handleChange(e.target.value)}
        className="pl-9 pr-9"
      />
      {displayValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <IconX className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
