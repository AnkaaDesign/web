import { useState, useEffect, useCallback, useRef } from "react";

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
  // Track previous default columns to detect new additions
  const prevDefaultColumnsRef = useRef<Set<string>>(defaultColumns);

  // Initialize state from localStorage or use defaults
  const [visibleColumns, setVisibleColumnsState] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const storedSet = new Set(parsed);

          // Merge strategy: Keep user preferences but ensure new required columns are added
          // Required columns are: checkbox, editable inputs (quantityInput, priceInput, etc.)
          const requiredColumns = Array.from(defaultColumns).filter(col =>
            col === 'checkbox' || col.endsWith('Input')
          );

          // Add any required columns that are missing from stored data
          requiredColumns.forEach(col => storedSet.add(col));

          return storedSet;
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error(`Failed to parse stored column visibility for key "${storageKey}":`, error);
      }
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
        if (process.env.NODE_ENV !== 'production') {
          console.error(`Failed to save column visibility to localStorage for key "${storageKey}":`, error);
        }
      }
    },
    [storageKey]
  );

  // Sync new default columns when defaultColumns changes (e.g., when user data loads)
  // This ensures that columns added to defaults after initial load are included
  useEffect(() => {
    const prevDefaults = prevDefaultColumnsRef.current;

    // Find columns that are in new defaults but weren't in previous defaults
    const newDefaultColumns = Array.from(defaultColumns).filter(
      col => !prevDefaults.has(col)
    );

    if (newDefaultColumns.length > 0) {
      setVisibleColumnsState(current => {
        const updated = new Set(current);
        newDefaultColumns.forEach(col => updated.add(col));

        // Also update localStorage
        try {
          localStorage.setItem(storageKey, JSON.stringify(Array.from(updated)));
        } catch (error) {
          if (process.env.NODE_ENV !== 'production') {
            console.error(`Failed to save column visibility to localStorage for key "${storageKey}":`, error);
          }
        }

        return updated;
      });
    }

    // Update ref for next comparison
    prevDefaultColumnsRef.current = defaultColumns;
  }, [defaultColumns, storageKey]);

  return {
    visibleColumns,
    setVisibleColumns,
  };
}