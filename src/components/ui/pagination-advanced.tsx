import * as React from "react";
import { IconChevronLeft, IconChevronRight, IconChevronsLeft, IconChevronsRight } from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";

// Export a simple pagination component for basic use cases
interface SimplePaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  totalItems?: number;
  pageSizeOptions?: number[];
  onPageSizeChange?: (pageSize: number) => void;
  showPageSizeSelector?: boolean;
  showGoToPage?: boolean;
  showPageInfo?: boolean;
  className?: string;
}

export function SimplePaginationAdvanced({
  currentPage,
  totalPages,
  onPageChange,
  pageSize = 10,
  totalItems = 0,
  pageSizeOptions = [10, 20, 30, 40, 50],
  onPageSizeChange,
  showPageSizeSelector = true,
  showGoToPage = true,
  showPageInfo = true,
  className,
}: SimplePaginationProps) {
  const [pageInput, setPageInput] = React.useState("");

  // Memoize page size options to prevent infinite re-renders
  const pageSizeComboboxOptions = React.useMemo(
    () =>
      pageSizeOptions.map((option) => ({
        label: option.toString(),
        value: option.toString(),
      })),
    [pageSizeOptions],
  );

  // Convert 0-based to 1-based for display
  const displayPage = currentPage + 1;
  const canPreviousPage = currentPage > 0;
  const canNextPage = currentPage < totalPages - 1;

  const handleGoToPage = () => {
    const page = parseInt(pageInput);
    if (!isNaN(page) && page > 0 && page <= totalPages) {
      onPageChange(page - 1); // Convert to 0-based
      setPageInput("");
    }
  };

  // Calculate page range for display
  const getPageNumbers = () => {
    const delta = 2;
    const range: number[] = [];
    const rangeWithDots: (number | string)[] = [];
    let l: number | undefined;

    range.push(1);

    if (totalPages <= 1) return range;

    for (let i = displayPage - delta; i <= displayPage + delta; i++) {
      if (i < totalPages && i > 1) {
        range.push(i);
      }
    }
    range.push(totalPages);

    range.forEach((i: number) => {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push("...");
        }
      }
      rangeWithDots.push(i);
      l = i;
    });

    return rangeWithDots;
  };

  const pageNumbers = getPageNumbers();

  // Calculate items range
  const startItem = totalItems === 0 ? 0 : currentPage * pageSize + 1;
  const endItem = Math.min((currentPage + 1) * pageSize, totalItems);

  // If the page is out of bounds (startItem > totalItems), show proper message
  const isPageOutOfBounds = startItem > totalItems && totalItems > 0;

  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between py-1", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6 lg:gap-8">
        {showPageInfo && (
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <span>
              {totalItems === 0
                ? "Nenhum resultado encontrado"
                : isPageOutOfBounds
                  ? `Página fora do intervalo (${totalItems} resultado(s) total)`
                  : `Mostrando ${startItem} até ${endItem} de ${totalItems} resultado(s)`}
            </span>
          </div>
        )}

        {showPageSizeSelector && onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Itens por página:</span>
            <Combobox
              value={pageSize.toString()}
              onValueChange={(value) => onPageSizeChange(Number(value))}
              options={pageSizeComboboxOptions}
              placeholder={pageSize.toString()}
              triggerClassName="h-9 w-[100px] py-2"
              searchable={false}
              clearable={false}
            />
          </div>
        )}

        {showGoToPage && totalPages > 5 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Ir para:</span>
            <Input
              type="number"
              min="1"
              max={totalPages}
              value={pageInput}
              onChange={(value) => setPageInput(String(value || ""))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleGoToPage();
                }
              }}
              className="h-9 w-16 px-3 py-2 text-sm bg-transparent"
              placeholder="..."
            />
          </div>
        )}
      </div>

      <div className="flex items-center space-x-1">
        <Button variant="outline" size="sm" onClick={() => onPageChange(0)} disabled={!canPreviousPage} className="hidden h-9 w-9 p-0 lg:flex">
          <span className="sr-only">Ir para primeira página</span>
          <IconChevronsLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage - 1)} disabled={!canPreviousPage} className="h-9 w-9 p-0">
          <span className="sr-only">Página anterior</span>
          <IconChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-1">
          {pageNumbers.map((pageNumber, idx) =>
            pageNumber === "..." ? (
              <span key={`dots-${idx}`} className="px-2 text-sm text-muted-foreground">
                ...
              </span>
            ) : (
              <Button
                key={`page-${pageNumber}`}
                variant={pageNumber === displayPage ? "default" : "outline"}
                size="sm"
                className="h-9 w-9 p-0 text-sm"
                onClick={() => onPageChange(Number(pageNumber) - 1)}
              >
                {pageNumber}
              </Button>
            ),
          )}
        </div>

        <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage + 1)} disabled={!canNextPage} className="h-9 w-9 p-0">
          <span className="sr-only">Próxima página</span>
          <IconChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => onPageChange(totalPages - 1)} disabled={!canNextPage} className="hidden h-9 w-9 p-0 lg:flex">
          <span className="sr-only">Ir para última página</span>
          <IconChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
