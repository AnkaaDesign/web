import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDebounce } from "./use-debounce";
import { useUnifiedTableState } from "./use-unified-table-state";

// Types for search configuration
export interface SearchField {
  /** Field key for API */
  key: string;
  /** Display label */
  label: string;
  /** Weight for relevance scoring */
  weight?: number;
  /** Whether to enable exact matching */
  exactMatch?: boolean;
  /** Custom transform function for search value */
  transform?: (value: string) => any;
}

export interface SearchSuggestion<T = any> {
  /** Unique identifier */
  id: string;
  /** Primary display text */
  label: string;
  /** Secondary display text */
  sublabel?: string;
  /** Category/type identifier */
  category: string;
  /** Category display label */
  categoryLabel: string;
  /** Original entity data */
  entity: T;
  /** Relevance score for sorting */
  relevance?: number;
  /** Highlighted label with matches */
  highlightedLabel?: React.ReactNode;
  /** Icon for the suggestion type */
  icon?: React.ReactNode;
}

export interface SearchEmptyState {
  /** Icon to display */
  icon?: React.ReactNode;
  /** Primary message */
  title: string;
  /** Secondary message */
  description?: string;
  /** Action button */
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface UseAdvancedSearchOptions<TFilters extends Record<string, any> = Record<string, any>> {
  /** Search fields configuration */
  searchFields?: SearchField[];
  /** Debounce delay for search input */
  searchDebounceMs?: number;
  /** Minimum characters to trigger search */
  minSearchLength?: number;
  /** Maximum number of suggestions to show */
  maxSuggestions?: number;
  /** Enable search suggestions */
  enableSuggestions?: boolean;
  /** Enable search history */
  enableHistory?: boolean;
  /** Search history storage key */
  historyStorageKey?: string;
  /** Maximum history items */
  maxHistoryItems?: number;
  /** Custom empty states */
  emptyStates?: {
    noResults?: SearchEmptyState;
    noQuery?: SearchEmptyState;
    error?: SearchEmptyState;
  };
  /** Custom suggestion fetcher */
  fetchSuggestions?: (query: string, fields: SearchField[]) => Promise<SearchSuggestion[]>;
  /** Table state options */
  tableStateOptions?: Parameters<typeof useUnifiedTableState<TFilters, unknown>>[0];
}

export interface UseAdvancedSearchReturn<TFilters extends Record<string, any> = Record<string, any>> {
  // Search state
  searchQuery: string;
  debouncedSearchQuery: string;
  isSearching: boolean;
  searchError: Error | null;

  // Search suggestions
  suggestions: SearchSuggestion[];
  suggestionsLoading: boolean;
  showSuggestions: boolean;
  selectedSuggestionIndex: number;

  // Search history
  searchHistory: string[];

  // Search actions
  setSearchQuery: (query: string) => void;
  clearSearch: () => void;
  addToHistory: (query: string) => void;
  clearHistory: () => void;

  // Suggestion navigation
  selectSuggestion: (suggestion: SearchSuggestion) => void;
  navigateSuggestions: (direction: 'up' | 'down') => void;
  selectCurrentSuggestion: () => void;

  // Search highlighting
  highlightMatch: (text: string, query?: string) => React.ReactNode;

  // Table state integration
  tableState: ReturnType<typeof useUnifiedTableState<TFilters, unknown>>;

  // Empty states
  currentEmptyState: SearchEmptyState | null;
}

/**
 * Advanced search hook with debouncing, URL state, suggestions, and highlighting
 */
export function useAdvancedSearch<TFilters extends Record<string, any> = Record<string, any>>(
  options: UseAdvancedSearchOptions<TFilters> = {}
): UseAdvancedSearchReturn<TFilters> {
  const {
    searchFields = [{ key: 'searchingFor', label: 'Busca Geral' }],
    searchDebounceMs = 150,
    minSearchLength = 1,
    maxSuggestions = 8,
    enableSuggestions = true,
    enableHistory = true,
    historyStorageKey = 'ankaa-search-history',
    maxHistoryItems = 10,
    emptyStates = {},
    fetchSuggestions,
    tableStateOptions = {},
  } = options;

  // Initialize table state with search integration
  const tableState = useUnifiedTableState<TFilters, unknown>({
    debounceMs: {
      search: searchDebounceMs,
    },
    ...tableStateOptions,
  });

  const urlSearchQuery = tableState.search.searchText;
  const setUrlSearch = tableState.search.setSearch;

  // Local search state
  const [localSearchQuery, setLocalSearchQuery] = useState(urlSearchQuery);
  const [searchError, setSearchError] = useState<Error | null>(null);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);

  // Refs
  const isUserTypingRef = useRef(false);
  const fetchAbortControllerRef = useRef<AbortController | null>(null);

  // Debounced search query
  const debouncedSearchQuery = useDebounce(localSearchQuery, searchDebounceMs);

  // Search history management
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    if (!enableHistory) return [];
    try {
      const stored = localStorage.getItem(historyStorageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Sync local search with URL search (only when not actively typing)
  useEffect(() => {
    if (!isUserTypingRef.current && urlSearchQuery !== localSearchQuery) {
      setLocalSearchQuery(urlSearchQuery);
    }
  }, [urlSearchQuery, localSearchQuery]);

  // Update URL search when debounced query changes
  useEffect(() => {
    if (isUserTypingRef.current) {
      setUrlSearch(debouncedSearchQuery);

      // Reset typing flag after update
      const timer = setTimeout(() => {
        isUserTypingRef.current = false;
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [debouncedSearchQuery, setUrlSearch]);

  // Fetch suggestions when debounced query changes
  useEffect(() => {
    if (!enableSuggestions || !fetchSuggestions) return;
    if (debouncedSearchQuery.length < minSearchLength) {
      setSuggestions([]);
      return;
    }

    // Cancel previous request
    if (fetchAbortControllerRef.current) {
      fetchAbortControllerRef.current.abort();
    }

    const controller = new AbortController();
    fetchAbortControllerRef.current = controller;

    setSuggestionsLoading(true);
    setSearchError(null);

    fetchSuggestions(debouncedSearchQuery, searchFields)
      .then((newSuggestions) => {
        if (!controller.signal.aborted) {
          setSuggestions(newSuggestions.slice(0, maxSuggestions));
          setSelectedSuggestionIndex(-1);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setSearchError(error);
          setSuggestions([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setSuggestionsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [debouncedSearchQuery, enableSuggestions, fetchSuggestions, minSearchLength, maxSuggestions, searchFields]);

  // Search actions
  const setSearchQuery = useCallback((query: string) => {
    isUserTypingRef.current = true;
    setLocalSearchQuery(query);
    setSelectedSuggestionIndex(-1);
  }, []);

  const clearSearch = useCallback(() => {
    setLocalSearchQuery('');
    setUrlSearch('');
    setSuggestions([]);
    setSelectedSuggestionIndex(-1);
    setSearchError(null);
  }, [setUrlSearch]);

  const addToHistory = useCallback((query: string) => {
    if (!enableHistory || !query.trim()) return;

    setSearchHistory((prev) => {
      const trimmedQuery = query.trim();
      const filtered = prev.filter(item => item !== trimmedQuery);
      const newHistory = [trimmedQuery, ...filtered].slice(0, maxHistoryItems);

      try {
        localStorage.setItem(historyStorageKey, JSON.stringify(newHistory));
      } catch {
        // Ignore localStorage errors
      }

      return newHistory;
    });
  }, [enableHistory, maxHistoryItems, historyStorageKey]);

  const clearHistory = useCallback(() => {
    setSearchHistory([]);
    try {
      localStorage.removeItem(historyStorageKey);
    } catch {
      // Ignore localStorage errors
    }
  }, [historyStorageKey]);

  // Suggestion navigation
  const selectSuggestion = useCallback((suggestion: SearchSuggestion) => {
    setLocalSearchQuery(suggestion.label);
    setUrlSearch(suggestion.label);
    addToHistory(suggestion.label);
    setSuggestions([]);
    setSelectedSuggestionIndex(-1);
  }, [setUrlSearch, addToHistory]);

  const navigateSuggestions = useCallback((direction: 'up' | 'down') => {
    if (suggestions.length === 0) return;

    setSelectedSuggestionIndex((prev) => {
      if (direction === 'down') {
        return prev < suggestions.length - 1 ? prev + 1 : 0;
      } else {
        return prev > 0 ? prev - 1 : suggestions.length - 1;
      }
    });
  }, [suggestions.length]);

  const selectCurrentSuggestion = useCallback(() => {
    if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < suggestions.length) {
      selectSuggestion(suggestions[selectedSuggestionIndex]);
    }
  }, [selectedSuggestionIndex, suggestions, selectSuggestion]);

  // Search highlighting
  const highlightMatch = useCallback((text: string, query?: string): React.ReactNode => {
    const searchTerm = query || debouncedSearchQuery;
    if (!searchTerm || !text) return text;

    const parts = text.split(new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));

    return parts.map((part, index) => {
      if (part.toLowerCase() === searchTerm.toLowerCase()) {
        return (
          <mark
            key={index}
            className="bg-primary/20 text-primary font-medium px-0.5 rounded"
          >
            {part}
          </mark>
        );
      }
      return part;
    });
  }, [debouncedSearchQuery]);

  // Computed states
  const isSearching = suggestionsLoading;
  const showSuggestions = enableSuggestions &&
    debouncedSearchQuery.length >= minSearchLength &&
    (suggestions.length > 0 || isSearching);

  // Current empty state
  const currentEmptyState = useMemo((): SearchEmptyState | null => {
    if (searchError) {
      return emptyStates.error || {
        title: 'Erro na busca',
        description: 'Ocorreu um erro ao buscar. Tente novamente.',
      };
    }

    if (debouncedSearchQuery.length >= minSearchLength && !isSearching && suggestions.length === 0) {
      return emptyStates.noResults || {
        title: 'Nenhum resultado encontrado',
        description: `Nenhum resultado para "${debouncedSearchQuery}". Tente termos diferentes.`,
      };
    }

    if (!debouncedSearchQuery) {
      return emptyStates.noQuery || null;
    }

    return null;
  }, [searchError, debouncedSearchQuery, minSearchLength, isSearching, suggestions.length, emptyStates]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (fetchAbortControllerRef.current) {
        fetchAbortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    // Search state
    searchQuery: localSearchQuery,
    debouncedSearchQuery,
    isSearching,
    searchError,

    // Search suggestions
    suggestions,
    suggestionsLoading,
    showSuggestions,
    selectedSuggestionIndex,

    // Search history
    searchHistory,

    // Search actions
    setSearchQuery,
    clearSearch,
    addToHistory,
    clearHistory,

    // Suggestion navigation
    selectSuggestion,
    navigateSuggestions,
    selectCurrentSuggestion,

    // Search highlighting
    highlightMatch,

    // Table state integration
    tableState,

    // Empty states
    currentEmptyState,
  };
}