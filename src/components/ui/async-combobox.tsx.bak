import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "./button";
import { Input } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { ScrollArea } from "./scroll-area";
import { IconChevronDown, IconX, IconLoader2, IconCheck } from "@tabler/icons-react";
import { cn } from "../../lib/utils";
import { debounce } from "lodash";
import { useQuery } from "@tanstack/react-query";

interface AsyncComboboxProps<T> {
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
}

export function AsyncCombobox<T>({
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
}: AsyncComboboxProps<T>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isClosing, setIsClosing] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchRef = useRef<string>("");

  // Debounced search update
  const debouncedSetSearch = useCallback(
    debounce((searchTerm: string) => {
      setDebouncedSearch(searchTerm);
    }, 300),
    []
  );

  // Update debounced search when search changes
  useEffect(() => {
    searchRef.current = search;
    debouncedSetSearch(search);
  }, [search, debouncedSetSearch]);

  // Use React Query for data fetching
  const { data: options = [], isLoading } = useQuery({
    queryKey: [...queryKey, debouncedSearch],
    queryFn: () => queryFn(debouncedSearch),
    enabled: open,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Find selected option
  const selectedOption = value ? options.find((opt) => getOptionValue(opt) === value) : undefined;

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

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onValueChange?.(undefined);
    setSearch("");
  };

  const defaultRenderOption = (option: T) => {
    return <span className="truncate">{getOptionLabel(option)}</span>;
  };

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
          disabled={disabled}
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
            {isLoading && <IconLoader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>

          {/* Options */}
          <ScrollArea className="h-60">
            <div className="p-1">
              {isLoading && options.length === 0 ? (
                <div className="flex items-center justify-center py-4">
                  <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : options.length > 0 ? (
                <>
                  {value && (
                    <div
                      role="button"
                      tabIndex={0}
                      className="w-full flex items-center px-2 py-2 text-sm rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none mb-1"
                      onClick={(e) => handleClear(e)}
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
                  {options.map((option) => {
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
                  })}
                </>
              ) : (
                <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                  {search.length > 0 && search.length < 2
                    ? "Digite pelo menos 2 caracteres para buscar"
                    : emptyText}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}