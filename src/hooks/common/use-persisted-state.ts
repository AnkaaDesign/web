import { useState, useEffect, useCallback } from "react";

/**
 * A `useState` drop-in that transparently persists its value to localStorage,
 * so ephemeral UI state (filters, sorting, simulation configs) survives page
 * navigation and reloads.
 *
 * @param storageKey - Unique localStorage key (e.g. "bonus-simulation-filters")
 * @param defaultValue - Value used when nothing is stored yet (or parsing fails)
 * @returns `[value, setValue, clear]` — `setValue` accepts a value or updater
 *          function (like `useState`); `clear` removes the persisted entry.
 *
 * @example
 * ```tsx
 * const [filters, setFilters] = usePersistedState("bonus-simulation-filters", {
 *   sectorIds: [] as string[],
 *   showOnlyEligible: true,
 * });
 * ```
 */
export function usePersistedState<T>(
  storageKey: string,
  defaultValue: T
): [T, React.Dispatch<React.SetStateAction<T>>, () => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored != null) {
        return JSON.parse(stored) as T;
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error(`Failed to read persisted state for key "${storageKey}":`, error);
      }
    }
    return defaultValue;
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error(`Failed to persist state for key "${storageKey}":`, error);
      }
    }
  }, [storageKey, state]);

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error(`Failed to clear persisted state for key "${storageKey}":`, error);
      }
    }
  }, [storageKey]);

  return [state, setState, clear];
}
