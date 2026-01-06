import { useCallback, useMemo, useRef, useEffect, useState } from "react";
import { useUrlStateCoordinator } from "./use-url-state-coordinator";

export interface PaginationMeta {
  page: number;
  totalPages: number;
  totalRecords: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  pageSize: number;
  startItem: number;
  endItem: number;
}

export interface PaginationState {
  // Current state
  page: number; // 0-based internally
  pageSize: number;
  totalPages: number;
  totalRecords: number;

  // Derived state
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startItem: number;
  endItem: number;

  // Loading states
  isLoading: boolean;
  isPageChanging: boolean;

  // Edge cases
  isPageOutOfBounds: boolean;
  isEmpty: boolean;
}

export interface PaginationActions {
  // Navigation
  goToPage: (page: number) => void;
  goToFirstPage: () => void;
  goToLastPage: () => void;
  goToNextPage: () => void;
  goToPreviousPage: () => void;

  // Page size
  setPageSize: (pageSize: number) => void;

  // Edge case handlers
  handleDataDeletion: (deletedItemsCount: number) => void;
  adjustPageAfterDeletion: () => void;

  // Keyboard navigation
  handleKeyboardNavigation: (event: KeyboardEvent) => boolean;
}

export interface UsePaginationStateOptions {
  // Basic options
  defaultPageSize?: number;
  pageSizeOptions?: number[];
  maxPageSize?: number;

  // URL integration
  namespace?: string;
  urlParams?: {
    page?: string;
    pageSize?: string;
  };

  // Edge case handling
  autoCorrectPageOutOfBounds?: boolean;
  resetToFirstPageOnFiltersChange?: boolean;

  // Loading states
  isLoading?: boolean;

  // Callbacks
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  onPageOutOfBounds?: (requestedPage: number, maxPage: number) => void;
}

export function usePaginationState(meta: Partial<PaginationMeta> = {}, options: UsePaginationStateOptions = {}) {
  const {
    defaultPageSize = 40,
    pageSizeOptions = [10, 20, 40, 50, 100],
    maxPageSize = 100,
    namespace,
    urlParams = { page: "page", pageSize: "pageSize" },
    autoCorrectPageOutOfBounds = true,
    resetToFirstPageOnFiltersChange = true,
    isLoading = false,
    onPageChange,
    onPageSizeChange,
    onPageOutOfBounds,
  } = options;

  // URL state coordination
  const { searchParams, queueUpdate, batchUpdates, getParamName } = useUrlStateCoordinator({
    namespace,
    debounceMs: {
      pagination: 0, // Immediate updates for pagination
    },
  });

  // Loading state management
  const [isPageChanging, setIsPageChanging] = useState(false);
  const pageChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Parse current state from URL and meta
  const currentState = useMemo<PaginationState>(() => {
    // Parse from URL
    const pageParam = searchParams.get(getParamName(urlParams.page!));
    const pageSizeParam = searchParams.get(getParamName(urlParams.pageSize!));

    const urlPage = pageParam ? Math.max(0, parseInt(pageParam, 10) - 1) : 0;
    const urlPageSize = pageSizeParam ? Math.max(1, Math.min(maxPageSize, parseInt(pageSizeParam, 10))) : defaultPageSize;

    // Calculate from meta
    const totalRecords = meta.totalRecords || 0;
    const pageSize = urlPageSize;
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    const page = Math.min(urlPage, totalPages - 1);

    // Derived calculations
    const hasNextPage = page < totalPages - 1;
    const hasPreviousPage = page > 0;
    const startItem = totalRecords === 0 ? 0 : page * pageSize + 1;
    const endItem = Math.min((page + 1) * pageSize, totalRecords);

    // Edge cases
    const isPageOutOfBounds = urlPage >= totalPages && totalRecords > 0;
    const isEmpty = totalRecords === 0;

    return {
      page,
      pageSize,
      totalPages,
      totalRecords,
      hasNextPage,
      hasPreviousPage,
      startItem,
      endItem,
      isLoading,
      isPageChanging,
      isPageOutOfBounds,
      isEmpty,
    };
  }, [searchParams, getParamName, urlParams.page, urlParams.pageSize, meta.totalRecords, defaultPageSize, maxPageSize, isLoading, isPageChanging]);

  // Auto-correct page out of bounds
  useEffect(() => {
    if (autoCorrectPageOutOfBounds && currentState.isPageOutOfBounds && !isLoading) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`Page ${currentState.page + 1} is out of bounds. Auto-correcting to last page.`);
      }
      goToLastPage();
      onPageOutOfBounds?.(currentState.page + 1, currentState.totalPages);
    }
  }, [currentState.isPageOutOfBounds, autoCorrectPageOutOfBounds, isLoading]);

  // Page changing state management
  const setPageChangingState = useCallback((changing: boolean) => {
    setIsPageChanging(changing);

    if (pageChangeTimeoutRef.current) {
      clearTimeout(pageChangeTimeoutRef.current);
    }

    if (changing) {
      // Auto-clear loading state after 2 seconds as fallback
      pageChangeTimeoutRef.current = setTimeout(() => {
        setIsPageChanging(false);
      }, 2000);
    }
  }, []);

  // Navigation actions
  const goToPage = useCallback(
    (newPage: number) => {
      if (newPage === currentState.page || newPage < 0) return;

      setPageChangingState(true);

      queueUpdate(
        (params) => {
          const pageParam = getParamName(urlParams.page!);
          if (newPage === 0) {
            params.delete(pageParam);
          } else {
            params.set(pageParam, (newPage + 1).toString()); // Convert to 1-based for URL
          }
        },
        "pagination",
        { priority: 100 },
      );

      onPageChange?.(newPage);
    },
    [currentState.page, queueUpdate, getParamName, urlParams.page, onPageChange, setPageChangingState],
  );

  const goToFirstPage = useCallback(() => {
    goToPage(0);
  }, [goToPage]);

  const goToLastPage = useCallback(() => {
    goToPage(Math.max(0, currentState.totalPages - 1));
  }, [goToPage, currentState.totalPages]);

  const goToNextPage = useCallback(() => {
    if (currentState.hasNextPage) {
      goToPage(currentState.page + 1);
    }
  }, [goToPage, currentState.hasNextPage, currentState.page]);

  const goToPreviousPage = useCallback(() => {
    if (currentState.hasPreviousPage) {
      goToPage(currentState.page - 1);
    }
  }, [goToPage, currentState.hasPreviousPage, currentState.page]);

  const setPageSize = useCallback(
    (newPageSize: number) => {
      const validatedPageSize = Math.max(1, Math.min(maxPageSize, newPageSize));

      if (validatedPageSize === currentState.pageSize) return;

      setPageChangingState(true);

      batchUpdates([
        {
          updater: (params) => {
            const pageSizeParam = getParamName(urlParams.pageSize!);
            if (validatedPageSize === defaultPageSize) {
              params.delete(pageSizeParam);
            } else {
              params.set(pageSizeParam, validatedPageSize.toString());
            }
          },
          action: "pagination",
        },
        {
          updater: (params) => {
            // Reset to first page when page size changes
            params.delete(getParamName(urlParams.page!));
          },
          action: "pagination",
        },
      ]);

      onPageSizeChange?.(validatedPageSize);
    },
    [currentState.pageSize, maxPageSize, batchUpdates, getParamName, urlParams.pageSize, urlParams.page, defaultPageSize, onPageSizeChange, setPageChangingState],
  );

  // Edge case handlers
  const handleDataDeletion = useCallback(
    (deletedItemsCount: number) => {
      const newTotalRecords = Math.max(0, currentState.totalRecords - deletedItemsCount);
      const newTotalPages = Math.max(1, Math.ceil(newTotalRecords / currentState.pageSize));

      // If current page would be out of bounds after deletion
      if (currentState.page >= newTotalPages && newTotalPages > 0) {
        const targetPage = newTotalPages - 1;
        if (process.env.NODE_ENV !== 'production') {
          console.log(`Data deletion would put page ${currentState.page + 1} out of bounds. Moving to page ${targetPage + 1}.`);
        }
        goToPage(targetPage);
      }
    },
    [currentState.totalRecords, currentState.pageSize, currentState.page, goToPage],
  );

  const adjustPageAfterDeletion = useCallback(() => {
    // This is called when the parent component detects the data has changed
    // and the current page might be out of bounds
    if (currentState.isPageOutOfBounds && currentState.totalPages > 0) {
      goToLastPage();
    }
  }, [currentState.isPageOutOfBounds, currentState.totalPages, goToLastPage]);

  // Keyboard navigation
  const handleKeyboardNavigation = useCallback(
    (event: KeyboardEvent): boolean => {
      if (event.target && (event.target as HTMLElement).tagName === "INPUT") {
        return false; // Don't handle when user is typing in input
      }

      switch (event.key) {
        case "ArrowLeft":
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            goToPreviousPage();
            return true;
          }
          break;
        case "ArrowRight":
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            goToNextPage();
            return true;
          }
          break;
        case "Home":
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            goToFirstPage();
            return true;
          }
          break;
        case "End":
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            goToLastPage();
            return true;
          }
          break;
      }
      return false;
    },
    [goToPreviousPage, goToNextPage, goToFirstPage, goToLastPage],
  );

  // Clear loading state when data updates
  useEffect(() => {
    if (!isLoading && isPageChanging) {
      const timeout = setTimeout(() => {
        setIsPageChanging(false);
      }, 100); // Small delay to avoid flicker

      return () => clearTimeout(timeout);
    }
  }, [isLoading, isPageChanging]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (pageChangeTimeoutRef.current) {
        clearTimeout(pageChangeTimeoutRef.current);
      }
    };
  }, []);

  const actions: PaginationActions = {
    goToPage,
    goToFirstPage,
    goToLastPage,
    goToNextPage,
    goToPreviousPage,
    setPageSize,
    handleDataDeletion,
    adjustPageAfterDeletion,
    handleKeyboardNavigation,
  };

  return {
    ...currentState,
    ...actions,

    // Additional utilities
    pageNumbers: useMemo(() => {
      return generatePageNumbers(currentState.page + 1, currentState.totalPages);
    }, [currentState.page, currentState.totalPages]),

    pageSizeOptions: pageSizeOptions.filter((size) => size <= maxPageSize),

    // Helper functions
    canGoToPage: (page: number) => page >= 0 && page < currentState.totalPages,
    getPageDisplayNumber: (page: number) => page + 1, // Convert 0-based to 1-based
    getCurrentPageDisplayNumber: () => currentState.page + 1,
  };
}

/**
 * Generate page numbers for pagination display with ellipsis
 */
function generatePageNumbers(currentPage: number, totalPages: number): (number | string)[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | string)[] = [];

  // Always show first page
  pages.push(1);

  if (currentPage <= 4) {
    // Show pages 1-5 ... last
    pages.push(2, 3, 4, 5);
    if (totalPages > 6) pages.push("...");
    pages.push(totalPages);
  } else if (currentPage >= totalPages - 3) {
    // Show first ... last-4 to last
    pages.push("...");
    for (let i = totalPages - 4; i <= totalPages; i++) {
      if (i > 1) pages.push(i);
    }
  } else {
    // Show first ... current-1, current, current+1 ... last
    pages.push("...");
    pages.push(currentPage - 1, currentPage, currentPage + 1);
    pages.push("...");
    pages.push(totalPages);
  }

  return pages;
}
