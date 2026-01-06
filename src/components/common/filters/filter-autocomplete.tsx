import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { IconChevronDown, IconX, IconSearch, IconCheck, IconLoader2, IconFilter, IconPlus } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { useCancelableQuery } from "@/hooks/use-cancelable-query";
import { useDebounce } from "@/hooks/use-debounce";

/**
 * Filter suggestion data structure
 */
export interface FilterSuggestion {
  id: string;
  label: string;
  value: any;
  description?: string;
  category?: string;
  icon?: React.ReactNode;
  metadata?: Record<string, any>;
  count?: number; // For showing how many records match this filter
}

/**
 * Filter suggestion provider function
 */
export type SuggestionProvider = (query: string, signal?: AbortSignal) => Promise<FilterSuggestion[]>;

/**
 * Props for the FilterAutocomplete component
 */
export interface FilterAutocompleteProps {
  /**
   * Current selected values
   */
  value?: any[];

  /**
   * Callback when values change
   */
  onValueChange?: (values: any[]) => void;

  /**
   * Placeholder text
   */
  placeholder?: string;

  /**
   * Function to fetch suggestions
   */
  getSuggestions: SuggestionProvider;

  /**
   * Maximum number of selected items to display
   */
  maxDisplayItems?: number;

  /**
   * Allow multiple selections
   */
  multiple?: boolean;

  /**
   * Minimum characters to trigger search
   */
  minSearchLength?: number;

  /**
   * Debounce delay for search in milliseconds
   */
  debounceMs?: number;

  /**
   * Custom empty state message
   */
  emptyMessage?: string;

  /**
   * Loading message
   */
  loadingMessage?: string;

  /**
   * Whether the component is disabled
   */
  disabled?: boolean;

  /**
   * Custom className
   */
  className?: string;

  /**
   * Show category grouping
   */
  showCategories?: boolean;

  /**
   * Allow creating new values
   */
  allowCreate?: boolean;

  /**
   * Custom render function for suggestions
   */
  renderSuggestion?: (suggestion: FilterSuggestion) => React.ReactNode;

  /**
   * Custom render function for selected values
   */
  renderValue?: (value: any, suggestion?: FilterSuggestion) => React.ReactNode;

  /**
   * Size variant
   */
  size?: "sm" | "md" | "lg";

  /**
   * Additional suggestions to always show
   */
  staticSuggestions?: FilterSuggestion[];

  /**
   * Category order for grouping
   */
  categoryOrder?: string[];
}

/**
 * Enhanced autocomplete component for filter suggestions
 *
 * Features:
 * - Type-ahead search with debouncing
 * - Multiple selection support
 * - Category grouping
 * - Custom rendering
 * - Loading states
 * - Keyboard navigation
 * - Cancel previous requests
 * - Static suggestions
 *
 * @example
 * ```tsx
 * <FilterAutocomplete
 *   value={selectedSuppliers}
 *   onValueChange={setSelectedSuppliers}
 *   placeholder="Buscar fornecedores..."
 *   getSuggestions={async (query, signal) => {
 *     const suppliers = await fetchSuppliers({ search: query }, { signal });
 *     return suppliers.map(s => ({
 *       id: s.id,
 *       label: s.name,
 *       value: s.id,
 *       description: s.cnpj,
 *       category: 'suppliers'
 *     }));
 *   }}
 *   multiple
 *   showCategories
 * />
 * ```
 */
export function FilterAutocomplete({
  value = [],
  onValueChange,
  placeholder = "Buscar...",
  getSuggestions,
  maxDisplayItems = 3,
  multiple = true,
  minSearchLength = 1,
  debounceMs = 300,
  emptyMessage = "Nenhum resultado encontrado",
  loadingMessage = "Buscando...",
  disabled = false,
  className,
  showCategories = true,
  allowCreate = false,
  renderSuggestion,
  renderValue,
  size = "md",
  staticSuggestions = [],
  categoryOrder = [],
}: FilterAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<FilterSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Debounce search input
  const debouncedInputValue = useDebounce(inputValue, debounceMs);

  // Cancelable query hook
  const { signal, cancel } = useCancelableQuery({
    queryKey: ["filter-suggestions", debouncedInputValue],
    enabled: open && debouncedInputValue.length >= minSearchLength,
  });

  // Fetch suggestions
  useEffect(() => {
    if (!open || debouncedInputValue.length < minSearchLength) {
      setSuggestions(staticSuggestions);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    getSuggestions(debouncedInputValue, signal)
      .then((newSuggestions) => {
        // Combine static suggestions with fetched ones
        const combined = [...staticSuggestions, ...newSuggestions];

        // Remove duplicates based on value
        const unique = combined.filter((suggestion, index, arr) => arr.findIndex((s) => s.value === suggestion.value) === index);

        setSuggestions(unique);
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          if (process.env.NODE_ENV !== 'production') {
            console.error("Error fetching suggestions:", error);
          }
          setSuggestions(staticSuggestions);
        }
      })
      .finally(() => {
        setIsLoading(false);
      });

    return () => {
      cancel();
    };
  }, [debouncedInputValue, minSearchLength, open, getSuggestions, signal, cancel, staticSuggestions]);

  // Group suggestions by category
  const groupedSuggestions = useMemo(() => {
    if (!showCategories) {
      return { "": suggestions };
    }

    const groups: Record<string, FilterSuggestion[]> = {};

    suggestions.forEach((suggestion) => {
      const category = suggestion.category || "Outros";
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(suggestion);
    });

    // Sort categories based on categoryOrder
    const sortedGroups: Record<string, FilterSuggestion[]> = {};

    // Add ordered categories first
    categoryOrder.forEach((category) => {
      if (groups[category]) {
        sortedGroups[category] = groups[category];
      }
    });

    // Add remaining categories
    Object.keys(groups)
      .filter((category) => !categoryOrder.includes(category))
      .sort()
      .forEach((category) => {
        sortedGroups[category] = groups[category];
      });

    return sortedGroups;
  }, [suggestions, showCategories, categoryOrder]);

  // Handle value selection
  const handleSelect = useCallback(
    (suggestion: FilterSuggestion) => {
      if (!onValueChange) return;

      const newValue = suggestion.value;

      if (multiple) {
        const currentValues = Array.isArray(value) ? value : [];

        if (currentValues.includes(newValue)) {
          // Remove if already selected
          onValueChange(currentValues.filter((v) => v !== newValue));
        } else {
          // Add to selection
          onValueChange([...currentValues, newValue]);
        }
      } else {
        onValueChange([newValue]);
        setOpen(false);
      }

      setInputValue("");
    },
    [value, onValueChange, multiple],
  );

  // Handle value removal
  const handleRemove = useCallback(
    (valueToRemove: any) => {
      if (!onValueChange) return;

      const currentValues = Array.isArray(value) ? value : [];
      onValueChange(currentValues.filter((v) => v !== valueToRemove));
    },
    [value, onValueChange],
  );

  // Handle create new value
  const handleCreate = useCallback(() => {
    if (!allowCreate || !inputValue.trim() || !onValueChange) return;

    const newValue = inputValue.trim();
    const currentValues = Array.isArray(value) ? value : [];

    if (!currentValues.includes(newValue)) {
      onValueChange([...currentValues, newValue]);
    }

    setInputValue("");
    setOpen(false);
  }, [allowCreate, inputValue, value, onValueChange]);

  // Get display suggestions for selected values
  const selectedSuggestions = useMemo(() => {
    return suggestions.filter((s) => value.includes(s.value));
  }, [suggestions, value]);

  // Size classes
  const sizeClasses = {
    sm: "h-8 text-xs",
    md: "h-9 text-sm",
    lg: "h-10 text-base",
  };

  const displayValues = Array.isArray(value) ? value.slice(0, maxDisplayItems) : [];
  const remainingCount = Array.isArray(value) ? Math.max(0, value.length - maxDisplayItems) : 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "justify-between font-normal hover:bg-muted/50",
            sizeClasses[size],
            displayValues.length > 0 && "h-auto min-h-9 py-1",
            disabled && "opacity-50 cursor-not-allowed",
            className,
          )}
          disabled={disabled}
        >
          <div className="flex flex-wrap gap-1 flex-1 min-w-0">
            {displayValues.length === 0 ? (
              <span className="text-muted-foreground truncate">{placeholder}</span>
            ) : (
              <>
                {displayValues.map((val) => {
                  const suggestion = selectedSuggestions.find((s) => s.value === val);
                  return (
                    <Badge key={val} variant="secondary" className="flex items-center gap-1 text-xs">
                      {suggestion?.icon}
                      <span className="truncate max-w-[120px]">{renderValue ? renderValue(val, suggestion) : suggestion?.label || val}</span>
                      {multiple && (
                        <button
                          type="button"
                          className="ml-1 hover:bg-muted rounded-sm p-0.5"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleRemove(val);
                          }}
                        >
                          <IconX className="h-3 w-3" />
                        </button>
                      )}
                    </Badge>
                  );
                })}
                {remainingCount > 0 && (
                  <Badge variant="outline" className="text-xs">
                    +{remainingCount} mais
                  </Badge>
                )}
              </>
            )}
          </div>
          <IconChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={`${placeholder}...`} value={inputValue} onValueChange={setInputValue} className="border-0 focus:ring-0" />

          <CommandList>
            <ScrollArea className="max-h-[300px]">
              {isLoading ? (
                <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                  {loadingMessage}
                </div>
              ) : Object.keys(groupedSuggestions).length === 0 ? (
                <CommandEmpty className="py-6 text-center text-sm">
                  <div className="flex flex-col items-center gap-2">
                    <IconSearch className="h-8 w-8 text-muted-foreground" />
                    <p>{emptyMessage}</p>
                    {allowCreate && inputValue.trim() && (
                      <Button size="sm" variant="outline" onClick={handleCreate} className="mt-2">
                        <IconPlus className="mr-2 h-4 w-4" />
                        Criar "{inputValue.trim()}"
                      </Button>
                    )}
                  </div>
                </CommandEmpty>
              ) : (
                Object.entries(groupedSuggestions).map(([category, items], groupIndex) => (
                  <div key={category}>
                    {showCategories && category && (
                      <>
                        {groupIndex > 0 && <Separator />}
                        <CommandGroup heading={category}>
                          {items.map((suggestion) => {
                            const isSelected = value.includes(suggestion.value);

                            return (
                              <CommandItem
                                key={suggestion.id}
                                value={suggestion.id}
                                onSelect={() => handleSelect(suggestion)}
                                className="flex items-center justify-between cursor-pointer"
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  {suggestion.icon && <span className="shrink-0">{suggestion.icon}</span>}
                                  <div className="flex-1 min-w-0">
                                    {renderSuggestion ? (
                                      renderSuggestion(suggestion)
                                    ) : (
                                      <div>
                                        <div className="font-medium truncate">{suggestion.label}</div>
                                        {suggestion.description && <div className="text-sm text-muted-foreground truncate">{suggestion.description}</div>}
                                      </div>
                                    )}
                                  </div>
                                  {suggestion.count !== undefined && (
                                    <Badge variant="outline" className="text-xs">
                                      {suggestion.count}
                                    </Badge>
                                  )}
                                </div>
                                {isSelected && <IconCheck className="ml-2 h-4 w-4 text-primary" />}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </>
                    )}

                    {!showCategories &&
                      items.map((suggestion) => {
                        const isSelected = value.includes(suggestion.value);

                        return (
                          <CommandItem
                            key={suggestion.id}
                            value={suggestion.id}
                            onSelect={() => handleSelect(suggestion)}
                            className="flex items-center justify-between cursor-pointer"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {suggestion.icon && <span className="shrink-0">{suggestion.icon}</span>}
                              <div className="flex-1 min-w-0">
                                {renderSuggestion ? (
                                  renderSuggestion(suggestion)
                                ) : (
                                  <div>
                                    <div className="font-medium truncate">{suggestion.label}</div>
                                    {suggestion.description && <div className="text-sm text-muted-foreground truncate">{suggestion.description}</div>}
                                  </div>
                                )}
                              </div>
                              {suggestion.count !== undefined && (
                                <Badge variant="outline" className="text-xs">
                                  {suggestion.count}
                                </Badge>
                              )}
                            </div>
                            {isSelected && <IconCheck className="ml-2 h-4 w-4 text-primary" />}
                          </CommandItem>
                        );
                      })}
                  </div>
                ))
              )}

              {allowCreate && inputValue.trim() && !isLoading && (
                <>
                  <Separator />
                  <CommandItem onSelect={handleCreate} className="cursor-pointer">
                    <IconPlus className="mr-2 h-4 w-4" />
                    Criar "{inputValue.trim()}"
                  </CommandItem>
                </>
              )}
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
