import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";

interface UseSearchInputOptions {
  paramName?: string;
  debounceMs?: number;
}

interface UseSearchInputReturn {
  inputValue: string;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setInputValue: (value: string) => void;
  clearSearch: () => void;
  isDebouncing: boolean;
}

/**
 * A reusable hook for managing search input state with proper debouncing and URL synchronization.
 *
 * Features:
 * - Immediate input updates for responsive UI
 * - Debounced URL parameter updates
 * - Proper cleanup and cancellation
 * - No text reappearing when holding backspace
 * - Synchronization with URL changes (browser back/forward)
 *
 * @param options Configuration options
 * @returns Search input state and handlers
 */
export function useSearchInput(options: UseSearchInputOptions = {}): UseSearchInputReturn {
  const { paramName = "searchingFor", debounceMs = 500 } = options;

  const [searchParams, setSearchParams] = useSearchParams();
  const [inputValue, setInputValue] = useState(() => searchParams.get(paramName) || "");
  const [isDebouncing, setIsDebouncing] = useState(false);

  // Refs for cleanup and preventing circular updates
  const mountedRef = useRef(true);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSyncingFromUrlRef = useRef(false);
  const lastUrlValueRef = useRef(searchParams.get(paramName) || "");

  // Debounced function to update URL params
  const updateUrlParams = useCallback(
    (value: string) => {
      if (!mountedRef.current) return;

      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          const currentValue = params.get(paramName);

          // Only update if the value actually changed
          if (value) {
            if (currentValue !== value) {
              params.set(paramName, value);
              return params;
            }
          } else {
            if (currentValue !== null) {
              params.delete(paramName);
              return params;
            }
          }

          return prev; // No change needed
        },
        { replace: true },
      );

      setIsDebouncing(false);
    },
    [setSearchParams, paramName],
  );

  // Handle input changes with immediate UI update and debounced URL update
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      // Prevent circular updates during URL sync
      if (isSyncingFromUrlRef.current) {
        return;
      }

      const value = e.target.value;

      // Immediate UI update for responsiveness
      setInputValue(value);

      // Clear existing timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      // Set debouncing state
      setIsDebouncing(true);

      // Set new timeout for URL update
      debounceTimeoutRef.current = setTimeout(() => {
        updateUrlParams(value);
        debounceTimeoutRef.current = null;
      }, debounceMs);
    },
    [updateUrlParams, debounceMs],
  );

  // Manual setter for input value (also debounced)
  const setInputValueManual = useCallback(
    (value: string) => {
      // Prevent circular updates during URL sync
      if (isSyncingFromUrlRef.current) {
        return;
      }

      setInputValue(value);

      // Clear existing timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      // Set debouncing state
      setIsDebouncing(true);

      // Set new timeout for URL update
      debounceTimeoutRef.current = setTimeout(() => {
        updateUrlParams(value);
        debounceTimeoutRef.current = null;
      }, debounceMs);
    },
    [updateUrlParams, debounceMs],
  );

  // Clear search with immediate effect
  const clearSearch = useCallback(() => {
    // Clear debounce timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }

    setInputValue("");
    setIsDebouncing(false);

    // Immediately update URL
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.delete(paramName);
        return params;
      },
      { replace: true },
    );
  }, [setSearchParams, paramName]);

  // Sync input value when URL changes externally (browser navigation, filter reset, etc.)
  useEffect(() => {
    const urlValue = searchParams.get(paramName) || "";

    // Only sync if:
    // 1. URL value is different from current input value
    // 2. We're not currently debouncing (to avoid interrupting user input)
    // 3. The URL value has actually changed from what we last knew
    if (urlValue !== inputValue && !isDebouncing && urlValue !== lastUrlValueRef.current) {
      isSyncingFromUrlRef.current = true;
      setInputValue(urlValue);
      lastUrlValueRef.current = urlValue;

      // Reset sync flag after state update
      setTimeout(() => {
        isSyncingFromUrlRef.current = false;
      }, 0);
    } else {
      // Update our reference even if we don't sync
      lastUrlValueRef.current = urlValue;
    }
  }, [searchParams, paramName, inputValue, isDebouncing]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return {
    inputValue,
    handleInputChange,
    setInputValue: setInputValueManual,
    clearSearch,
    isDebouncing,
  };
}

/**
 * Example usage:
 *
 * ```typescript
 * const SearchComponent = () => {
 *   const { inputValue, handleInputChange, clearSearch, isDebouncing } = useSearchInput({
 *     paramName: 'searchingFor',
 *     debounceMs: 500
 *   });
 *
 *   return (
 *     <div>
 *       <input
 *         type="text"
 *         value={inputValue}
 *         onChange={handleInputChange}
 *         placeholder="Search..."
 *       />
 *       {isDebouncing && <span>Searching...</span>}
 *       <button onClick={clearSearch}>Clear</button>
 *     </div>
 *   );
 * };
 * ```
 */
