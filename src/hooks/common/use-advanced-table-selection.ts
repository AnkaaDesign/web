import { useCallback, useMemo, useRef } from "react";
import { useUnifiedTableState } from "./use-unified-table-state";

export interface SelectionStats {
  selectedCount: number;
  totalCount: number;
  currentPageCount: number;
  selectedCurrentPageCount: number;
  allCurrentPageSelected: boolean;
  someCurrentPageSelected: boolean;
  allFilteredSelected: boolean;
  someFilteredSelected: boolean;
  selectionMode: "page" | "all" | "filtered";
}

export interface AdvancedSelectionOptions<T extends { id: string }> {
  /**
   * Current page data
   */
  currentPageData: T[];

  /**
   * All filtered data (across all pages)
   */
  allFilteredData?: T[];

  /**
   * Total count of all data (used for cross-page selection)
   */
  totalCount?: number;

  /**
   * Function to fetch all IDs when selecting across all pages
   */
  getAllIds?: () => Promise<string[]>;

  /**
   * Function to fetch all filtered IDs
   */
  getAllFilteredIds?: () => Promise<string[]>;

  /**
   * Callback when selection changes
   */
  onSelectionChange?: (selectedIds: string[], stats: SelectionStats) => void;

  /**
   * Whether to preserve selection when navigating pages
   */
  preserveSelectionAcrossPages?: boolean;

  /**
   * Maximum number of items that can be selected
   */
  maxSelection?: number;
}

/**
 * Advanced table selection hook with comprehensive selection features:
 * - URL state persistence
 * - Keyboard shortcuts (Shift+click, Ctrl+click)
 * - Cross-page selection
 * - Filtered selection
 * - Selection statistics
 * - Bulk actions support
 */
export function useAdvancedTableSelection<T extends { id: string }>(options: AdvancedSelectionOptions<T>) {
  const { currentPageData, allFilteredData, totalCount = 0, getAllIds, getAllFilteredIds, onSelectionChange, preserveSelectionAcrossPages = true, maxSelection } = options;

  const {
    selectedIds,
    selectionMode,
    showSelectedOnly,
    selectionCount,
    hasSelection,
    toggleSelection,
    setSelectedIds,
    setSelectionMode,
    handleKeyboardSelection,
    resetSelection,
    selectAll,
    deselectAll,
    toggleSelectAll,
    selectAllFiltered,
    selectAllAcrossPages,
    setShowSelectedOnly,
    toggleShowSelectedOnly,
    isSelected,
    isAllSelected,
    isPartiallySelected,
    getSelectedCount,
  } = useUnifiedTableState();

  const lastClickIndexRef = useRef<number | null>(null);

  // Current page item IDs
  const currentPageIds = useMemo(() => currentPageData.map((item) => item.id), [currentPageData]);

  // All filtered item IDs
  const allFilteredIds = useMemo(() => allFilteredData?.map((item) => item.id) ?? currentPageIds, [allFilteredData, currentPageIds]);

  // Selection statistics
  const selectionStats = useMemo((): SelectionStats => {
    const selectedCurrentPageCount = getSelectedCount(currentPageIds);
    const allCurrentPageSelected = isAllSelected(currentPageIds);
    const someCurrentPageSelected = isPartiallySelected(currentPageIds);

    const selectedFilteredCount = getSelectedCount(allFilteredIds);
    const allFilteredSelected = allFilteredIds.length > 0 && selectedFilteredCount === allFilteredIds.length;
    const someFilteredSelected = selectedFilteredCount > 0 && selectedFilteredCount < allFilteredIds.length;

    return {
      selectedCount: selectionCount,
      totalCount,
      currentPageCount: currentPageIds.length,
      selectedCurrentPageCount,
      allCurrentPageSelected,
      someCurrentPageSelected,
      allFilteredSelected,
      someFilteredSelected,
      selectionMode,
    };
  }, [selectionCount, totalCount, currentPageIds.length, getSelectedCount, currentPageIds, isAllSelected, isPartiallySelected, allFilteredIds, selectionMode]);

  // Enhanced row selection with keyboard shortcuts
  const handleRowSelection = useCallback(
    (item: T, event?: React.MouseEvent) => {
      const itemIndex = currentPageData.findIndex((d) => d.id === item.id);

      if (!event || (!event.shiftKey && !event.ctrlKey && !event.metaKey)) {
        // Regular click
        toggleSelection(item.id);
        lastClickIndexRef.current = itemIndex;
      } else {
        // Keyboard-modified click
        handleKeyboardSelection(item.id, currentPageIds, event);
        if (!event.shiftKey) {
          lastClickIndexRef.current = itemIndex;
        }
      }
    },
    [currentPageData, currentPageIds, toggleSelection, handleKeyboardSelection],
  );

  // Enhanced select all with different modes
  const handleSelectAll = useCallback(() => {
    toggleSelectAll(currentPageIds);
  }, [toggleSelectAll, currentPageIds]);

  const handleSelectAllFiltered = useCallback(async () => {
    if (getAllFilteredIds) {
      const ids = await getAllFilteredIds();
      selectAllFiltered(ids);
    } else {
      selectAllFiltered(allFilteredIds);
    }
  }, [getAllFilteredIds, selectAllFiltered, allFilteredIds]);

  const handleSelectAllAcrossPages = useCallback(async () => {
    if (getAllIds) {
      selectAllAcrossPages(totalCount, getAllIds);
    }
  }, [getAllIds, selectAllAcrossPages, totalCount]);

  // Selection validation
  const canSelectMore = useCallback(
    (count: number = 1) => {
      if (!maxSelection) return true;
      return selectionCount + count <= maxSelection;
    },
    [selectionCount, maxSelection],
  );

  const addToSelection = useCallback(
    (itemIds: string[]) => {
      if (!canSelectMore(itemIds.length)) {
        return false; // Selection would exceed maximum
      }

      const newSelectedIds = Array.from(new Set([...selectedIds, ...itemIds]));
      setSelectedIds(newSelectedIds);
      return true;
    },
    [selectedIds, setSelectedIds, canSelectMore],
  );

  const removeFromSelection = useCallback(
    (itemIds: string[]) => {
      const newSelectedIds = selectedIds.filter((id) => !itemIds.includes(id));
      setSelectedIds(newSelectedIds);
    },
    [selectedIds, setSelectedIds],
  );

  // Selection range operations
  const selectRange = useCallback(
    (startId: string, endId: string) => {
      const startIndex = currentPageIds.indexOf(startId);
      const endIndex = currentPageIds.indexOf(endId);

      if (startIndex === -1 || endIndex === -1) return;

      const start = Math.min(startIndex, endIndex);
      const end = Math.max(startIndex, endIndex);
      const rangeIds = currentPageIds.slice(start, end + 1);

      addToSelection(rangeIds);
    },
    [currentPageIds, addToSelection],
  );

  const deselectRange = useCallback(
    (startId: string, endId: string) => {
      const startIndex = currentPageIds.indexOf(startId);
      const endIndex = currentPageIds.indexOf(endId);

      if (startIndex === -1 || endIndex === -1) return;

      const start = Math.min(startIndex, endIndex);
      const end = Math.max(startIndex, endIndex);
      const rangeIds = currentPageIds.slice(start, end + 1);

      removeFromSelection(rangeIds);
    },
    [currentPageIds, removeFromSelection],
  );

  // Invert selection
  const invertSelection = useCallback(() => {
    const currentSelected = new Set(selectedIds);
    const newSelection = currentPageIds.filter((id) => !currentSelected.has(id));
    setSelectedIds(newSelection);
  }, [selectedIds, currentPageIds, setSelectedIds]);

  const invertSelectionFiltered = useCallback(() => {
    const currentSelected = new Set(selectedIds);
    const newSelection = allFilteredIds.filter((id) => !currentSelected.has(id));
    setSelectedIds(newSelection);
  }, [selectedIds, allFilteredIds, setSelectedIds]);

  // Get selected items
  const getSelectedItems = useCallback(() => {
    return currentPageData.filter((item) => isSelected(item.id));
  }, [currentPageData, isSelected]);

  const getSelectedItemsFromFiltered = useCallback(() => {
    if (!allFilteredData) return getSelectedItems();
    return allFilteredData.filter((item) => isSelected(item.id));
  }, [allFilteredData, getSelectedItems, isSelected]);

  // Selection persistence
  const saveSelectionState = useCallback(() => {
    if (typeof window !== "undefined" && preserveSelectionAcrossPages) {
      const state = {
        selectedIds,
        selectionMode,
        timestamp: Date.now(),
      };
      sessionStorage.setItem("table-selection-state", JSON.stringify(state));
    }
  }, [selectedIds, selectionMode, preserveSelectionAcrossPages]);

  const restoreSelectionState = useCallback(() => {
    if (typeof window !== "undefined" && preserveSelectionAcrossPages) {
      const stored = sessionStorage.getItem("table-selection-state");
      if (stored) {
        try {
          const state = JSON.parse(stored);
          // Only restore if the state is recent (within last hour)
          if (Date.now() - state.timestamp < 3600000) {
            setSelectedIds(state.selectedIds || []);
            setSelectionMode(state.selectionMode || "page");
          }
        } catch (error) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn("Failed to restore selection state:", error);
          }
        }
      }
    }
  }, [setSelectedIds, setSelectionMode, preserveSelectionAcrossPages]);

  // Notify about selection changes
  const notifySelectionChange = useCallback(() => {
    if (onSelectionChange) {
      onSelectionChange(selectedIds, selectionStats);
    }
  }, [onSelectionChange, selectedIds, selectionStats]);

  // Effect to save selection state
  useMemo(() => {
    saveSelectionState();
    notifySelectionChange();
  }, [saveSelectionState, notifySelectionChange]);

  return {
    // Selection state
    selectedIds,
    selectionMode,
    showSelectedOnly,
    selectionStats,
    hasSelection,
    canSelectMore,

    // Selection operations
    handleRowSelection,
    handleSelectAll,
    handleSelectAllFiltered,
    handleSelectAllAcrossPages,
    resetSelection,
    addToSelection,
    removeFromSelection,
    selectRange,
    deselectRange,
    invertSelection,
    invertSelectionFiltered,

    // Selection helpers
    isSelected,
    isAllSelected: (ids?: string[]) => isAllSelected(ids || currentPageIds),
    isPartiallySelected: (ids?: string[]) => isPartiallySelected(ids || currentPageIds),
    getSelectedItems,
    getSelectedItemsFromFiltered,

    // Show selected only
    setShowSelectedOnly,
    toggleShowSelectedOnly,

    // Persistence
    saveSelectionState,
    restoreSelectionState,

    // Direct access to lower-level methods for advanced use cases
    setSelectedIds,
    setSelectionMode,
  };
}
