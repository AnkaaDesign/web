import React, { useState, useEffect, useRef, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { IconSearch, IconLoader2, IconUser, IconBox } from "@tabler/icons-react";
import { useDebounce } from "@/hooks/common/use-debounce";
import { useItems, useUsers } from "../../../../hooks";
import { cn } from "@/lib/utils";
import type { Item, User } from "../../../../types";

interface BorrowSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputRef?: React.RefObject<HTMLInputElement>;
}

interface SearchSuggestion {
  id: string;
  label: string;
  sublabel?: string;
  type: "item" | "user";
  entity: Item | User;
}

export function BorrowSearchInput({ value, onChange, placeholder = "Buscar por item ou usuário...", className, inputRef }: BorrowSearchInputProps) {
  const [open, setOpen] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const popoverRef = useRef<HTMLDivElement>(null);
  const internalInputRef = useRef<HTMLInputElement>(null);
  const effectiveInputRef = inputRef || internalInputRef;

  const debouncedSearch = useDebounce(localValue, 300);

  // Fetch suggestions when search term changes
  const { data: itemsData, isLoading: itemsLoading } = useItems({
    searchingFor: debouncedSearch,
    take: 5,
    orderBy: { name: "asc" },
    enabled: debouncedSearch.length > 1,
  });

  const { data: usersData, isLoading: usersLoading } = useUsers({
    searchingFor: debouncedSearch,
    take: 5,
    orderBy: { name: "asc" },
    enabled: debouncedSearch.length > 1,
  });

  const isLoading = itemsLoading || usersLoading;

  // Combine suggestions from items and users
  const suggestions = useMemo<SearchSuggestion[]>(() => {
    const results: SearchSuggestion[] = [];

    // Add items
    if (itemsData?.data) {
      itemsData.data.forEach((item) => {
        results.push({
          id: `item-${item.id}`,
          label: item.name,
          sublabel: item.barcodes && item.barcodes.length > 0 ? item.barcodes[0] : undefined,
          type: "item",
          entity: item,
        });
      });
    }

    // Add users
    if (usersData?.data) {
      usersData.data.forEach((user) => {
        results.push({
          id: `user-${user.id}`,
          label: user.name,
          sublabel: user.email ?? undefined,
          type: "user",
          entity: user,
        });
      });
    }

    return results;
  }, [itemsData?.data, usersData?.data]);

  // Show suggestions when there's a search term and results
  const showSuggestions = debouncedSearch.length > 1 && (suggestions.length > 0 || isLoading);

  // Handle input changes
  const handleInputChange = (value: string | number | null) => {
    const newValue = typeof value === 'string' ? value : String(value ?? '');

    // Mark that user is actively typing to prevent external sync
    isUserTypingRef.current = true;

    setLocalValue(newValue);
    onChange(newValue);
    setSelectedIndex(-1);

    // Open popover when typing
    if (newValue.length > 1) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  // Handle suggestion selection
  const handleSelectSuggestion = (suggestion: SearchSuggestion) => {
    const searchTerm = suggestion.label;
    setLocalValue(searchTerm);
    onChange(searchTerm);
    setOpen(false);

    // Keep focus on input
    setTimeout(() => {
      effectiveInputRef.current?.focus();
      effectiveInputRef.current?.setSelectionRange(searchTerm.length, searchTerm.length);
    }, 0);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelectSuggestion(suggestions[selectedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Sync local value with prop value only when it's an external change
  // Avoid syncing when the user is actively typing to prevent backspace issues
  const isUserTypingRef = useRef(false);

  useEffect(() => {
    // Only sync if this is not caused by user input
    if (!isUserTypingRef.current) {
      setLocalValue(value);
    }
    // Reset the flag after a short delay
    const timer = setTimeout(() => {
      isUserTypingRef.current = false;
    }, 50);

    return () => clearTimeout(timer);
  }, [value]);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node) && effectiveInputRef.current && !effectiveInputRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [effectiveInputRef]);

  // Highlight matching text
  const highlightMatch = (text: string, query: string) => {
    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return text;

    return (
      <>
        {text.substring(0, index)}
        <span className="font-semibold text-foreground">{text.substring(index, index + query.length)}</span>
        {text.substring(index + query.length)}
      </>
    );
  };

  return (
    <Popover open={open && showSuggestions} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative flex-1">
          <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            ref={effectiveInputRef}
            type="text"
            placeholder={placeholder}
            value={localValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (localValue.length > 1) {
                setOpen(true);
              }
            }}
            className={cn("pl-10", className)}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent ref={popoverRef} className="w-[var(--radix-popover-trigger-width)] p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="max-h-[300px] overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <IconLoader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Buscando...</span>
            </div>
          ) : suggestions.length > 0 ? (
            <div className="py-1">
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.id}
                  className={cn(
                    "w-full flex items-start gap-3 px-3 py-2 text-left hover:bg-accent focus:bg-accent focus:outline-none transition-colors",
                    index === selectedIndex && "bg-accent",
                  )}
                  onClick={() => handleSelectSuggestion(suggestion)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {suggestion.type === "item" ? <IconBox className="h-4 w-4 text-muted-foreground" /> : <IconUser className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">{highlightMatch(suggestion.label, debouncedSearch)}</div>
                    {suggestion.sublabel && (
                      <div className="text-xs text-muted-foreground truncate">
                        {suggestion.type === "item" ? "Código: " : ""}
                        {suggestion.sublabel}
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <span className="text-xs text-muted-foreground">{suggestion.type === "item" ? "Item" : "Usuário"}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="py-4 text-center text-sm text-muted-foreground">Nenhum resultado encontrado</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
