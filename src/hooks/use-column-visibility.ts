import { useState, useEffect, useCallback } from "react";

/**
 * Hook to manage column visibility with localStorage persistence
 *
 * @param storageKey - Unique key for localStorage (e.g., "task-list-visible-columns")
 * @param defaultColumns - Set of column keys that should be visible by default
 * @returns Object with visibleColumns state and setVisibleColumns function
 *
 * @example
 * ```tsx
 * const { visibleColumns, setVisibleColumns } = useColumnVisibility(
 *   "task-list-visible-columns",
 *   new Set(["id", "name", "status"])
 * );
 * ```
 */
export function useColumnVisibility(storageKey: string, defaultColumns: Set<string>) {
  // Initialize state from localStorage or use defaults
  const [visibleColumns, setVisibleColumnsState] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return new Set(parsed);
        }
      }
    } catch (error) {
      console.error(`Failed to parse stored column visibility for key "${storageKey}":`, error);
    }
    // Return default columns if localStorage is empty or invalid
    return defaultColumns;
  });

  // Wrapper function that updates both state and localStorage
  const setVisibleColumns = useCallback(
    (newColumns: Set<string>) => {
      setVisibleColumnsState(newColumns);
      try {
        localStorage.setItem(storageKey, JSON.stringify(Array.from(newColumns)));
      } catch (error) {
        console.error(`Failed to save column visibility to localStorage for key "${storageKey}":`, error);
      }
    },
    [storageKey]
  );

  // Sync with localStorage when storage key changes (shouldn't happen in practice)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setVisibleColumnsState(new Set(parsed));
        }
      }
    } catch (error) {
      console.error(`Failed to sync column visibility from localStorage for key "${storageKey}":`, error);
    }
  }, [storageKey]);

  return {
    visibleColumns,
    setVisibleColumns,
  };
}