import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Button } from "./button";
import { Input } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { ScrollArea } from "./scroll-area";
import { IconChevronDown, IconX, IconLoader2, IconCheck, IconPlus } from "@tabler/icons-react";
import { cn } from "../../lib/utils";
import { debounce } from "lodash";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface AsyncComboboxWithCreateProps<T> {
  value?: string;
  onValueChange?: (value: string | undefined) => void;
  placeholder?: string;
  emptyText?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
  queryKey: string[];
  queryFn: (search: string) => Promise<T[]>;
  getOptionLabel: (option: T) => string;
  getOptionValue: (option: T) => string;
  renderOption?: (option: T) => React.ReactNode;
  allowCreate?: boolean;
  createLabel?: (value: string) => string;
  onCreate?: (value: string) => void | Promise<void>;
  isCreating?: boolean;
  minSearchLength?: number;
}

export function AsyncComboboxWithCreate<T>({
  value,
  onValueChange,
  placeholder = "Selecione uma opção",
  emptyText = "Nenhuma opção encontrada",
  searchPlaceholder = "Pesquisar...",
  className,
  disabled = false,
  queryKey,
  queryFn,
  getOptionLabel,
  getOptionValue,
  renderOption,
  allowCreate = false,
  createLabel = (value) => `Criar "${value}"`,
  onCreate,
  isCreating = false,
  minSearchLength = 2,
}: AsyncComboboxWithCreateProps<T>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isClosing, setIsClosing] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchRef = useRef<string>("");
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
    enabled: open && (debouncedSearch.length >= minSearchLength || minSearchLength === 0),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
    refetchOnWindowFocus: false, // Avoid unnecessary refetches
    refetchOnReconnect: true, // Only refetch on network reconnect
  });

  // Find selected option with memoization for performance
  const selectedOption = useMemo(() => {
    return value ? options.find((opt) => getOptionValue(opt) === value) : undefined;
  }, [value, options, getOptionValue]);

  const handleSelect = (option: T) => {
    if (isClosing) return;

    const optionValue = getOptionValue(option);
    const newValue = value === optionValue ? undefined : optionValue;
    onValueChange?.(newValue);

    // Delay closing to prevent ref issues
    setIsClosing(true);
    setTimeout(() => {
      setOpen(false);
      setSearch("");
      setIsClosing(false);
    }, 0);
  };

  const handleCreate = async () => {
    if (isClosing || !onCreate || !search.trim()) return;

    try {
      await onCreate(search.trim());
      // After successful creation, invalidate the query to refetch the list
      await queryClient.invalidateQueries({ queryKey });
      
      // Close the popover after successful creation
      // The parent component should have already called onValueChange with the new value
      setIsClosing(true);
      setTimeout(() => {
        setOpen(false);
        setSearch("");
        setIsClosing(false);
      }, 100);
    } catch (error) {
      // Error handling is done by the parent component
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onValueChange?.(undefined);
    setSearch("");
  };

  const defaultRenderOption = (option: T) => {
    return <span className="truncate">{getOptionLabel(option)}</span>;
  };

  // Check if we should show the create option with memoization
  const shouldShowCreate = useMemo(() => {
    return allowCreate && 
           search.trim() && 
           search.length >= minSearchLength && 
           !options.some(opt => getOptionLabel(opt).toLowerCase() === search.toLowerCase());
  }, [allowCreate, search, minSearchLength, options, getOptionLabel]);

  return (
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
          className={cn(
            "w-full justify-between min-h-10 bg-input hover:bg-primary hover:text-primary-foreground border-border transition-all group",
            className
          )}
         
        >
          <span
            className={cn(
              "truncate text-left",
              !selectedOption && "text-muted-foreground group-hover:text-primary-foreground"
            )}
          >
            {selectedOption ? getOptionLabel(selectedOption) : placeholder}
          </span>
          <div className="flex items-center gap-1">
            {value && (
              <div
                role="button"
                tabIndex={0}
                className="hover:text-muted-foreground cursor-pointer"
                onClick={handleClear}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    handleClear(e as any);
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

          {/* Options */}
          <ScrollArea className="h-60">
            <div className="p-1">
              {isLoading && options.length === 0 ? (
                <div className="flex items-center justify-center py-4">
                  <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {value && (
                    <div
                      role="button"
                      tabIndex={0}
                      className="w-full flex items-center px-2 py-2 text-sm rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none mb-1"
                      onClick={handleClear}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleClear(e as any);
                        }
                      }}
                    >
                      <span className="truncate">Limpar seleção</span>
                    </div>
                  )}
                  
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

                  {options.length > 0 ? (
                    options.map((option) => {
                      const optionValue = getOptionValue(option);
                      const isSelected = value === optionValue;
                      return (
                        <div
                          key={optionValue}
                          className={cn(
                            "flex items-center justify-between rounded-sm px-2 py-2 text-sm hover:bg-primary hover:text-primary-foreground cursor-pointer group",
                            isSelected && "bg-accent text-accent-foreground"
                          )}
                          onClick={() => handleSelect(option)}
                        >
                          <div className="flex-1 min-w-0">
                            {renderOption ? renderOption(option) : defaultRenderOption(option)}
                          </div>
                          {isSelected && (
                            <IconCheck className="h-4 w-4 ml-2 flex-shrink-0" />
                          )}
                        </div>
                      );
                    })
                  ) : search.length > 0 && search.length < minSearchLength && minSearchLength > 0 ? (
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
  );
}