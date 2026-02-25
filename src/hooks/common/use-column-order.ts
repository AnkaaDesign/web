import { useState, useCallback, useMemo } from "react";

/**
 * Hook to manage column order with localStorage persistence.
 *
 * On init: loads from localStorage, then reconciles with current allColumnIds:
 * - Removes stale IDs (columns no longer in allColumnIds)
 * - Appends new IDs at the end (columns added since last save)
 *
 * @param storageKey - Unique key for localStorage (e.g., "task-preparation-column-order")
 * @param allColumnIds - Current full list of column IDs (definition order)
 * @returns { columnOrder, setColumnOrder, resetColumnOrder }
 */
export function useColumnOrder(storageKey: string, allColumnIds: string[]) {
  const defaultOrder = useMemo(() => allColumnIds, [allColumnIds]);

  const [columnOrder, setColumnOrderState] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return reconcile(parsed, allColumnIds);
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error(`Failed to parse stored column order for key "${storageKey}":`, error);
      }
    }
    return allColumnIds;
  });

  const setColumnOrder = useCallback(
    (newOrder: string[]) => {
      setColumnOrderState(newOrder);
      try {
        localStorage.setItem(storageKey, JSON.stringify(newOrder));
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error(`Failed to save column order to localStorage for key "${storageKey}":`, error);
        }
      }
    },
    [storageKey],
  );

  const resetColumnOrder = useCallback(() => {
    setColumnOrderState(defaultOrder);
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error(`Failed to remove column order from localStorage for key "${storageKey}":`, error);
      }
    }
  }, [storageKey, defaultOrder]);

  return { columnOrder, setColumnOrder, resetColumnOrder };
}

/**
 * Reconcile a stored order with the current set of column IDs.
 * - Removes IDs that no longer exist
 * - Appends new IDs at the end
 */
function reconcile(stored: string[], current: string[]): string[] {
  const currentSet = new Set(current);
  // Keep only IDs that still exist, in stored order
  const kept = stored.filter((id) => currentSet.has(id));
  // Find new IDs not in stored order and append them
  const keptSet = new Set(kept);
  const newIds = current.filter((id) => !keptSet.has(id));
  return [...kept, ...newIds];
}
