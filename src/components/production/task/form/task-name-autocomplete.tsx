import { useState, useEffect, useRef, useCallback } from "react";
import { useWatch } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconFileText, IconLoader2 } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { useTasks } from "@/hooks";
import { useDebounce } from "@/hooks/common/use-debounce";
import { toTitleCase } from "@/utils/formatters";

interface TaskNameAutocompleteProps {
  control: any;
  disabled?: boolean;
}

export function TaskNameAutocomplete({ control, disabled }: TaskNameAutocompleteProps) {
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [shouldPreventOpen, setShouldPreventOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Watch the form field value
  const formValue = useWatch({ control, name: "name" });

  // Sync input value with form value on mount or when form value changes externally
  useEffect(() => {
    if (formValue !== undefined && formValue !== inputValue) {
      setInputValue(formValue);
    }
  }, [formValue]);

  // Debounce the search query
  const debouncedSearch = useDebounce(inputValue, 300);

  // Fetch task suggestions based on search
  // Use a higher limit to get more name variations
  const { data: tasksData, isLoading } = useTasks({
    searchingFor: debouncedSearch,
    limit: 100,
    enabled: debouncedSearch.length >= 2,
  });

  // Extract unique task names from the results
  const suggestions = tasksData?.data
    ? (() => {
        const uniqueSet = new Set<string>();

        tasksData.data.forEach((task) => {
          if (task.name && task.name.trim().length > 0) {
            uniqueSet.add(task.name.trim());
          }
        });

        // Convert to array, sort alphabetically, and limit to 20 suggestions
        return Array.from(uniqueSet)
          .sort((a, b) => a.localeCompare(b))
          .slice(0, 20);
      })()
    : [];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Check if clicking on dropdown or input
      const clickedOnDropdown = dropdownRef.current?.contains(target);
      const clickedOnInput = inputRef.current?.contains(target);

      if (!clickedOnDropdown && !clickedOnInput) {
        // Clicked completely outside - close and prevent reopening
        setIsOpen(false);
        setShouldPreventOpen(true);
        setTimeout(() => setShouldPreventOpen(false), 300);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Control dropdown visibility based on suggestions and prevent flag
  useEffect(() => {
    // If we're preventing opening, keep it closed
    if (shouldPreventOpen) {
      if (isOpen) {
        setIsOpen(false);
      }
      return;
    }

    // Close if no valid suggestions or search is too short
    if (suggestions.length === 0 || debouncedSearch.length < 2) {
      if (isOpen) {
        setIsOpen(false);
      }
      return;
    }

    // Open if we have suggestions, search is valid, and user is typing (input is focused)
    if (suggestions.length > 0 && debouncedSearch.length >= 2 && document.activeElement === inputRef.current) {
      setIsOpen(true);
      setSelectedIndex(-1);
    }
  }, [suggestions, debouncedSearch, shouldPreventOpen, isOpen]);

  const handleSelect = useCallback(
    (suggestion: string, onChange: (value: string) => void) => {
      setInputValue(suggestion);
      onChange(suggestion);
      setIsOpen(false);
      setSelectedIndex(-1);
      setShouldPreventOpen(true);

      // Blur the input to remove focus
      if (inputRef.current) {
        inputRef.current.blur();
      }

      setTimeout(() => setShouldPreventOpen(false), 300);
    },
    []
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, onChange: (value: string) => void) => {
      if (!isOpen || suggestions.length === 0) {
        // Allow Enter key even when dropdown is closed
        if (e.key === "Enter") {
          e.preventDefault();
          return;
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
          break;
        case "Enter":
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
            handleSelect(suggestions[selectedIndex], onChange);
          } else {
            // Use the current input value
            onChange(inputValue);
            setIsOpen(false);
            setShouldPreventOpen(true);
            setTimeout(() => setShouldPreventOpen(false), 300);
          }
          break;
        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          setSelectedIndex(-1);
          setShouldPreventOpen(true);
          setTimeout(() => setShouldPreventOpen(false), 300);
          break;
      }
    },
    [isOpen, suggestions, selectedIndex, inputValue, handleSelect]
  );

  return (
    <FormField
      control={control}
      name="name"
      render={({ field }) => (
        <FormItem className="relative">
          <FormLabel className="flex items-center gap-2">
            <IconFileText className="h-4 w-4" />
            Nome
          </FormLabel>
          <FormControl>
            <div className="relative">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(value) => {
                  const rawValue = typeof value === "string" ? value : (value as any)?.target?.value || "";
                  setInputValue(rawValue);
                  field.onChange(rawValue);

                  // Allow dropdown to open when typing
                  if (rawValue.length >= 2) {
                    setShouldPreventOpen(false);
                  }
                }}
                onKeyDown={(e) => handleKeyDown(e, field.onChange)}
                onFocus={() => {
                  // Allow reopening when user explicitly focuses the input
                  setShouldPreventOpen(false);

                  // Open dropdown if we have valid criteria
                  if (inputValue.length >= 2 && suggestions.length > 0) {
                    setIsOpen(true);
                  }
                }}
                onBlur={() => {
                  // Apply title case formatting when user finishes typing
                  if (inputValue) {
                    const formatted = toTitleCase(inputValue);
                    setInputValue(formatted);
                    field.onChange(formatted);
                  }
                  // When input loses focus, prevent auto-reopening
                  setTimeout(() => {
                    setIsOpen(false);
                  }, 200);
                }}
                placeholder="Ex: Pintura completa do caminhão"
                disabled={disabled}
                className="bg-transparent"
              />
              {isLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <IconLoader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          </FormControl>

          {/* Suggestions Dropdown */}
          {isOpen && suggestions.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-md max-h-60 overflow-y-auto"
            >
              <div className="p-1">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-sm text-sm transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      selectedIndex === index && "bg-accent text-accent-foreground"
                    )}
                    onMouseDown={(e) => {
                      // Prevent blur event on input
                      e.preventDefault();
                    }}
                    onClick={() => {
                      handleSelect(suggestion, field.onChange);
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          <FormMessage />
        </FormItem>
      )}
    />
  );
}
