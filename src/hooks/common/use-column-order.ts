import { useState, useCallback, useMemo, useEffect, useRef } from "react";

/**
 * Hook to manage column order with localStorage persistence.
 *
 * On init: loads from localStorage, then reconciles with current allColumnIds:
 * - Removes stale IDs (columns no longer in allColumnIds)
 * - Appends new IDs at the end (columns added since last save)
 *
 * When allColumnIds changes (e.g., due to permission-based filtering after user loads):
 * - Re-reconciles the current order with the new column set
 * - Preserves positions of existing columns, appends new ones at the end
 *
 * @param storageKey - Unique key for localStorage (e.g., "task-preparation-column-order")
 * @param allColumnIds - Current full list of column IDs (definition order)
 * @returns { columnOrder, setColumnOrder, resetColumnOrder }
 */
export function useColumnOrder(storageKey: string, allColumnIds: string[]) {
  const defaultOrder = useMemo(() => allColumnIds, [allColumnIds]);

  // Track whether this is the initial render to avoid double-reconciliation
  const isInitialRender = useRef(true);
  // Store the initial allColumnIds to detect meaningful changes
  const prevColumnIdsRef = useRef<string[]>(allColumnIds);

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

  // Re-reconcile when allColumnIds changes (e.g., when user data loads and
  // permission-filtered columns become available)
  useEffect(() => {
    // Skip the initial render since state was already initialized with reconcile
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }

    // Check if allColumnIds actually changed (compare sets)
    const prevSet = new Set(prevColumnIdsRef.current);
    const currSet = new Set(allColumnIds);
    const hasNewColumns = allColumnIds.some(id => !prevSet.has(id));
    const hasRemovedColumns = prevColumnIdsRef.current.some(id => !currSet.has(id));

    if (hasNewColumns || hasRemovedColumns) {
      // Columns changed - re-reconcile to preserve user's order while handling changes
      // Use functional update to avoid dependency on columnOrder state
      setColumnOrderState(currentOrder => {
        // First, try to restore from localStorage (in case user had saved a full order before)
        let baseOrder = currentOrder;
        try {
          const stored = localStorage.getItem(storageKey);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
              // Use stored order as base - it may have positions for columns
              // that weren't available on initial render
              baseOrder = parsed;
            }
          }
        } catch {
          // Use current state as fallback
        }

        const newOrder = reconcile(baseOrder, allColumnIds);

        // Update localStorage with reconciled order
        try {
          localStorage.setItem(storageKey, JSON.stringify(newOrder));
        } catch {
          // Ignore localStorage errors
        }

        return newOrder;
      });
    }

    prevColumnIdsRef.current = allColumnIds;
  }, [allColumnIds, storageKey]);

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
