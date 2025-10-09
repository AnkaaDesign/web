import * as React from "react";
import { IconChevronLeft, IconChevronRight, IconChevronsLeft, IconChevronsRight, IconLoader2, IconAlertTriangle } from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { usePaginationState } from "@/hooks/use-pagination-state";
import type { PaginationMeta } from "@/hooks/use-pagination-state";

export interface ProductionPaginationProps {
  // Data
  meta: PaginationMeta;

  // Configuration
  pageSizeOptions?: number[];
  showPageSizeSelector?: boolean;
  showGoToPage?: boolean;
  showPageInfo?: boolean;
  showFirstLastButtons?: boolean;
  enableKeyboardNavigation?: boolean;

  // Loading states
  isLoading?: boolean;

  // Styling
  className?: string;
  size?: "sm" | "default" | "lg";

  // Callbacks
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  onPageOutOfBounds?: (requestedPage: number, maxPage: number) => void;

  // Edge case handling
  autoCorrectOutOfBounds?: boolean;

  // URL integration
  namespace?: string;
}

export function ProductionPagination({
  meta,
  pageSizeOptions = [10, 20, 40, 50, 100],
  showPageSizeSelector = true,
  showGoToPage = true,
  showPageInfo = true,
  showFirstLastButtons = true,
  enableKeyboardNavigation = true,
  isLoading = false,
  className,
  size = "default",
  onPageChange,
  onPageSizeChange,
  onPageOutOfBounds,
  autoCorrectOutOfBounds = true,
  namespace,
}: ProductionPaginationProps) {
  const [pageInput, setPageInput] = React.useState("");
  const [isPageInputFocused, setIsPageInputFocused] = React.useState(false);

  // Use the pagination state hook
  const pagination = usePaginationState(meta, {
    pageSizeOptions,
    namespace,
    autoCorrectPageOutOfBounds: autoCorrectOutOfBounds,
    isLoading,
    onPageChange,
    onPageSizeChange,
    onPageOutOfBounds,
  });

  // Keyboard navigation effect
  React.useEffect(() => {
    if (!enableKeyboardNavigation) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isPageInputFocused) return; // Don't interfere with page input

      const handled = pagination.handleKeyboardNavigation(event);
      if (handled) {
        event.preventDefault();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enableKeyboardNavigation, isPageInputFocused, pagination.handleKeyboardNavigation]);

  // Handle page input submission
  const handleGoToPage = (e: React.FormEvent) => {
    e.preventDefault();
    const page = parseInt(pageInput);
    if (!isNaN(page) && pagination.canGoToPage(page - 1)) {
      pagination.goToPage(page - 1); // Convert to 0-based
      setPageInput("");
    }
  };

  // Clear page input when page changes externally
  React.useEffect(() => {
    if (!isPageInputFocused) {
      setPageInput("");
    }
  }, [pagination.page, isPageInputFocused]);

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

  // Loading overlay for immediate feedback
  const LoadingOverlay = () => (
    <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-md">
      <IconLoader2 className="h-4 w-4 animate-spin" />
    </div>
  );

  // Out of bounds warning
  const OutOfBoundsWarning = () => (
    <div className="flex items-center gap-2 text-warning">
      <IconAlertTriangle className="h-4 w-4" />
      <span className={styles.text}>Página fora do intervalo. Ajustando automaticamente...</span>
    </div>
  );

  // Empty state
  if (pagination.isEmpty) {
    return (
      <div className={cn("flex items-center justify-center py-4", className)}>
        <span className={cn("text-muted-foreground", styles.text)}>Nenhum resultado encontrado</span>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {/* Loading overlay */}
      {pagination.isPageChanging && <LoadingOverlay />}

      {/* Out of bounds warning */}
      {pagination.isPageOutOfBounds && (
        <div className="mb-2">
          <OutOfBoundsWarning />
        </div>
      )}

      <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between", pagination.isPageChanging && "opacity-50 pointer-events-none")}>
        {/* Left section: Info and controls */}
        <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6 lg:gap-8")}>
          {/* Page info */}
          {showPageInfo && (
            <div className={cn("flex items-center space-x-2 text-muted-foreground", styles.text)}>
              <span>
                Mostrando {pagination.startItem} até {pagination.endItem} de {pagination.totalRecords} resultado(s)
              </span>
            </div>
          )}

          {/* Page size selector */}
          {showPageSizeSelector && (
            <div className={cn("flex items-center", styles.gap)}>
              <span className={cn("text-muted-foreground whitespace-nowrap", styles.text)}>Itens por página:</span>
              <Combobox
                value={pagination.pageSize.toString()}
                onValueChange={(value) => pagination.setPageSize(Number(value))}
                options={pagination.pageSizeOptions.map((option) => ({
                  label: option.toString(),
                  value: option.toString(),
                }))}
                placeholder={pagination.pageSize.toString()}
                triggerClassName={styles.combobox}
                searchable={false}
                clearable={false}
                disabled={pagination.isLoading}
              />
            </div>
          )}

          {/* Go to page input */}
          {showGoToPage && pagination.totalPages > 5 && (
            <form onSubmit={handleGoToPage} className={cn("flex items-center", styles.gap)}>
              <span className={cn("text-muted-foreground whitespace-nowrap", styles.text)}>Ir para:</span>
              <Input
                type="number"
                min="1"
                max={pagination.totalPages}
                value={pageInput}
                onChange={(value) => setPageInput(String(value || ""))}
                onFocus={() => setIsPageInputFocused(true)}
                onBlur={() => setIsPageInputFocused(false)}
                className={cn(styles.input, "px-3 py-2 bg-transparent")}
                placeholder="..."
                disabled={pagination.isLoading}
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
              onClick={pagination.goToFirstPage}
              disabled={!pagination.hasPreviousPage || pagination.isLoading}
              className={cn("hidden lg:flex", styles.button, "p-0")}
              title="Primeira página (Ctrl/Cmd + Home)"
            >
              <span className="sr-only">Ir para primeira página</span>
              <IconChevronsLeft className="h-4 w-4" />
            </Button>
          )}

          {/* Previous page button */}
          <Button
            variant="outline"
            size="sm"
            onClick={pagination.goToPreviousPage}
            disabled={!pagination.hasPreviousPage || pagination.isLoading}
            className={cn(styles.button, "p-0")}
            title="Página anterior (Ctrl/Cmd + ←)"
          >
            <span className="sr-only">Página anterior</span>
            <IconChevronLeft className="h-4 w-4" />
          </Button>

          {/* Page numbers */}
          <div className={cn("flex items-center", styles.gap)}>
            {pagination.pageNumbers.map((pageNumber, idx) =>
              pageNumber === "..." ? (
                <span key={`dots-${idx}`} className={cn("px-2 text-muted-foreground", styles.text)}>
                  ...
                </span>
              ) : (
                <Button
                  key={`page-${pageNumber}`}
                  variant={pageNumber === pagination.getCurrentPageDisplayNumber() ? "default" : "outline"}
                  size="sm"
                  className={cn(styles.button, "p-0")}
                  onClick={() => pagination.goToPage(Number(pageNumber) - 1)}
                  disabled={pagination.isLoading}
                  title={`Página ${pageNumber}`}
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
            onClick={pagination.goToNextPage}
            disabled={!pagination.hasNextPage || pagination.isLoading}
            className={cn(styles.button, "p-0")}
            title="Próxima página (Ctrl/Cmd + →)"
          >
            <span className="sr-only">Próxima página</span>
            <IconChevronRight className="h-4 w-4" />
          </Button>

          {/* Last page button */}
          {showFirstLastButtons && (
            <Button
              variant="outline"
              size="sm"
              onClick={pagination.goToLastPage}
              disabled={!pagination.hasNextPage || pagination.isLoading}
              className={cn("hidden lg:flex", styles.button, "p-0")}
              title="Última página (Ctrl/Cmd + End)"
            >
              <span className="sr-only">Ir para última página</span>
              <IconChevronsRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Keyboard shortcuts help (only show in development) */}
      {process.env.NODE_ENV === "development" && enableKeyboardNavigation && (
        <div className="mt-2 text-xs text-muted-foreground opacity-50">Atalhos: Ctrl/Cmd + ← (anterior) | → (próxima) | Home (primeira) | End (última)</div>
      )}
    </div>
  );
}

// Simplified version for basic use cases
export interface SimplePaginationProps {
  currentPage: number; // 0-based
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
  className?: string;
  size?: "sm" | "default" | "lg";
}

export function SimplePagination({ currentPage, totalPages, onPageChange, isLoading = false, className, size = "default" }: SimplePaginationProps) {
  const meta: PaginationMeta = {
    page: currentPage,
    totalPages,
    totalRecords: totalPages * 40, // Estimate
    hasNextPage: currentPage < totalPages - 1,
    hasPreviousPage: currentPage > 0,
    pageSize: 40,
    startItem: currentPage * 40 + 1,
    endItem: Math.min((currentPage + 1) * 40, totalPages * 40),
  };

  return (
    <ProductionPagination
      meta={meta}
      isLoading={isLoading}
      className={className}
      size={size}
      showPageInfo={false}
      showPageSizeSelector={false}
      showGoToPage={false}
      onPageChange={onPageChange}
    />
  );
}
