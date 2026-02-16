import * as React from "react";
import { IconChevronLeft, IconChevronRight, IconChevronsLeft, IconChevronsRight, IconLoader2, IconAlertTriangle } from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";

export interface TablePaginationMeta {
  page: number; // 0-based internally
  totalPages: number;
  totalRecords: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  pageSize: number;
  startItem: number;
  endItem: number;
}

export interface TablePaginationProps {
  // Core data
  meta: TablePaginationMeta;

  // Configuration
  pageSizeOptions?: number[];
  showPageInfo?: boolean;
  showPageSizeSelector?: boolean;
  showGoToPage?: boolean;
  showFirstLastButtons?: boolean;
  enableKeyboardNavigation?: boolean;

  // Loading and error states
  isLoading?: boolean;
  error?: Error | string | null;

  // Styling
  className?: string;
  size?: "sm" | "default" | "lg";

  // Callbacks
  onPageChange?: (page: number) => void; // 0-based
  onPageSizeChange?: (pageSize: number) => void;
  onError?: (error: string) => void;

  // Edge case handling
  autoCorrectOutOfBounds?: boolean;
  showOutOfBoundsWarning?: boolean;
}

export function TablePagination({
  meta,
  pageSizeOptions = [10, 20, 40, 50, 100],
  showPageInfo = true,
  showPageSizeSelector = true,
  showGoToPage = true,
  showFirstLastButtons = true,
  enableKeyboardNavigation = true,
  isLoading = false,
  error,
  className,
  size = "default",
  onPageChange,
  onPageSizeChange,
  onError,
  autoCorrectOutOfBounds = true,
  showOutOfBoundsWarning = true,
}: TablePaginationProps) {
  const [pageInput, setPageInput] = React.useState("");
  const [isPageInputFocused, setIsPageInputFocused] = React.useState(false);
  const [isPageChanging, setIsPageChanging] = React.useState(false);

  // Derived calculations
  const isPageOutOfBounds = meta.page >= meta.totalPages && meta.totalRecords > 0;
  const isEmpty = meta.totalRecords === 0;
  const currentPageDisplay = meta.page + 1; // Convert to 1-based for display

  // Page numbers for display
  const pageNumbers = React.useMemo(() => {
    return generatePageNumbers(currentPageDisplay, meta.totalPages);
  }, [currentPageDisplay, meta.totalPages]);

  // Size-based styling
  const sizeStyles = {
    sm: {
      button: "h-8 w-8 text-xs",
      input: "h-8 w-14 text-xs",
      combobox: "h-8 w-[80px]",
      gap: "gap-1",
      text: "text-xs",
    },
    default: {
      button: "h-9 w-9 text-sm",
      input: "h-9 w-16 text-sm",
      combobox: "h-9 w-[100px]",
      gap: "gap-1",
      text: "text-sm",
    },
    lg: {
      button: "h-10 w-10 text-base",
      input: "h-10 w-20 text-base",
      combobox: "h-10 w-[120px]",
      gap: "gap-2",
      text: "text-base",
    },
  };

  const styles = sizeStyles[size];

  // Keyboard navigation effect
  React.useEffect(() => {
    if (!enableKeyboardNavigation) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't interfere with input fields
      if (isPageInputFocused || (event.target && ["INPUT", "TEXTAREA", "SELECT"].includes((event.target as HTMLElement).tagName))) {
        return;
      }

      let handled = false;

      switch (event.key) {
        case "ArrowLeft":
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            handlePreviousPage();
            handled = true;
          }
          break;
        case "ArrowRight":
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            handleNextPage();
            handled = true;
          }
          break;
        case "Home":
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            handleFirstPage();
            handled = true;
          }
          break;
        case "End":
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            handleLastPage();
            handled = true;
          }
          break;
      }

      if (handled) {
        event.stopPropagation();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enableKeyboardNavigation, isPageInputFocused, meta]);

  // Navigation handlers with loading state management
  const setPageChangingState = React.useCallback((changing: boolean) => {
    setIsPageChanging(changing);
    if (changing) {
      // Auto-clear loading state after 2 seconds as fallback
      setTimeout(() => setIsPageChanging(false), 2000);
    }
  }, []);

  const handlePageChange = React.useCallback(
    (newPage: number) => {
      if (newPage === meta.page || newPage < 0 || newPage >= meta.totalPages) return;

      setPageChangingState(true);
      onPageChange?.(newPage);
    },
    [meta.page, meta.totalPages, onPageChange, setPageChangingState],
  );

  const handleFirstPage = React.useCallback(() => {
    handlePageChange(0);
  }, [handlePageChange]);

  const handleLastPage = React.useCallback(() => {
    handlePageChange(Math.max(0, meta.totalPages - 1));
  }, [handlePageChange, meta.totalPages]);

  const handleNextPage = React.useCallback(() => {
    if (meta.hasNextPage) {
      handlePageChange(meta.page + 1);
    }
  }, [handlePageChange, meta.hasNextPage, meta.page]);

  const handlePreviousPage = React.useCallback(() => {
    if (meta.hasPreviousPage) {
      handlePageChange(meta.page - 1);
    }
  }, [handlePageChange, meta.hasPreviousPage, meta.page]);

  const handlePageSizeChange = React.useCallback(
    (newPageSize: number) => {
      if (newPageSize === meta.pageSize) return;

      setPageChangingState(true);
      onPageSizeChange?.(newPageSize);
    },
    [meta.pageSize, onPageSizeChange, setPageChangingState],
  );

  // Handle page input submission
  const handleGoToPage = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const pageNumber = parseInt(pageInput);

      if (isNaN(pageNumber)) {
        onError?.("Número de página inválido");
        return;
      }

      if (pageNumber < 1 || pageNumber > meta.totalPages) {
        onError?.(`Página deve estar entre 1 e ${meta.totalPages}`);
        return;
      }

      handlePageChange(pageNumber - 1); // Convert to 0-based
      setPageInput("");
    },
    [pageInput, meta.totalPages, handlePageChange, onError],
  );

  // Clear page input when page changes externally
  React.useEffect(() => {
    if (!isPageInputFocused) {
      setPageInput("");
    }
  }, [meta.page, isPageInputFocused]);

  // Auto-correct out of bounds page
  React.useEffect(() => {
    if (autoCorrectOutOfBounds && isPageOutOfBounds && !isLoading && meta.totalRecords > 0) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`Page ${currentPageDisplay} is out of bounds. Auto-correcting to last page.`);
      }
      handleLastPage();
    }
  }, [isPageOutOfBounds, autoCorrectOutOfBounds, isLoading, meta.totalRecords, currentPageDisplay, handleLastPage]);

  // Clear loading state when not loading
  React.useEffect(() => {
    if (!isLoading && isPageChanging) {
      const timeout = setTimeout(() => {
        setIsPageChanging(false);
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [isLoading, isPageChanging]);

  // Loading overlay component
  const LoadingOverlay = () => (
    <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-md z-10">
      <IconLoader2 className="h-4 w-4 animate-spin text-primary" />
    </div>
  );

  // Out of bounds warning component
  const OutOfBoundsWarning = () => (
    <div className="flex items-center gap-2 text-warning mb-2">
      <IconAlertTriangle className="h-4 w-4" />
      <span className={styles.text}>Página fora do intervalo. Ajustando automaticamente...</span>
    </div>
  );

  // Error display component
  const ErrorDisplay = () => {
    if (!error) return null;
    const errorMessage = typeof error === "string" ? error : error.message;

    return (
      <div className="flex items-center gap-2 text-destructive mb-2">
        <IconAlertTriangle className="h-4 w-4" />
        <span className={styles.text}>Erro: {errorMessage}</span>
      </div>
    );
  };

  // Empty state
  if (isEmpty && !isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-4", className)}>
        <div className="text-center">
          <span className={cn("text-muted-foreground", styles.text)}>Nenhum resultado encontrado</span>
          <ErrorDisplay />
        </div>
      </div>
    );
  }

  // Loading state for initial load
  if (isLoading && meta.totalRecords === 0) {
    return (
      <div className={cn("flex items-center justify-center py-4", className)}>
        <div className="flex items-center gap-2">
          <IconLoader2 className="h-4 w-4 animate-spin text-primary" />
          <span className={cn("text-muted-foreground", styles.text)}>Carregando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {/* Loading overlay */}
      {isPageChanging && <LoadingOverlay />}

      {/* Error display */}
      <ErrorDisplay />

      {/* Out of bounds warning */}
      {showOutOfBoundsWarning && isPageOutOfBounds && <OutOfBoundsWarning />}

      <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between", (isPageChanging || isLoading) && "opacity-50 pointer-events-none")}>
        {/* Left section: Info and controls */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6 lg:gap-8">
          {/* Page info */}
          {showPageInfo && (
            <div className={cn("flex items-center space-x-2 text-muted-foreground", styles.text)}>
              <span>
                Mostrando {meta.startItem} até {meta.endItem} de {meta.totalRecords} resultado(s)
              </span>
            </div>
          )}

          {/* Page size selector */}
          {showPageSizeSelector && (
            <div className={cn("flex items-center", styles.gap)}>
              <span className={cn("text-muted-foreground whitespace-nowrap", styles.text)}>Itens por página:</span>
              <Combobox
                value={meta.pageSize.toString()}
                onValueChange={(value) => handlePageSizeChange(Number(value))}
                options={pageSizeOptions.map((option) => ({
                  label: option.toString(),
                  value: option.toString(),
                }))}
                placeholder={meta.pageSize.toString()}
                triggerClassName={styles.combobox}
                searchable={false}
                clearable={false}
                disabled={isLoading || isPageChanging}
                aria-label="Selecionar número de itens por página"
              />
            </div>
          )}

          {/* Go to page input */}
          {showGoToPage && meta.totalPages > 5 && (
            <form onSubmit={handleGoToPage} className={cn("flex items-center", styles.gap)}>
              <span className={cn("text-muted-foreground whitespace-nowrap", styles.text)}>Ir para:</span>
              <input
                type="number"
                min={1}
                max={meta.totalPages}
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onFocus={() => setIsPageInputFocused(true)}
                onBlur={() => setIsPageInputFocused(false)}
                className={cn("flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm", styles.input, "px-3 py-2 bg-transparent")}
                placeholder="..."
                disabled={isLoading || isPageChanging}
                aria-label={`Ir para página (1-${meta.totalPages})`}
              />
            </form>
          )}
        </div>

        {/* Right section: Navigation buttons */}
        <div className={cn("flex items-center", styles.gap)}>
          {/* First page button */}
          {showFirstLastButtons && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleFirstPage}
              disabled={!meta.hasPreviousPage || isLoading || isPageChanging}
              className={cn("hidden lg:flex", styles.button, "p-0")}
              title="Primeira página (Ctrl/Cmd + Home)"
              aria-label="Ir para primeira página"
            >
              <IconChevronsLeft className="h-4 w-4" />
            </Button>
          )}

          {/* Previous page button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreviousPage}
            disabled={!meta.hasPreviousPage || isLoading || isPageChanging}
            className={cn(styles.button, "p-0")}
            title="Página anterior (Ctrl/Cmd + ←)"
            aria-label="Página anterior"
          >
            <IconChevronLeft className="h-4 w-4" />
          </Button>

          {/* Page numbers */}
          <div className={cn("flex items-center", styles.gap)} role="list" aria-label="Páginas">
            {pageNumbers.map((pageNumber, idx) =>
              pageNumber === "..." ? (
                <span key={`dots-${idx}`} className={cn("px-2 text-muted-foreground", styles.text)} aria-hidden="true">
                  ...
                </span>
              ) : (
                <Button
                  key={`page-${pageNumber}`}
                  variant={pageNumber === currentPageDisplay ? "default" : "outline"}
                  size="sm"
                  className={cn(styles.button, "p-0")}
                  onClick={() => handlePageChange(Number(pageNumber) - 1)}
                  disabled={isLoading || isPageChanging}
                  title={`Página ${pageNumber}`}
                  aria-label={`Ir para página ${pageNumber}`}
                  aria-current={pageNumber === currentPageDisplay ? "page" : undefined}
                  role="listitem"
                >
                  {pageNumber}
                </Button>
              ),
            )}
          </div>

          {/* Next page button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={!meta.hasNextPage || isLoading || isPageChanging}
            className={cn(styles.button, "p-0")}
            title="Próxima página (Ctrl/Cmd + →)"
            aria-label="Próxima página"
          >
            <IconChevronRight className="h-4 w-4" />
          </Button>

          {/* Last page button */}
          {showFirstLastButtons && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleLastPage}
              disabled={!meta.hasNextPage || isLoading || isPageChanging}
              className={cn("hidden lg:flex", styles.button, "p-0")}
              title="Última página (Ctrl/Cmd + End)"
              aria-label="Ir para última página"
            >
              <IconChevronsRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Keyboard shortcuts help (development only) */}
      {process.env.NODE_ENV === "development" && enableKeyboardNavigation && (
        <div className="mt-2 text-xs text-muted-foreground opacity-50">Atalhos: Ctrl/Cmd + ← (anterior) | → (próxima) | Home (primeira) | End (última)</div>
      )}
    </div>
  );
}

/**
 * Generate page numbers for pagination display with ellipsis
 * Shows a smart truncation strategy for large page counts
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

// Simplified version for basic pagination needs
export interface SimpleTablePaginationProps {
  currentPage: number; // 0-based
  totalPages: number;
  totalRecords: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
  className?: string;
  size?: "sm" | "default" | "lg";
}

export function SimpleTablePagination({
  currentPage,
  totalPages,
  totalRecords,
  pageSize,
  onPageChange,
  isLoading = false,
  className,
  size = "default",
}: SimpleTablePaginationProps) {
  const meta: TablePaginationMeta = {
    page: currentPage,
    totalPages,
    totalRecords,
    hasNextPage: currentPage < totalPages - 1,
    hasPreviousPage: currentPage > 0,
    pageSize,
    startItem: totalRecords === 0 ? 0 : currentPage * pageSize + 1,
    endItem: Math.min((currentPage + 1) * pageSize, totalRecords),
  };

  return (
    <TablePagination
      meta={meta}
      isLoading={isLoading}
      className={className}
      size={size}
      showPageInfo={false}
      showPageSizeSelector={false}
      showGoToPage={false}
      showFirstLastButtons={false}
      onPageChange={onPageChange}
    />
  );
}

// Hook for easy integration with query results
export function useTablePagination<TData = any>(
  queryResult: {
    data?: { data?: TData[]; meta?: { totalRecords?: number; page?: number; hasNextPage?: boolean } };
    isLoading?: boolean;
    isFetching?: boolean;
    error?: any;
  },
  options: {
    defaultPageSize?: number;
    onPageChange?: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
    onError?: (error: string) => void;
  } = {},
) {
  const { defaultPageSize = 40, onPageChange, onPageSizeChange, onError } = options;

  const data = queryResult.data?.data || [];
  const totalRecords = queryResult.data?.meta?.totalRecords || 0;
  const currentPage = queryResult.data?.meta?.page || 0;
  const isLoading = queryResult.isLoading || false;
  const isFetching = queryResult.isFetching || false;
  const error = queryResult.error;

  const totalPages = Math.max(1, Math.ceil(totalRecords / defaultPageSize));

  const meta: TablePaginationMeta = {
    page: currentPage,
    totalPages,
    totalRecords,
    hasNextPage: currentPage < totalPages - 1,
    hasPreviousPage: currentPage > 0,
    pageSize: defaultPageSize,
    startItem: totalRecords === 0 ? 0 : currentPage * defaultPageSize + 1,
    endItem: Math.min((currentPage + 1) * defaultPageSize, totalRecords),
  };

  return {
    meta,
    data,
    isLoading,
    isFetching,
    error,
    isEmpty: data.length === 0 && !isLoading,

    // Render method for convenience
    renderPagination: (props?: Partial<TablePaginationProps>) => (
      <TablePagination meta={meta} isLoading={isLoading || isFetching} error={error} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} onError={onError} {...props} />
    ),
  };
}
