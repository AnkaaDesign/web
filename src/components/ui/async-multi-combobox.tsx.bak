import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "./button";
import { Input } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { ScrollArea } from "./scroll-area";
import { Checkbox } from "./checkbox";
import { IconChevronDown, IconX, IconLoader2 } from "@tabler/icons-react";
import { cn } from "../../lib/utils";
import { debounce } from "lodash";

export interface AsyncMultiComboboxOption {
  value: string;
  label: string;
  unicode?: string;
  brand?: string;
  category?: string;
}

interface AsyncMultiComboboxProps {
  value?: string[];
  onValueChange?: (value: string[]) => void;
  placeholder?: string;
  emptyText?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
  multiple?: boolean;
  onSearch: (search: string) => Promise<AsyncMultiComboboxOption[]>;
  renderOption?: (option: AsyncMultiComboboxOption) => React.ReactNode;
  formatDisplay?: "category" | "brand";
  initialOptions?: AsyncMultiComboboxOption[];
}

export function AsyncMultiCombobox({
  value = [],
  onValueChange,
  placeholder = "Selecione opções",
  emptyText = "Nenhuma opção encontrada",
  searchPlaceholder = "Pesquisar...",
  className,
  disabled = false,
  multiple = true,
  onSearch,
  renderOption,
  formatDisplay,
  initialOptions = [],
}: AsyncMultiComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isClosing, setIsClosing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState<AsyncMultiComboboxOption[]>(initialOptions);
  const [selectedOptions, setSelectedOptions] = useState<AsyncMultiComboboxOption[]>([]);
  const searchRef = useRef<string>("");
  const badgeContainerRef = useRef<HTMLDivElement>(null);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (searchTerm: string) => {
      if (searchTerm.length < 2 && searchTerm.length > 0) {
        return;
      }

      setIsLoading(true);
      try {
        const results = await onSearch(searchTerm);
        // Only update if this is still the current search
        if (searchRef.current === searchTerm) {
          setOptions(results);
        }
      } catch (error) {
        console.error("Search error:", error);
        setOptions([]);
      } finally {
        setIsLoading(false);
      }
    }, 300),
    [onSearch],
  );

  // Update selected options when value changes
  useEffect(() => {
    if (value.length > 0) {
      // Keep existing selected options and add any new ones from initialOptions
      const existingSelected = selectedOptions.filter((opt) => value.includes(opt.value));
      const newSelected = initialOptions.filter((opt) => value.includes(opt.value) && !existingSelected.find((s) => s.value === opt.value));
      setSelectedOptions([...existingSelected, ...newSelected]);
    } else {
      setSelectedOptions([]);
    }
  }, [value, initialOptions]);

  // Handle search input change
  useEffect(() => {
    searchRef.current = search;
    debouncedSearch(search);
  }, [search, debouncedSearch]);

  // Load initial options when popover opens
  useEffect(() => {
    if (open && search === "") {
      debouncedSearch("");
    }
  }, [open, debouncedSearch]);

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

  const formatOptionLabel = (option: AsyncMultiComboboxOption) => {
    const parts = [];

    if (option.unicode) {
      parts.push(option.unicode);
    }

    parts.push(option.label);

    if (formatDisplay === "brand" && option.category) {
      parts.push(`(${option.category})`);
    } else if (formatDisplay === "category" && option.brand) {
      parts.push(`(${option.brand})`);
    }

    return parts.join(" - ");
  };

  const handleSelect = (option: AsyncMultiComboboxOption) => {
    if (isClosing) return;

    const optionValue = option.value;

    if (!multiple) {
      // Single selection mode
      onValueChange?.([optionValue]);
      setSelectedOptions([option]);

      // Delay closing to prevent ref issues
      setIsClosing(true);
      setTimeout(() => {
        setOpen(false);
        setSearch("");
        setIsClosing(false);
      }, 0);
      return;
    }

    // Multiple selection mode
    const isSelected = value.includes(optionValue);
    const newValue = isSelected ? value.filter((v) => v !== optionValue) : [...value, optionValue];

    const newSelectedOptions = isSelected ? selectedOptions.filter((opt) => opt.value !== optionValue) : [...selectedOptions, option];

    onValueChange?.(newValue);
    setSelectedOptions(newSelectedOptions);
  };

  const handleRemove = (optionValue: string) => {
    const newValue = value.filter((v) => v !== optionValue);
    const newSelectedOptions = selectedOptions.filter((opt) => opt.value !== optionValue);
    onValueChange?.(newValue);
    setSelectedOptions(newSelectedOptions);
  };

  const handleClear = () => {
    onValueChange?.([]);
    setSelectedOptions([]);
    setSearch("");
  };

  const getDisplayText = () => {
    if (selectedOptions.length === 0) {
      return placeholder;
    }

    if (!multiple && selectedOptions.length > 0) {
      return formatOptionLabel(selectedOptions[0]);
    }

    return `${selectedOptions.length} ${selectedOptions.length === 1 ? "item selecionado" : "itens selecionados"}`;
  };

  const defaultRenderOption = (option: AsyncMultiComboboxOption) => {
    return <span className="truncate">{formatOptionLabel(option)}</span>;
  };

  return (
    <div className="w-full">
      <Popover
        open={open}
        onOpenChange={(newOpen) => {
          if (!isClosing) {
            setOpen(newOpen);
            if (!newOpen) {
              setSearch("");
            }
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-full justify-between min-h-10 bg-input hover:bg-primary hover:text-primary-foreground border-border transition-all group", className)}
            disabled={disabled}
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
                onChange={(e) => setSearch(e.target.value)}
                className="border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-2"
              />
              {isLoading && <IconLoader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>

            {/* Actions */}
            {multiple && (
              <div className="flex items-center justify-between border-b px-3 py-2 text-sm">
                <span className="text-muted-foreground">
                  {selectedOptions.length} selecionado{selectedOptions.length !== 1 ? "s" : ""}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const allOptions = options;
                      const allValues = allOptions.map((option) => option.value);
                      onValueChange?.(allValues);
                      setSelectedOptions(allOptions);
                    }}
                    className="h-auto p-1 text-xs"
                    disabled={options.length === 0}
                  >
                    Selecionar todos
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleClear} className="h-auto p-1 text-xs" disabled={selectedOptions.length === 0}>
                    Limpar
                  </Button>
                </div>
              </div>
            )}

            {/* Options */}
            <ScrollArea className="h-60">
              <div className="p-1">
                {isLoading && options.length === 0 ? (
                  <div className="flex items-center justify-center py-4">
                    <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : options.length > 0 ? (
                  options.map((option) => {
                    const isSelected = value.includes(option.value);
                    return (
                      <div
                        key={option.value}
                        className="flex items-center space-x-2 rounded-sm px-2 py-2 text-sm hover:bg-primary hover:text-primary-foreground cursor-pointer group"
                        onClick={() => handleSelect(option)}
                      >
                        {multiple && (
                          <Checkbox checked={isSelected} onCheckedChange={() => handleSelect(option)} onClick={(e) => e.stopPropagation()} className="group-hover:border-white" />
                        )}
                        <div className="flex-1 min-w-0">{renderOption ? renderOption(option) : defaultRenderOption(option)}</div>
                      </div>
                    );
                  })
                ) : (
                  <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                    {search.length > 0 && search.length < 2 ? "Digite pelo menos 2 caracteres para buscar" : emptyText}
                  </div>
                )}
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
              {formatOptionLabel(option)}
              <IconX className="ml-1 h-3 w-3" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
