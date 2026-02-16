import React, { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Badge } from "./badge";
import { IconSearch, IconX, IconLoader2, IconHistory, IconArrowUp, IconArrowDown, IconCornerDownLeft, IconClock } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import type { SearchSuggestion, UseAdvancedSearchReturn } from "@/hooks/common/use-advanced-search";

interface SmartSearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  /** Search hook return object */
  searchHook: UseAdvancedSearchReturn;
  /** Show clear button when there's text */
  showClear?: boolean;
  /** Show search history */
  showHistory?: boolean;
  /** Show keyboard shortcuts hint */
  showShortcuts?: boolean;
  /** Custom placeholder */
  placeholder?: string;
  /** Custom empty state for suggestions */
  customEmptyState?: React.ReactNode;
  /** Maximum suggestions to display */
  maxVisibleSuggestions?: number;
  /** Custom suggestion renderer */
  renderSuggestion?: (suggestion: SearchSuggestion, isSelected: boolean) => React.ReactNode;
  /** Callback when suggestion is selected */
  onSuggestionSelect?: (suggestion: SearchSuggestion) => void;
  /** Callback when search is submitted */
  onSearchSubmit?: (query: string) => void;
  /** Additional class names */
  className?: string;
  /** Additional popover class names */
  popoverClassName?: string;
}

/**
 * Advanced search input with suggestions, history, and keyboard navigation
 */
export const SmartSearchInput = forwardRef<HTMLInputElement, SmartSearchInputProps>(
  (
    {
      searchHook,
      showClear = true,
      showHistory = true,
      showShortcuts = false,
      placeholder = "Buscar...",
      customEmptyState,
      maxVisibleSuggestions = 8,
      renderSuggestion,
      onSuggestionSelect,
      onSearchSubmit,
      className,
      popoverClassName,
      disabled,
      ...props
    },
    ref,
  ) => {
    const {
      searchQuery,
      suggestions,
      suggestionsLoading,
      showSuggestions,
      selectedSuggestionIndex,
      searchHistory,
      currentEmptyState,
      setSearchQuery,
      clearSearch,
      clearHistory,
      selectSuggestion,
      navigateSuggestions,
      selectCurrentSuggestion: _selectCurrentSuggestion,
      addToHistory,
      highlightMatch,
    } = searchHook;

    // Local state
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [showHistoryMode, setShowHistoryMode] = useState(false);

    // Refs
    const inputRef = useRef<HTMLInputElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);

    // Use forwarded ref or local ref
    const effectiveRef = ref || inputRef;

    // Visible items (suggestions or history)
    const visibleItems = showHistoryMode
      ? searchHistory.slice(0, maxVisibleSuggestions).map((item, index) => ({
          id: `history-${index}`,
          label: item,
          category: "history",
          categoryLabel: "Histórico",
          entity: item,
          icon: <IconClock className="h-4 w-4" />,
        }))
      : suggestions.slice(0, maxVisibleSuggestions);

    const shouldShowPopover = isPopoverOpen && (showSuggestions || (showHistoryMode && searchHistory.length > 0) || suggestionsLoading || !!currentEmptyState);

    // Handle input changes
    const handleInputChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setSearchQuery(newValue);
        setShowHistoryMode(false);

        // Open popover when typing
        if (newValue.length > 0 || searchHistory.length > 0) {
          setIsPopoverOpen(true);
        }
      },
      [setSearchQuery, searchHistory.length],
    );

    // Handle input focus
    const handleInputFocus = useCallback(() => {
      // Show history if no current query
      if (!searchQuery && showHistory && searchHistory.length > 0) {
        setShowHistoryMode(true);
        setIsPopoverOpen(true);
      } else if (searchQuery) {
        setIsPopoverOpen(true);
      }
    }, [searchQuery, showHistory, searchHistory.length]);

    // Handle input blur
    const handleInputBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
      // Only close if focus is not moving to the popover
      if (!popoverRef.current?.contains(e.relatedTarget as Node)) {
        setIsPopoverOpen(false);
        setShowHistoryMode(false);
      }
    }, []);

    // Handle clear button
    const handleClear = useCallback(() => {
      clearSearch();
      setShowHistoryMode(false);
      if (effectiveRef && "current" in effectiveRef && effectiveRef.current) {
        effectiveRef.current.focus();
      }
    }, [clearSearch, effectiveRef]);

    // Handle suggestion/history selection
    const handleItemSelect = useCallback(
      (item: SearchSuggestion) => {
        if (item.category === "history") {
          setSearchQuery(item.label);
          addToHistory(item.label);
        } else {
          selectSuggestion(item);
          onSuggestionSelect?.(item);
        }
        setIsPopoverOpen(false);
        setShowHistoryMode(false);

        // Keep focus on input
        setTimeout(() => {
          if (effectiveRef && "current" in effectiveRef && effectiveRef.current) {
            effectiveRef.current.focus();
          }
        }, 0);
      },
      [setSearchQuery, addToHistory, selectSuggestion, onSuggestionSelect, effectiveRef],
    );

    // Handle keyboard navigation
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!shouldShowPopover) return;

        switch (e.key) {
          case "ArrowDown":
            e.preventDefault();
            navigateSuggestions("down");
            break;
          case "ArrowUp":
            e.preventDefault();
            navigateSuggestions("up");
            break;
          case "Enter":
            e.preventDefault();
            if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < visibleItems.length) {
              handleItemSelect(visibleItems[selectedSuggestionIndex]);
            } else if (searchQuery) {
              addToHistory(searchQuery);
              onSearchSubmit?.(searchQuery);
            }
            break;
          case "Escape":
            e.preventDefault();
            setIsPopoverOpen(false);
            setShowHistoryMode(false);
            break;
          case "Tab":
            // Allow tab to close the popover
            setIsPopoverOpen(false);
            setShowHistoryMode(false);
            break;
        }
      },
      [shouldShowPopover, navigateSuggestions, selectedSuggestionIndex, visibleItems, handleItemSelect, searchQuery, addToHistory, onSearchSubmit],
    );

    // Default suggestion renderer
    const defaultRenderSuggestion = useCallback(
      (suggestion: SearchSuggestion, isSelected: boolean) => (
        <div className={cn("flex items-center gap-3 px-3 py-2 text-left hover:bg-accent focus:bg-accent transition-colors cursor-pointer", isSelected && "bg-accent")}>
          {suggestion.icon && <div className="flex-shrink-0 text-muted-foreground">{suggestion.icon}</div>}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground">{suggestion.category === "history" ? suggestion.label : highlightMatch(suggestion.label)}</div>
            {suggestion.sublabel && <div className="text-xs text-muted-foreground truncate">{suggestion.sublabel}</div>}
          </div>
          <div className="flex items-center gap-2">
            {suggestion.categoryLabel && (
              <Badge variant="secondary" className="text-xs">
                {suggestion.categoryLabel}
              </Badge>
            )}
          </div>
        </div>
      ),
      [highlightMatch],
    );

    // Close popover when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          popoverRef.current &&
          !popoverRef.current.contains(event.target as Node) &&
          effectiveRef &&
          "current" in effectiveRef &&
          effectiveRef.current &&
          !effectiveRef.current.contains(event.target as Node)
        ) {
          setIsPopoverOpen(false);
          setShowHistoryMode(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [effectiveRef]);

    return (
      <Popover open={shouldShowPopover ?? undefined} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <div className="relative flex-1">
            {/* Search icon */}
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
              {suggestionsLoading ? <IconLoader2 className="h-4 w-4 animate-spin" /> : <IconSearch className="h-4 w-4" />}
            </div>

            {/* Search input */}
            <input
              {...props}
              ref={effectiveRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleInputChange(e)}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              className={cn("flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm pl-10 pr-10", className)}
            />

            {/* Clear button */}
            {showClear && searchQuery && !disabled && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                aria-label="Limpar busca"
              >
                <IconX className="h-4 w-4" />
              </Button>
            )}
          </div>
        </PopoverTrigger>

        <PopoverContent ref={popoverRef} className={cn("w-[var(--radix-popover-trigger-width)] p-0", popoverClassName)} align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="max-h-[400px] overflow-auto">
            {/* Loading state */}
            {suggestionsLoading && (
              <div className="flex items-center justify-center py-6">
                <IconLoader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
                <span className="text-sm text-muted-foreground">Buscando...</span>
              </div>
            )}

            {/* Suggestions or history */}
            {!suggestionsLoading && visibleItems.length > 0 && (
              <div className="py-1">
                {visibleItems.map((item, index) => (
                  <button key={item.id} className="w-full focus:outline-none" onClick={() => handleItemSelect(item)} onMouseEnter={() => navigateSuggestions("down")}>
                    {renderSuggestion ? renderSuggestion(item, index === selectedSuggestionIndex) : defaultRenderSuggestion(item, index === selectedSuggestionIndex)}
                  </button>
                ))}
              </div>
            )}

            {/* History header with clear option */}
            {showHistoryMode && searchHistory.length > 0 && (
              <div className="px-3 py-2 border-b bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <IconHistory className="h-3 w-3" />
                    Histórico de busca
                  </div>
                  <Button variant="ghost" size="sm" onClick={clearHistory} className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground">
                    Limpar
                  </Button>
                </div>
              </div>
            )}

            {/* Empty state */}
            {!suggestionsLoading && visibleItems.length === 0 && (
              <div className="py-6">
                {customEmptyState ||
                  (currentEmptyState ? (
                    <div className="text-center px-4">
                      {currentEmptyState.icon && <div className="mb-2 flex justify-center">{currentEmptyState.icon}</div>}
                      <div className="text-sm font-medium text-foreground mb-1">{currentEmptyState.title}</div>
                      {currentEmptyState.description && <div className="text-xs text-muted-foreground mb-3">{currentEmptyState.description}</div>}
                      {currentEmptyState.action && (
                        <Button variant="outline" size="sm" onClick={currentEmptyState.action.onClick} className="text-xs">
                          {currentEmptyState.action.label}
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="text-center text-sm text-muted-foreground px-4">{showHistoryMode ? "Nenhum histórico de busca" : "Digite para buscar..."}</div>
                  ))}
              </div>
            )}

            {/* Keyboard shortcuts hint */}
            {showShortcuts && visibleItems.length > 0 && (
              <div className="px-3 py-2 border-t bg-muted/30">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <IconArrowUp className="h-3 w-3" />
                    <IconArrowDown className="h-3 w-3" />
                    <span>Navegar</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <IconCornerDownLeft className="h-3 w-3" />
                    <span>Selecionar</span>
                  </div>
                  <div>
                    <kbd className="px-1 py-0.5 text-xs font-mono bg-muted rounded">Esc</kbd>
                    <span className="ml-1">Fechar</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  },
);

SmartSearchInput.displayName = "SmartSearchInput";
