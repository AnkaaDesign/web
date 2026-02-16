import { useState, useRef, useEffect } from "react";
import { Button } from "./button";
import { Input } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { ScrollArea } from "./scroll-area";
import { Checkbox } from "./checkbox";
import { IconChevronDown, IconX } from "@tabler/icons-react";
import { cn } from "../../lib/utils";

export interface MultiComboboxOption {
  value: string;
  label: string;
}

interface MultiComboboxProps {
  options: MultiComboboxOption[];
  value?: string[];
  onValueChange?: (value: string[]) => void;
  placeholder?: string;
  emptyText?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
  multiple?: boolean;
  renderOption?: (option: MultiComboboxOption) => React.ReactNode;
}

export function MultiCombobox({
  options,
  value = [],
  onValueChange,
  placeholder = "Selecione opções",
  emptyText = "Nenhuma opção encontrada",
  searchPlaceholder = "Pesquisar...",
  className,
  disabled = false,
  multiple = true,
  renderOption,
}: MultiComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const badgeContainerRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter((option) => option.label.toLowerCase().includes(search.toLowerCase()));

  const selectedOptions = options.filter((option) => value.includes(option.value));

  const handleSelect = (optionValue: string) => {
    if (!multiple) {
      // Single selection mode
      onValueChange?.([optionValue]);
      setOpen(false);
      setSearch("");
      return;
    }

    // Multiple selection mode
    const newValue = value.includes(optionValue) ? value.filter((v) => v !== optionValue) : [...value, optionValue];
    onValueChange?.(newValue);
  };

  const handleRemove = (optionValue: string) => {
    const newValue = value.filter((v) => v !== optionValue);
    onValueChange?.(newValue);
  };

  const handleClear = () => {
    onValueChange?.([]);
    setSearch("");
  };

  const getDisplayText = () => {
    if (selectedOptions.length === 0) {
      return placeholder;
    }

    if (!multiple && selectedOptions.length > 0) {
      return selectedOptions[0].label;
    }

    return `${selectedOptions.length} ${selectedOptions.length === 1 ? "item selecionado" : "itens selecionados"}`;
  };

  // Handle horizontal scroll with mouse wheel
  useEffect(() => {
    const container = badgeContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, []);

  return (
    <div className="w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-full justify-between min-h-10 bg-input hover:bg-primary hover:text-primary-foreground border-border transition-all group", className)}
            disabled={disabled}
            type="button"
          >
            <span className={cn("truncate text-left", selectedOptions.length === 0 && "text-muted-foreground group-hover:text-primary-foreground")}>{getDisplayText()}</span>
            <div className="flex items-center gap-1">
              {selectedOptions.length > 0 && (
                <div
                  role="button"
                  tabIndex={0}
                  className="hover:text-muted-foreground cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClear();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      handleClear();
                    }
                  }}
                >
                  <IconX className="h-4 w-4" />
                </div>
              )}
              <IconChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <div className="flex flex-col">
            {/* Search */}
            <div className="flex items-center border-b px-3 py-2">
              <Input
                placeholder={searchPlaceholder}
                value={search}
                onChange={(value) => setSearch(value as string)}
                className="border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-2"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between border-b px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                {selectedOptions.length} selecionado{selectedOptions.length !== 1 ? "s" : ""}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const allValues = filteredOptions.map((option) => option.value);
                    onValueChange?.(allValues);
                  }}
                  className="h-auto p-1 text-xs"
                >
                  Selecionar todos
                </Button>
                <Button variant="ghost" size="sm" onClick={handleClear} className="h-auto p-1 text-xs" disabled={selectedOptions.length === 0}>
                  Limpar
                </Button>
              </div>
            </div>

            {/* Options */}
            <ScrollArea className="h-60">
              <div className="p-1">
                {filteredOptions.map((option) => {
                  const isSelected = value.includes(option.value);
                  return (
                    <div
                      key={option.value}
                      className="flex items-center space-x-2 rounded-sm px-2 py-2 text-sm hover:bg-primary hover:text-primary-foreground cursor-pointer group"
                      onClick={() => handleSelect(option.value)}
                    >
                      <Checkbox checked={isSelected} className="group-hover:border-white" />
                      <div className="flex-1 min-w-0">{renderOption ? renderOption(option) : <span className="truncate">{option.label}</span>}</div>
                    </div>
                  );
                })}
                {filteredOptions.length === 0 && <div className="px-2 py-4 text-center text-sm text-muted-foreground">{emptyText}</div>}
              </div>
            </ScrollArea>
          </div>
        </PopoverContent>
      </Popover>

      {/* Display selected items below trigger */}
      {selectedOptions.length > 0 && (
        <div
          ref={badgeContainerRef}
          className="flex gap-1 mt-2 overflow-x-auto multi-combobox-badges"
          style={{
            scrollBehavior: "smooth",
            paddingBottom: "8px", // Space for scrollbar
            marginBottom: "-4px", // Compensate for padding visually
          }}
        >
          {selectedOptions.map((option) => (
            <div
              key={option.value}
              className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-destructive hover:text-destructive-foreground cursor-pointer flex-shrink-0"
              onClick={() => handleRemove(option.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleRemove(option.value);
                }
              }}
              role="button"
              tabIndex={0}
            >
              {option.label}
              <IconX className="ml-1 h-3 w-3" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Export both components for convenience
export { Combobox } from "./combobox";
