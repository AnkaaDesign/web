import { useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";

// Type definitions
export interface PaginationState {
  page: number;
  pageSize: number;
}

export interface SelectionState {
  selectedIds: string[];
}

export interface SortState {
  sortConfigs: Array<{
    column: string;
    direction: "asc" | "desc";
  }>;
}

export interface FilterState {
  showSelectedOnly: boolean;
}

export interface TableState extends PaginationState, SelectionState, SortState, FilterState {}

// Helper function to serialize value for URL
function serializeValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;

  // For default values, don't include in URL to keep it clean
  // NOTE: We don't return null for empty arrays because we need to distinguish
  // between "never set" and "explicitly cleared"
  if (typeof value === "number" && value === 1) return null; // default page
  if (typeof value === "number" && value === 40) return null; // default pageSize

  return JSON.stringify(value);
}

export interface UseTableStateOptions {
  /**
   * Default page size (default: 40)
   */
  defaultPageSize?: number;
  /**
   * Debounce delay for URL updates in milliseconds (default: 100)
   */
  debounceMs?: number;
  /**
   * Whether to reset selection when pagination changes (default: false)
   */
  resetSelectionOnPageChange?: boolean;
  /**
   * Default sort configuration to apply when no sort is set in URL
   */
  defaultSort?: Array<{ column: string; direction: "asc" | "desc" }>;
}

/**
 * Converts sortConfigs array to Prisma orderBy format
 * @param sortConfigs Array of sort configurations from useTableState
 * @returns Prisma orderBy object or array
 */
export function convertSortConfigsToOrderBy(sortConfigs: Array<{ column: string; direction: "asc" | "desc" }>) {
  if (sortConfigs.length === 0) {
    return undefined;
  }

  const orderByArray = sortConfigs.map((config, index) => {
    // Guard against undefined column
    if (!config.column) {
      return {};
    }

    const fieldPath = config.column.split(".");

    if (fieldPath.length === 1) {
      // Direct field: { name: "asc" }
      // Special cases: Map enum fields to their order fields for proper sorting
      if (fieldPath[0] === "severity") {
        return { severityOrder: config.direction };
      }
      if (fieldPath[0] === "status") {
        return { statusOrder: config.direction };
      }
      // Special case: identificador is a computed field (serialNumber || truck.plate)
      // Sort by serialNumber as the primary identifier
      if (fieldPath[0] === "identificador") {
        return {
          serialNumber: {
            sort: config.direction,
            nulls: "last" as const
          }
        };
      }
      // Handle null values for forecastDate - put nulls at the end
      if (fieldPath[0] === "forecastDate") {
        return {
          forecastDate: {
            sort: config.direction,
            nulls: "last" as const
          }
        };
      }
      return { [fieldPath[0]]: config.direction };
    } else if (fieldPath.length === 2) {
      // Nested field
      // Only apply nulls handling for position relation to ensure users without positions appear at the end
      if (fieldPath[0] === "position") {
        return {
          [fieldPath[0]]: {
            [fieldPath[1]]: {
              sort: config.direction,
              nulls: "last" as const
            }
          }
        };
      } else {
        // For other relations (like sector), use simple direction format
        return {
          [fieldPath[0]]: {
            [fieldPath[1]]: config.direction
          }
        };
      }
    } else if (fieldPath.length === 3) {
      // Deeply nested field
      // Only apply nulls handling if position is in the path
      if (fieldPath[0] === "position" || fieldPath[1] === "position") {
        return {
          [fieldPath[0]]: {
            [fieldPath[1]]: {
              [fieldPath[2]]: {
                sort: config.direction,
                nulls: "last" as const
              }
            }
          }
        };
      } else {
        // For other relations, use simple direction format
        return {
          [fieldPath[0]]: {
            [fieldPath[1]]: {
              [fieldPath[2]]: config.direction
            }
          }
        };
      }
    } else {
      // Fallback for deeper nesting - treat as single field
      return { [config.column]: config.direction };
    }
  });

  // Return single object if only one sort to avoid array serialization issues
  // Return array only for multiple sorts (Prisma supports both formats)
  return orderByArray.length === 1 ? orderByArray[0] : orderByArray;
}

/**
 * Hook for managing table state (pagination, selection, sorting) in URL
 */
export function useTableState(options: UseTableStateOptions = {}) {
  const { defaultPageSize = 40, resetSelectionOnPageChange = false, defaultSort = [] } = options;

  const [searchParams, setSearchParams] = useSearchParams();

  // Track last clicked item for shift+click range selection
  const lastClickedIdRef = useRef<string | null>(null);

  // Parse current state from URL
  const paginationState = useMemo(() => {
    const pageValue = searchParams.get("page");
    const pageSizeValue = searchParams.get("pageSize");

    const result = {
      page: pageValue ? Math.max(1, parseInt(pageValue, 10) || 1) : 1,
      pageSize: pageSizeValue ? Math.max(1, Math.min(100, parseInt(pageSizeValue, 10)) || defaultPageSize) : defaultPageSize,
    };

    return result;
  }, [searchParams, defaultPageSize]);

  const selectionState = useMemo(() => {
    const selectedValue = searchParams.get("selected");
    let selectedIds: string[] = [];

    if (selectedValue) {
      try {
        const parsed = JSON.parse(selectedValue);
        if (Array.isArray(parsed)) {
          selectedIds = parsed.filter((id) => typeof id === "string");
        }
      } catch {
        // Ignore parsing errors
      }
    }

    return { selectedIds };
  }, [searchParams]);

  const sortState = useMemo(() => {
    const sortValue = searchParams.get("sort");
    let sortConfigs: Array<{ column: string; direction: "asc" | "desc" }> = [];

    if (sortValue !== null) {
      try {
        const parsed = JSON.parse(sortValue);
        if (Array.isArray(parsed)) {
          sortConfigs = parsed.filter((config) => config && typeof config.column === "string" && (config.direction === "asc" || config.direction === "desc"));
        }
      } catch {
        // Ignore parsing errors
      }
      // If sort parameter exists in URL (even if empty array), don't apply defaults
    } else if (!searchParams.has("sort") && defaultSort.length > 0) {
      // Only apply default sort if the sort parameter has never been set
      sortConfigs = defaultSort;
    }

    return { sortConfigs };
  }, [searchParams, defaultSort]);

  const filterState = useMemo(() => {
    const showSelectedOnlyValue = searchParams.get("showSelectedOnly");
    return {
      showSelectedOnly: showSelectedOnlyValue === "true",
    };
  }, [searchParams]);

  // Combined state
  const tableState: TableState = useMemo(
    () => ({
      ...paginationState,
      ...selectionState,
      ...sortState,
      ...filterState,
    }),
    [paginationState, selectionState, sortState, filterState],
  );

  // Update URL function
  const updateUrl = useCallback(
    (updater: (params: URLSearchParams) => void) => {
      // Update immediately without requestAnimationFrame
      setSearchParams(
        (prev) => {
          const newParams = new URLSearchParams(prev);
          updater(newParams);
          return newParams;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // Pagination methods
  const setPage = useCallback(
    (page: number) => {
      // Convert from 0-based (component) to 1-based (URL)
      const newPage = Math.max(1, page + 1);
      updateUrl((params) => {
        if (newPage === 1) {
          params.delete("page");
        } else {
          params.set("page", newPage.toString());
        }

        // Reset selection if configured to do so
        if (resetSelectionOnPageChange) {
          params.delete("selected");
        }
      });
    },
    [updateUrl, resetSelectionOnPageChange],
  );

  const setPageSize = useCallback(
    (pageSize: number) => {
      const newPageSize = Math.max(1, Math.min(100, pageSize));
      updateUrl((params) => {
        if (newPageSize === defaultPageSize) {
          params.delete("pageSize");
        } else {
          params.set("pageSize", newPageSize.toString());
        }

        // Reset to page 1 when changing page size
        params.delete("page");

        // Reset selection if configured to do so
        if (resetSelectionOnPageChange) {
          params.delete("selected");
        }
      });
    },
    [updateUrl, defaultPageSize, resetSelectionOnPageChange],
  );

  // Selection methods
  const setSelectedIds = useCallback(
    (selectedIds: string[]) => {
      updateUrl((params) => {
        const serialized = serializeValue(selectedIds);
        if (serialized === null) {
          params.delete("selected");
        } else {
          params.set("selected", serialized);
        }
        // If selection is now empty and showSelectedOnly is active, disable it
        // to prevent showing an empty table
        if (selectedIds.length === 0 && params.get("showSelectedOnly") === "true") {
          params.delete("showSelectedOnly");
        }
      });
    },
    [updateUrl],
  );

  const toggleSelection = useCallback(
    (id: string) => {
      const currentSelected = new Set(tableState.selectedIds);
      if (currentSelected.has(id)) {
        currentSelected.delete(id);
      } else {
        currentSelected.add(id);
      }
      setSelectedIds(Array.from(currentSelected));
    },
    [tableState.selectedIds, setSelectedIds],
  );

  const selectAll = useCallback(
    (allIds: string[]) => {
      setSelectedIds(allIds);
    },
    [setSelectedIds],
  );

  const deselectAll = useCallback(() => {
    setSelectedIds([]);
  }, [setSelectedIds]);

  const toggleSelectAll = useCallback(
    (allIds: string[]) => {
      if (tableState.selectedIds.length === allIds.length) {
        deselectAll();
      } else {
        selectAll(allIds);
      }
    },
    [tableState.selectedIds.length, selectAll, deselectAll],
  );

  const removeFromSelection = useCallback(
    (idsToRemove: string[]) => {
      const currentSelected = new Set(tableState.selectedIds);
      idsToRemove.forEach((id) => currentSelected.delete(id));
      setSelectedIds(Array.from(currentSelected));
    },
    [tableState.selectedIds, setSelectedIds],
  );

  /**
   * Select a range of items between startId and endId (inclusive)
   * @param orderedIds - Array of IDs in the order they appear in the table
   * @param startId - First ID of the range
   * @param endId - Last ID of the range
   */
  const selectRange = useCallback(
    (orderedIds: string[], startId: string, endId: string) => {
      const startIndex = orderedIds.indexOf(startId);
      const endIndex = orderedIds.indexOf(endId);

      if (startIndex === -1 || endIndex === -1) return;

      const start = Math.min(startIndex, endIndex);
      const end = Math.max(startIndex, endIndex);
      const rangeIds = orderedIds.slice(start, end + 1);

      // Add range to current selection
      const currentSelected = new Set(tableState.selectedIds);
      rangeIds.forEach((id) => currentSelected.add(id));
      setSelectedIds(Array.from(currentSelected));
    },
    [tableState.selectedIds, setSelectedIds],
  );

  /**
   * Handle row click with shift+click support for range selection
   * @param id - The ID of the clicked row
   * @param orderedIds - Array of all IDs in the order they appear in the table
   * @param isShiftKey - Whether shift key was held during click
   */
  const handleRowClick = useCallback(
    (id: string, orderedIds: string[], isShiftKey: boolean) => {
      if (isShiftKey && lastClickedIdRef.current) {
        // Shift+click: select range from last clicked to current
        selectRange(orderedIds, lastClickedIdRef.current, id);
      } else {
        // Regular click: toggle selection
        toggleSelection(id);
      }
      // Always update last clicked ID
      lastClickedIdRef.current = id;
    },
    [selectRange, toggleSelection],
  );

  /**
   * Get the last clicked ID (useful for external shift+click handling)
   */
  const getLastClickedId = useCallback(() => lastClickedIdRef.current, []);

  /**
   * Set the last clicked ID (useful when selection happens outside of handleRowClick)
   */
  const setLastClickedId = useCallback((id: string | null) => {
    lastClickedIdRef.current = id;
  }, []);

  // Sort methods
  const setSortConfigs = useCallback(
    (sortConfigs: Array<{ column: string; direction: "asc" | "desc" }>) => {
      updateUrl((params) => {
        const serialized = serializeValue(sortConfigs);
        if (serialized === null) {
          params.delete("sort");
        } else {
          params.set("sort", serialized);
        }
      });
    },
    [updateUrl],
  );

  const addSort = useCallback(
    (column: string, direction: "asc" | "desc" = "asc") => {
      // Add new sort to the end for cumulative sorting (first clicked = primary)
      const newConfigs = [...tableState.sortConfigs, { column, direction }];
      setSortConfigs(newConfigs);
    },
    [tableState.sortConfigs, setSortConfigs],
  );

  const removeSort = useCallback(
    (column: string) => {
      const newConfigs = tableState.sortConfigs.filter((config) => config.column !== column);
      setSortConfigs(newConfigs);
    },
    [tableState.sortConfigs, setSortConfigs],
  );

  const toggleSort = useCallback(
    (column: string) => {
      const existingConfigIndex = tableState.sortConfigs.findIndex((config) => config.column === column);

      if (existingConfigIndex === -1) {
        // Add new sort to the END for cumulative sorting (first clicked = primary)
        const newConfigs = [...tableState.sortConfigs, { column, direction: "asc" as const }];
        setSortConfigs(newConfigs);
      } else {
        const existingConfig = tableState.sortConfigs[existingConfigIndex];
        if (existingConfig.direction === "asc") {
          // Change to desc but KEEP IN SAME POSITION (maintain sort priority)
          const newConfigs = [...tableState.sortConfigs];
          newConfigs[existingConfigIndex] = { column, direction: "desc" as const };
          setSortConfigs(newConfigs);
        } else {
          // Remove sort
          removeSort(column);
        }
      }
    },
    [tableState.sortConfigs, removeSort, setSortConfigs],
  );

  const clearSort = useCallback(() => {
    setSortConfigs([]);
  }, [setSortConfigs]);

  // Helper methods
  const getSortDirection = useCallback(
    (column: string): "asc" | "desc" | null => {
      const config = tableState.sortConfigs.find((config) => config.column === column);
      return config?.direction || null;
    },
    [tableState.sortConfigs],
  );

  const getSortOrder = useCallback(
    (column: string): number | null => {
      const index = tableState.sortConfigs.findIndex((config) => config.column === column);
      return index === -1 ? null : index;
    },
    [tableState.sortConfigs],
  );

  const isSelected = useCallback(
    (id: string): boolean => {
      return tableState.selectedIds.includes(id);
    },
    [tableState.selectedIds],
  );

  const isAllSelected = useCallback(
    (allIds: string[]): boolean => {
      return allIds.length > 0 && allIds.every((id) => tableState.selectedIds.includes(id));
    },
    [tableState.selectedIds],
  );

  const isPartiallySelected = useCallback(
    (allIds: string[]): boolean => {
      const selectedCount = allIds.filter((id) => tableState.selectedIds.includes(id)).length;
      return selectedCount > 0 && selectedCount < allIds.length;
    },
    [tableState.selectedIds],
  );

  // Reset methods
  const resetPagination = useCallback(() => {
    updateUrl((params) => {
      params.delete("page");
      params.delete("pageSize");
    });
  }, [updateUrl]);

  const resetSelection = useCallback(() => {
    updateUrl((params) => {
      params.delete("selected");
    });
  }, [updateUrl]);

  const resetSort = useCallback(() => {
    updateUrl((params) => {
      params.delete("sort");
    });
  }, [updateUrl]);

  const resetAll = useCallback(() => {
    updateUrl((params) => {
      params.delete("page");
      params.delete("pageSize");
      params.delete("selected");
      params.delete("sort");
      params.delete("showSelectedOnly");
    });
  }, [updateUrl]);

  // Show selected only methods
  const setShowSelectedOnly = useCallback(
    (showSelectedOnly: boolean) => {
      updateUrl((params) => {
        if (showSelectedOnly) {
          params.set("showSelectedOnly", "true");
          // Reset to page 1 when toggling filter
          params.delete("page");
        } else {
          params.delete("showSelectedOnly");
        }
      });
    },
    [updateUrl],
  );

  const toggleShowSelectedOnly = useCallback(() => {
    setShowSelectedOnly(!tableState.showSelectedOnly);
  }, [tableState.showSelectedOnly, setShowSelectedOnly]);

  return {
    // State
    ...tableState,
    // Convert page from 1-based (URL) to 0-based (component)
    page: tableState.page - 1,

    // Pagination
    setPage,
    setPageSize,
    resetPagination,

    // Selection
    selectedIds: tableState.selectedIds,
    setSelectedIds,
    toggleSelection,
    selectAll,
    deselectAll,
    toggleSelectAll,
    removeFromSelection,
    isSelected,
    isAllSelected,
    isPartiallySelected,
    resetSelection,

    // Shift+click range selection
    selectRange,
    handleRowClick,
    getLastClickedId,
    setLastClickedId,

    // Sorting
    sortConfigs: tableState.sortConfigs,
    setSortConfigs,
    addSort,
    removeSort,
    toggleSort,
    clearSort,
    getSortDirection,
    getSortOrder,
    resetSort,

    // Show selected only
    showSelectedOnly: tableState.showSelectedOnly,
    setShowSelectedOnly,
    toggleShowSelectedOnly,

    // Global reset
    resetAll,

    // Helper computed values
    hasSelection: tableState.selectedIds.length > 0,
    selectionCount: tableState.selectedIds.length,
    hasSorting: tableState.sortConfigs.length > 0,
    sortCount: tableState.sortConfigs.length,
  };
}
