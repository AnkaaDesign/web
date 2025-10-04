import React from "react";
import { Input } from "@/components/ui/input";
import { IconSearch, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  showClearButton?: boolean;
  inputRef?: React.RefObject<HTMLInputElement>;
  enableNaturalTyping?: boolean;
}

export function SearchBar({ value, onChange, placeholder = "Buscar...", className, showClearButton = true, inputRef, enableNaturalTyping = true }: SearchBarProps) {
  const handleClear = () => {
    onChange("");
    inputRef?.current?.focus();
  };

  return (
    <div className={cn("relative flex-1", className)}>
      <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
      <Input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-10 pr-10"
        naturalTyping={enableNaturalTyping}
        typewriterPlaceholder={enableNaturalTyping}
        typingSpeed={60}
      />
      {showClearButton && value && (
        <button type="button" onClick={handleClear} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
          <IconX className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
