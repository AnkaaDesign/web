import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Button } from "./button";
import { Input } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { ScrollArea } from "./scroll-area";
import { Checkbox } from "./checkbox";
import { IconChevronDown, IconX, IconLoader2, IconPlus } from "@tabler/icons-react";
import { cn } from "../../lib/utils";
import { debounce } from "lodash";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface AsyncMultiComboboxWithCreateOption {
  value: string;
  label: string;
  unicode?: string;
  brand?: string;
  category?: string;
}

interface AsyncMultiComboboxWithCreateProps<T extends AsyncMultiComboboxWithCreateOption> {
  value?: string[];
  onValueChange?: (value: string[]) => void;
  placeholder?: string;
  emptyText?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
  multiple?: boolean;
  queryKey: string[];
  queryFn: (search: string) => Promise<T[]>;
  getOptionLabel?: (option: T) => string;
  getOptionValue?: (option: T) => string;
  renderOption?: (option: T) => React.ReactNode;
  formatDisplay?: "category" | "brand";
  allowCreate?: boolean;
  createLabel?: (value: string) => string;
  onCreate?: (value: string) => void | Promise<void>;
  isCreating?: boolean;
  minSearchLength?: number;
  initialOptions?: T[];
}

export function AsyncMultiComboboxWithCreate<T extends AsyncMultiComboboxWithCreateOption>({
  value = [],
  onValueChange,
  placeholder = "Selecione opções",
  emptyText = "Nenhuma opção encontrada",
  searchPlaceholder = "Pesquisar...",
  className,
  disabled = false,
  multiple = true,
  queryKey,
  queryFn,
  getOptionLabel = (option) => option.label,
  getOptionValue = (option) => option.value,
  renderOption,
  formatDisplay,
  allowCreate = false,
  createLabel = (value) => `Criar "${value}"`,
  onCreate,
  isCreating = false,
  minSearchLength = 2,
  initialOptions = [],
}: AsyncMultiComboboxWithCreateProps<T>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isClosing, setIsClosing] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedOptions, setSelectedOptions] = useState<T[]>([]);
  const searchRef = useRef<string>("");
  const badgeContainerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Debounced search update with cleanup
  const debouncedSetSearch = useCallback(
    debounce((searchTerm: string) => {
      setDebouncedSearch(searchTerm);
    }, 300),
    []
  );

  // Cleanup debounced function on unmount
  useEffect(() => {
    return () => {
      debouncedSetSearch.cancel?.();
    };
  }, [debouncedSetSearch]);

  // Update debounced search when search changes
  useEffect(() => {
    searchRef.current = search;
    debouncedSetSearch(search);
  }, [search, debouncedSetSearch]);

  // Use React Query for data fetching with performance optimizations
  const { data: options = [], isLoading } = useQuery({
    queryKey: [...queryKey, debouncedSearch],
    queryFn: () => queryFn(debouncedSearch),
    enabled: open && (debouncedSearch.length >= minSearchLength || debouncedSearch === ""),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
    refetchOnWindowFocus: false, // Avoid unnecessary refetches
    refetchOnReconnect: true, // Only refetch on network reconnect
  });

  // Merge options with initial options
  const allOptions = useCallback(() => {
    const optionMap = new Map<string, T>();
    
    // Add initial options first
    initialOptions.forEach(opt => {
      optionMap.set(getOptionValue(opt), opt);
    });
    
    // Add fetched options (will override duplicates)
    options.forEach(opt => {
      optionMap.set(getOptionValue(opt), opt);
    });
    
    return Array.from(optionMap.values());
  }, [options, initialOptions, getOptionValue]);

  // Update selected options when value changes
  useEffect(() => {
    if (value.length > 0) {
      const currentOptions = allOptions();
      const existingSelected = selectedOptions.filter((opt) => value.includes(getOptionValue(opt)));
      const newSelected = currentOptions.filter((opt) => 
        value.includes(getOptionValue(opt)) && 
        !existingSelected.find((s) => getOptionValue(s) === getOptionValue(opt))
      );
      setSelectedOptions([...existingSelected, ...newSelected]);
    } else {
      setSelectedOptions([]);
    }
  }, [value, allOptions, selectedOptions, getOptionValue]);

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

  const formatOptionLabel = (option: T) => {
    const parts = [];

    if (option.unicode) {
      parts.push(option.unicode);
    }

    parts.push(getOptionLabel(option));

    if (formatDisplay === "brand" && option.category) {
      parts.push(`(${option.category})`);
    } else if (formatDisplay === "category" && option.brand) {
      parts.push(`(${option.brand})`);
    }

    return parts.join(" - ");
  };

  const handleSelect = (option: T) => {
    if (isClosing) return;

    const optionValue = getOptionValue(option);

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

    const newSelectedOptions = isSelected 
      ? selectedOptions.filter((opt) => getOptionValue(opt) !== optionValue) 
      : [...selectedOptions, option];

    onValueChange?.(newValue);
    setSelectedOptions(newSelectedOptions);
  };

  const handleCreate = async () => {
    if (isClosing || !onCreate || !search.trim()) return;

    try {
      await onCreate(search.trim());
      // After successful creation, invalidate the query to refetch the list
      await queryClient.invalidateQueries({ queryKey });
      setSearch("");
      
      // For multi-select, we keep the popover open to allow more selections
      // But clear the search to show the newly created item
    } catch (error) {
      // Error handling is done by the parent component
    }
  };

  const handleRemove = (optionValue: string) => {
    const newValue = value.filter((v) => v !== optionValue);
    const newSelectedOptions = selectedOptions.filter((opt) => getOptionValue(opt) !== optionValue);
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

  const defaultRenderOption = (option: T) => {
    return <span className="truncate">{formatOptionLabel(option)}</span>;
  };

  // Check if we should show the create option with memoization
  const shouldShowCreate = useMemo(() => {
    const allOpts = allOptions();
    return allowCreate && 
           search.trim() && 
           search.length >= minSearchLength && 
           !allOpts.some(opt => getOptionLabel(opt).toLowerCase() === search.toLowerCase());
  }, [allowCreate, search, minSearchLength, allOptions, getOptionLabel]);

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
           
          >
            <span className={cn("truncate text-left", selectedOptions.length === 0 && "text-muted-foreground group-hover:text-primary-foreground")}>
              {getDisplayText()}
            </span>
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
                autoFocus
              />
              {(isLoading || isCreating) && <IconLoader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
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
                      const currentOptions = allOptions();
                      const allValues = currentOptions.map((option) => getOptionValue(option));
                      onValueChange?.(allValues);
                      setSelectedOptions(currentOptions);
                    }}
                    className="h-auto p-1 text-xs"
                   
                  >
                    Selecionar todos
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleClear}
                    className="h-auto p-1 text-xs" 
                  >
                    Limpar
                  </Button>
                </div>
              </div>
            )}

            {/* Options */}
            <ScrollArea className="h-60">
              <div className="p-1">
                {isLoading && allOptions().length === 0 ? (
                  <div className="flex items-center justify-center py-4">
                    <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    {shouldShowCreate && (
                      <div
                        role="button"
                        tabIndex={0}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-2 text-sm rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none mb-1",
                          isCreating && "opacity-50 cursor-not-allowed"
                        )}
                        onClick={handleCreate}
                        onKeyDown={(e) => {
                          if ((e.key === "Enter" || e.key === " ") && !isCreating) {
                            e.preventDefault();
                            handleCreate();
                          }
                        }}
                      >
                        <IconPlus className="h-4 w-4" />
                        <span className="truncate">{createLabel(search)}</span>
                      </div>
                    )}

                    {allOptions().length > 0 ? (
                      allOptions().map((option) => {
                        const optionValue = getOptionValue(option);
                        const isSelected = value.includes(optionValue);
                        return (
                          <div
                            key={optionValue}
                            className="flex items-center space-x-2 rounded-sm px-2 py-2 text-sm hover:bg-primary hover:text-primary-foreground cursor-pointer group"
                            onClick={() => handleSelect(option)}
                          >
                            {multiple && (
                              <Checkbox 
                                checked={isSelected} 
                                onCheckedChange={() => handleSelect(option)} 
                                
                                className="group-hover:border-white" 
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              {renderOption ? renderOption(option) : defaultRenderOption(option)}
                            </div>
                          </div>
                        );
                      })
                    ) : search.length > 0 && search.length < minSearchLength ? (
                      <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                        Digite pelo menos {minSearchLength} caracteres para buscar
                      </div>
                    ) : !shouldShowCreate ? (
                      <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                        {emptyText}
                      </div>
                    ) : null}
                  </>
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
        >
          {selectedOptions.map((option) => (
            <div
              key={getOptionValue(option)}
              className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-destructive hover:text-destructive-foreground cursor-pointer flex-shrink-0"
              onClick={() => handleRemove(getOptionValue(option))}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleRemove(getOptionValue(option));
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