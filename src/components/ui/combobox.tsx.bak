import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "./button";
import { Input } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Badge } from "./badge";
import { Checkbox } from "./checkbox";
import { IconCheck, IconChevronDown, IconPlus, IconSearch, IconX, IconLoader2, IconArrowDown } from "@tabler/icons-react";
import { cn } from "../../lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  metadata?: any;
  // Extended properties for specific use cases
  unicode?: string;
  brand?: string;
  category?: string;
  [key: string]: any;
}

interface ComboboxProps<TData = ComboboxOption> {
  // Core props
  value?: string | string[];
  onValueChange?: (value: string | string[] | null | undefined) => void;
  options?: TData[];

  // Mode configuration
  mode?: "single" | "multiple";
  async?: boolean;

  // Async configuration
  queryKey?: unknown[];
  queryFn?: (searchTerm: string, page?: number) => Promise<{ data: TData[]; hasMore?: boolean; total?: number }>;
  initialOptions?: TData[];
  minSearchLength?: number;
  debounceMs?: number;
  staleTime?: number;
  pageSize?: number;

  // Create functionality
  allowCreate?: boolean;
  onCreate?: (value: string) => void | Promise<void>;
  createLabel?: (value: string) => string;
  isCreating?: boolean;
  queryKeysToInvalidate?: unknown[][];

  // Display customization
  placeholder?: string;
  emptyText?: string;
  searchPlaceholder?: string;
  loadingText?: string;

  // Option configuration
  getOptionValue?: (option: TData) => string;
  getOptionLabel?: (option: TData) => string;
  getOptionDescription?: (option: TData) => string | undefined;
  isOptionDisabled?: (option: TData) => boolean;

  // UI configuration
  disabled?: boolean;
  searchable?: boolean;
  clearable?: boolean;
  className?: string;
  triggerClassName?: string;
  required?: boolean;

  // Custom rendering
  renderOption?: (option: TData, isSelected: boolean) => React.ReactNode;
  renderValue?: (option: TData | TData[]) => React.ReactNode;
  formatDisplay?: "category" | "brand";

  // Loading states
  loading?: boolean;

  // Form integration
  name?: string;

  // Multi-select specific
  singleMode?: boolean;
  showCount?: boolean;
  hideDefaultBadges?: boolean;
}

export const Combobox = React.memo(function Combobox<TData = ComboboxOption>({
  value,
  onValueChange,
  options: propOptions,
  mode = "single",
  async = false,
  queryKey,
  queryFn,
  initialOptions = [],
  minSearchLength = 1,
  debounceMs = 300,
  staleTime = 5 * 60 * 1000,
  pageSize = 20,
  allowCreate = false,
  onCreate,
  createLabel = (value) => `Criar "${value}"`,
  isCreating = false,
  queryKeysToInvalidate = [],
  placeholder = "Selecione uma opção",
  emptyText = "Nenhuma opção encontrada",
  searchPlaceholder = "Pesquisar...",
  loadingText = "Carregando...",
  getOptionValue = (option: any) => option.value,
  getOptionLabel = (option: any) => option.label,
  getOptionDescription = (option: any) => option.description,
  isOptionDisabled = (option: any) => option.disabled || false,
  disabled = false,
  searchable = true,
  clearable = true,
  className,
  triggerClassName,
  required = false,
  renderOption,
  renderValue,
  formatDisplay,
  loading: externalLoading,
  name,
  singleMode = false,
  showCount = true,
  hideDefaultBadges = false,
}: ComboboxProps<TData>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Log search state changes - commented to reduce noise
  // useEffect(() => {
  //   console.log('[Combobox] Search state updated:', search);
  // }, [search]);
  const [isClosing, setIsClosing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [allAsyncOptions, setAllAsyncOptions] = useState<TData[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const debouncedSearch = useDebouncedValue(search, debounceMs);
  const queryClient = useQueryClient();

  // Use refs for getter functions and initialOptions to prevent infinite loops in useEffect dependencies
  const getOptionValueRef = useRef(getOptionValue);
  const getOptionLabelRef = useRef(getOptionLabel);
  const getOptionDescriptionRef = useRef(getOptionDescription);
  const isOptionDisabledRef = useRef(isOptionDisabled);
  const initialOptionsRef = useRef(initialOptions);

  // Cache to maintain all items that have been loaded or selected - persists across filter changes
  const allItemsCacheRef = useRef<Map<string, TData>>(new Map());

  // Update refs when props change (without triggering effects)
  useEffect(() => {
    getOptionValueRef.current = getOptionValue;
    getOptionLabelRef.current = getOptionLabel;
    getOptionDescriptionRef.current = getOptionDescription;
    isOptionDisabledRef.current = isOptionDisabled;
    initialOptionsRef.current = initialOptions;
  }, [getOptionValue, getOptionLabel, getOptionDescription, isOptionDisabled, initialOptions]);

  const isMultiple = mode === "multiple";
  const selectedValues = useMemo(() => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }, [value]);

  // This effect must be defined AFTER useQuery to access refetch
  // We'll move it after the useQuery hook

  // Async query for first page
  // Debug logging - commented to reduce noise
  // useEffect(() => {
  //   if (async) {
  //     console.log('[Combobox Debug]', {
  //       search,
  //       debouncedSearch,
  //       queryKey: queryKey ? [...queryKey, debouncedSearch, 1] : ["combobox", debouncedSearch, 1],
  //       enabled: async && !!queryKey && !!queryFn,
  //       hasQueryFn: !!queryFn,
  //       minSearchLength,
  //       currentSearchLength: debouncedSearch.length,
  //     });
  //   }
  // }, [search, debouncedSearch, async, queryKey, queryFn, minSearchLength]);

  const { data: asyncResponse, isLoading: isLoadingOptions, refetch } = useQuery({
    queryKey: queryKey ? [...queryKey, debouncedSearch, 1] : ["combobox", debouncedSearch, 1],
    queryFn: async () => {
      // console.log('[Combobox] queryFn called with:', { debouncedSearch, page: 1 });

      if (!queryFn) {
        // console.log('[Combobox] No queryFn, returning initial options');
        return { data: initialOptions || [], hasMore: false };
      }

      // Check minimum search length
      if (debouncedSearch.length < minSearchLength) {
        // If minSearchLength is 0, we should still call the query function with empty search
        // to get initial data (like when the dropdown opens)
        if (minSearchLength === 0) {
          // console.log('[Combobox] Calling queryFn with empty search (minSearchLength=0)');
          const result = await queryFn("", 1);
          // console.log('[Combobox] Result from empty search:', result);
          // Handle backward compatibility - if queryFn returns an array directly
          if (Array.isArray(result)) {
            return { data: result, hasMore: false };
          }
          return result;
        }
        // If minSearchLength > 0, return initial options without making a request
        // console.log('[Combobox] Search too short, returning initial options');
        return { data: initialOptions || [], hasMore: false };
      }

      // console.log('[Combobox] Calling queryFn with search:', debouncedSearch);
      const result = await queryFn(debouncedSearch, 1);
      // console.log('[Combobox] Result from search:', result);

      // Handle backward compatibility - if queryFn returns an array directly
      if (Array.isArray(result)) {
        return { data: result, hasMore: false };
      }
      return result;
    },
    enabled: async && !!queryKey && !!queryFn,
    staleTime: 0, // Always fetch fresh data when query key changes
    cacheTime: 0, // Don't cache results between searches
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Initialize with initialOptions on mount
  useEffect(() => {
    const currentInitialOptions = initialOptionsRef.current;
    if (async && currentInitialOptions && currentInitialOptions.length > 0 && allAsyncOptions.length === 0) {
      setAllAsyncOptions(currentInitialOptions);
    }
  }, [async, allAsyncOptions.length]); // Using ref for initialOptions

  // Reset pagination when search changes
  useEffect(() => {
    // console.log('[Combobox] Search changed, resetting pagination. debouncedSearch:', debouncedSearch);
    setCurrentPage(1);
    // Clear options for new search to show loading state
    if (debouncedSearch !== '') {
      setAllAsyncOptions([]);
    }
  }, [debouncedSearch]);

  // Update all options when first page loads or search changes
  useEffect(() => {
    // console.log('[Combobox] asyncResponse changed:', asyncResponse);
    if (asyncResponse) {
      // Start with fetched data
      let newOptions = asyncResponse.data || [];

      // Add all fetched items to the cache
      newOptions.forEach(item => {
        const itemValue = getOptionValueRef.current(item);
        allItemsCacheRef.current.set(itemValue, item);
      });

      // If we have initialOptions, add them to cache
      const currentInitialOptions = initialOptionsRef.current;
      if (currentInitialOptions && currentInitialOptions.length > 0) {
        currentInitialOptions.forEach(opt => {
          const itemValue = getOptionValueRef.current(opt);
          if (!allItemsCacheRef.current.has(itemValue)) {
            allItemsCacheRef.current.set(itemValue, opt);
          }
        });
      }

      // Get current selected values
      const currentSelectedValues = Array.isArray(value) ? value : (value ? [value] : []);

      // Merge in selected items from cache that aren't in the current response
      // This ensures selected items persist even when they don't match the current filter
      const fetchedValues = new Set(newOptions.map(item => getOptionValueRef.current(item)));
      currentSelectedValues.forEach(selectedValue => {
        if (!fetchedValues.has(selectedValue) && allItemsCacheRef.current.has(selectedValue)) {
          const cachedItem = allItemsCacheRef.current.get(selectedValue);
          if (cachedItem) {
            newOptions = [cachedItem, ...newOptions];
          }
        }
      });

      // Deduplicate items based on their value to prevent duplicate key warnings
      const deduplicatedData = newOptions.filter(
        (item, index, self) => {
          const itemValue = getOptionValueRef.current(item);
          return index === self.findIndex((t) => getOptionValueRef.current(t) === itemValue);
        }
      );

      // console.log('[Combobox] Setting allAsyncOptions for search:', debouncedSearch, 'data:', deduplicatedData);
      // Always replace options when we get new results (don't append on first page)
      setAllAsyncOptions(deduplicatedData);
      setHasMore(asyncResponse.hasMore || false);
    } else if (asyncResponse === null) {
      // Query returned null/undefined - clear the options
      // console.log('[Combobox] Query returned null, clearing options');
      setAllAsyncOptions([]);
      setHasMore(false);
    }
  }, [asyncResponse, debouncedSearch, value]); // Removed getOptionValue and initialOptions - using refs instead

  // Load more function
  const loadMore = useCallback(async () => {
    if (!queryFn || isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const result = await queryFn(debouncedSearch, nextPage);

      // Handle backward compatibility
      if (Array.isArray(result)) {
        // Add items to cache
        result.forEach(item => {
          const itemValue = getOptionValue(item);
          allItemsCacheRef.current.set(itemValue, item);
        });

        // Deduplicate when adding more items
        setAllAsyncOptions((prev) => {
          const combined = [...prev, ...result];
          // Remove duplicates based on option value
          const seen = new Set();
          return combined.filter((item) => {
            const value = getOptionValue(item);
            if (seen.has(value)) {
              return false;
            }
            seen.add(value);
            return true;
          });
        });
        setHasMore(false);
      } else {
        // Add items to cache
        (result.data || []).forEach(item => {
          const itemValue = getOptionValue(item);
          allItemsCacheRef.current.set(itemValue, item);
        });

        // Deduplicate when adding more items
        setAllAsyncOptions((prev) => {
          const combined = [...prev, ...(result.data || [])];
          // Remove duplicates based on option value
          const seen = new Set();
          return combined.filter((item) => {
            const value = getOptionValue(item);
            if (seen.has(value)) {
              return false;
            }
            seen.add(value);
            return true;
          });
        });
        setHasMore(result.hasMore || false);
      }

      setCurrentPage(nextPage);
    } catch (error) {
      console.error("Error loading more options:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [queryFn, isLoadingMore, hasMore, currentPage, debouncedSearch]);

  // Determine options source
  const options = async ? allAsyncOptions : propOptions || [];
  const loading = async ? isLoadingOptions && currentPage === 1 : externalLoading;

  // Debug what options we're using - commented to reduce noise
  // useEffect(() => {
  //   if (async) {
  //     console.log('[Combobox] Options being used:', {
  //       async,
  //       optionsLength: options.length,
  //       allAsyncOptionsLength: allAsyncOptions.length,
  //       propOptionsLength: propOptions?.length,
  //       options: options.slice(0, 3), // Show first 3 for debugging
  //     });
  //   }
  // }, [async, options, allAsyncOptions, propOptions]);

  // Filter options - only filter locally for non-async mode
  const filteredOptions = useMemo(() => {
    // For async mode, server already returns filtered results
    if (async) return options;

    // For non-async mode, perform local filtering
    if (!searchable || !search) return options;

    const searchLower = search.toLowerCase();
    return options.filter((option) => {
      const label = getOptionLabel(option).toLowerCase();
      const description = getOptionDescription(option)?.toLowerCase() || "";
      return label.includes(searchLower) || description.includes(searchLower);
    });
  }, [async, options, search, searchable, getOptionLabel, getOptionDescription]);

  // Get selected option(s)
  const selectedOptions = useMemo(() => {
    return options.filter((option) => selectedValues.includes(getOptionValue(option)));
  }, [options, selectedValues, getOptionValue]);

  const formatOptionLabel = useCallback(
    (option: TData) => {
      const label = getOptionLabel(option);
      const optionAny = option as any;

      if (formatDisplay === "category" && optionAny.category) {
        return `${label} (${optionAny.category})`;
      }
      if (formatDisplay === "brand") {
        const parts = [];
        if (optionAny.unicode) parts.push(optionAny.unicode);
        parts.push(label);
        if (optionAny.brand || optionAny.category) {
          parts.push(`(${optionAny.brand || optionAny.category})`);
        }
        return parts.join(" ");
      }
      return label;
    },
    [getOptionLabel, formatDisplay],
  );

  const handleSelect = useCallback(
    (optionValue: string) => {
      if (isClosing) return;

      if (isMultiple) {
        const newValues = selectedValues.includes(optionValue) ? selectedValues.filter((v) => v !== optionValue) : [...selectedValues, optionValue];
        onValueChange?.(newValues);
      } else {
        const newValue = value === optionValue ? undefined : optionValue;
        onValueChange?.(newValue);

        setIsClosing(true);
        requestAnimationFrame(() => {
          setOpen(false);
          setSearch("");
          setIsClosing(false);
        });
      }
    },
    [isClosing, isMultiple, selectedValues, value, onValueChange],
  );

  const handleCreate = useCallback(async () => {
    if (isClosing || !onCreate || !search.trim()) return;

    try {
      await onCreate(search.trim());

      if (queryKeysToInvalidate.length > 0) {
        await Promise.all(queryKeysToInvalidate.map((key) => queryClient.invalidateQueries({ queryKey: key })));
      }
    } catch (error) {
      // Error handling done by parent
    }
  }, [isClosing, onCreate, search, queryKeysToInvalidate, queryClient]);

  const handleClear = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      onValueChange?.(isMultiple ? [] : null);
      setSearch("");
    },
    [isMultiple, onValueChange],
  );

  const handleSelectAll = useCallback(() => {
    const allValues = filteredOptions.filter((option) => !isOptionDisabled(option)).map((option) => getOptionValue(option));
    onValueChange?.(allValues);
  }, [filteredOptions, isOptionDisabled, getOptionValue, onValueChange]);

  const handleClearAll = useCallback(() => {
    onValueChange?.([]);
  }, [onValueChange]);

  const triggerContent = useMemo(() => {
    if (renderValue) {
      return renderValue(isMultiple ? selectedOptions : selectedOptions[0]);
    }

    if (selectedOptions.length === 0) {
      return <span className="opacity-70">{placeholder}</span>;
    }

    if (isMultiple) {
      if (singleMode) {
        const label = formatOptionLabel(selectedOptions[0]);
        return showCount && selectedOptions.length > 1 ? `${label} +${selectedOptions.length - 1}` : label;
      }
      return showCount ? `${selectedOptions.length} selecionado${selectedOptions.length !== 1 ? "s" : ""}` : placeholder;
    }

    return formatOptionLabel(selectedOptions[0]);
  }, [renderValue, selectedOptions, placeholder, isMultiple, singleMode, showCount, formatOptionLabel]);

  const showCreateOption = allowCreate && search.trim() && filteredOptions.length === 0 && !filteredOptions.some((opt) => getOptionLabel(opt).toLowerCase() === search.toLowerCase());

  // Extract height class from className if provided, default to h-10
  const heightClass = useMemo(() => {
    if (!className) return "h-10";

    const heightMatch = className.match(/\bh-\d+(?:\.\d+)?\b/);
    return heightMatch ? heightMatch[0] : "h-10";
  }, [className]);

  // Remove height class from className to avoid conflicts
  const classNameWithoutHeight = useMemo(() => {
    if (!className) return "";
    return className.replace(/\bh-\d+(?:\.\d+)?\b/g, "").trim();
  }, [className]);

  return (
    <div className={cn("w-full", classNameWithoutHeight)}>
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
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-label={name || "Select option"}
            className={cn(
              "group w-full justify-between text-foreground bg-transparent",
              heightClass,
              "hover:bg-accent hover:text-white",
              "data-[state=open]:bg-accent data-[state=open]:text-white",
              triggerClassName,
            )}
            data-state={open ? "open" : "closed"}
            disabled={disabled}
            type="button"
          >
            <span className="truncate flex-1 text-left">{triggerContent}</span>
            <IconChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onWheel={(e) => {
            // Prevent wheel events from bubbling to the modal
            e.stopPropagation();
          }}
        >
          <div className="flex flex-col max-h-[400px]">
            {searchable && (
              <div className="flex items-center border-b px-3 py-2 gap-2">
                <IconSearch className="h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={search}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    // console.log('[Combobox] Search input onChange:', { oldValue: search, newValue });
                    setSearch(newValue);
                  }}
                  className="border-0 p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent outline-none w-full"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    // Prevent closing on Enter
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                  autoFocus
                />
              </div>
            )}

            {isMultiple && filteredOptions.length > 0 && (
              <div className="flex items-center justify-between px-3 py-2 border-b">
                <span className="text-sm text-muted-foreground">
                  {selectedValues.length} de {filteredOptions.length} selecionados
                </span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={handleSelectAll} className="h-auto py-1 px-2">
                    Selecionar todos
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleClearAll} className="h-auto py-1 px-2">
                    Limpar
                  </Button>
                </div>
              </div>
            )}

            <div
              className="max-h-[15rem] overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100"
              style={{
                overscrollBehavior: "contain",
                WebkitOverflowScrolling: "touch",
                willChange: "scroll-position",
              }}
              onPointerDown={(e) => {
                // Ensure pointer events work properly
                e.stopPropagation();
              }}
              onScroll={(e) => {
                // Auto-load more on scroll near bottom (only for async mode)
                if (async && hasMore && !isLoadingMore) {
                  const target = e.target as HTMLDivElement;
                  const scrollPercentage = ((target.scrollTop + target.clientHeight) / target.scrollHeight) * 100;
                  if (scrollPercentage > 85) {
                    loadMore();
                  }
                }
              }}
            >
              <div className="p-1">
                {!isMultiple && clearable && selectedValues.length > 0 && (
                  <div
                    role="button"
                    tabIndex={0}
                    className="w-full flex items-center px-2 py-2 text-sm rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground"
                    onClick={handleClear}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleClear();
                      }
                    }}
                  >
                    <IconX className="mr-2 h-4 w-4" />
                    <span className="truncate">Limpar seleção</span>
                  </div>
                )}

                {showCreateOption && (
                  <div
                    role="button"
                    tabIndex={0}
                    className={cn(
                      "w-full flex items-center px-2 py-2 text-sm rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground",
                      isCreating && "opacity-50 cursor-not-allowed",
                    )}
                    onClick={isCreating ? undefined : handleCreate}
                    onKeyDown={(e) => {
                      if ((e.key === "Enter" || e.key === " ") && !isCreating) {
                        e.preventDefault();
                        handleCreate();
                      }
                    }}
                  >
                    <IconPlus className="mr-2 h-4 w-4" />
                    <span className="truncate">{createLabel(search.trim())}</span>
                    {isCreating && <IconLoader2 className="ml-2 h-4 w-4 animate-spin" />}
                  </div>
                )}

                {loading ? (
                  <div className="px-2 py-8 text-center text-sm text-muted-foreground">
                    <IconLoader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                    {loadingText}
                  </div>
                ) : filteredOptions.length === 0 && !showCreateOption ? (
                  <div className="px-2 py-8 text-center text-sm text-muted-foreground">{emptyText}</div>
                ) : (
                  filteredOptions.map((option) => {
                    const optionValue = getOptionValue(option);
                    const isSelected = selectedValues.includes(optionValue);
                    const isDisabled = isOptionDisabled(option);
                    const description = getOptionDescription(option);

                    return (
                      <div
                        key={optionValue}
                        role="option"
                        aria-selected={isSelected}
                        tabIndex={isDisabled ? -1 : 0}
                        className={cn(
                          "group w-full flex items-center px-2 py-2 text-sm rounded-sm cursor-pointer",
                          "hover:bg-accent hover:text-accent-foreground",
                          isDisabled && "opacity-50 cursor-not-allowed",
                          isSelected && !isMultiple && "bg-accent text-accent-foreground",
                        )}
                        onClick={isDisabled ? undefined : () => handleSelect(optionValue)}
                        onKeyDown={(e) => {
                          if ((e.key === "Enter" || e.key === " ") && !isDisabled) {
                            e.preventDefault();
                            handleSelect(optionValue);
                          }
                        }}
                      >
                        {isMultiple ? (
                          <Checkbox checked={isSelected} disabled={isDisabled} className="mr-2" onClick={(e) => e.stopPropagation()} />
                        ) : (
                          <IconCheck className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                        )}

                        <div className="flex-1 truncate">
                          {renderOption ? (
                            renderOption(option, isSelected)
                          ) : (
                            <div>
                              <div className="truncate">{formatOptionLabel(option)}</div>
                              {description && (
                                <div className={cn(
                                  "text-xs truncate",
                                  isSelected && !isMultiple ? "text-accent-foreground/80" : "text-muted-foreground group-hover:text-accent-foreground/80"
                                )}>
                                  {description}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Load more button for async mode */}
                {async && hasMore && (
                  <div className="pt-2 pb-1 px-1 border-t mt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full h-8 justify-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        loadMore();
                      }}
                      disabled={isLoadingMore}
                    >
                      {isLoadingMore ? (
                        <>
                          <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                          Carregando...
                        </>
                      ) : (
                        <>
                          <IconArrowDown className="h-4 w-4 mr-2" />
                          Carregar mais
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* Loading indicator for additional pages */}
                {async && isLoadingMore && currentPage > 1 && (
                  <div className="px-2 py-2 text-center text-sm text-muted-foreground">
                    <IconLoader2 className="h-4 w-4 animate-spin mx-auto" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {!hideDefaultBadges && isMultiple && selectedOptions.length > 0 && !singleMode && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selectedOptions.map((option) => {
            const optionValue = getOptionValue(option);
            return (
              <Badge
                key={optionValue}
                variant="secondary"
                className="text-xs group hover:bg-destructive hover:text-destructive-foreground cursor-pointer"
                onClick={() => handleSelect(optionValue)}
              >
                {formatOptionLabel(option)}
                <IconX className="ml-1 h-3 w-3 opacity-50 group-hover:opacity-100" />
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}) as <TData = ComboboxOption>(props: ComboboxProps<TData>) => React.ReactElement;
