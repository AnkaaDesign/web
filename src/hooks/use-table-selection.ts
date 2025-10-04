import { useCallback, useEffect } from "react";
import { useTableState } from "./use-table-state";

interface UseTableSelectionOptions<T extends { id: string }> {
  data: T[];
  onSelectionChange?: (selectedIds: string[]) => void;
}

/**
 * Wrapper hook that provides a simplified interface for table selection
 * Compatible with the pattern used in sector-table, position-table, etc.
 */
export function useTableSelection<T extends { id: string }>({ data, onSelectionChange }: UseTableSelectionOptions<T>) {
  const { selectedIds, showSelectedOnly, toggleSelection, toggleSelectAll, toggleShowSelectedOnly } = useTableState();

  // Notify parent of selection changes
  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(selectedIds);
    }
  }, [selectedIds, onSelectionChange]);

  // Handle select all with current page data
  const handleSelectAll = useCallback(() => {
    const allIds = data.map((item) => item.id);
    toggleSelectAll(allIds);
  }, [data, toggleSelectAll]);

  // Handle individual row selection
  const handleSelectRow = useCallback(
    (id: string) => {
      toggleSelection(id);
    },
    [toggleSelection],
  );

  return {
    selectedRows: selectedIds, // Renamed to match expected API
    handleSelectAll,
    handleSelectRow,
    toggleShowSelectedOnly,
    showSelectedOnly,
  };
}
