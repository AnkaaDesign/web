import * as React from "react";
import { cn } from "@/lib/utils";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "./table";
import { TABLE_LAYOUT } from "./table-constants";
import { useScrollbarWidth } from "@/hooks/use-scrollbar-width";
import { Checkbox } from "./checkbox";
import { SimplePaginationAdvanced } from "./pagination-advanced";
import { TruncatedTextWithTooltip } from "./truncated-text-with-tooltip";
import { IconSelector, IconChevronUp, IconChevronDown } from "@tabler/icons-react";

export interface StandardizedColumn<T> {
  key: string;
  header: string | React.ReactNode;
  accessor?: (item: T) => React.ReactNode;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
  width?: string | number;
}

interface StandardizedTableProps<T> {
  columns: StandardizedColumn<T>[];
  data: T[];
  getItemKey: (item: T) => string;
  onRowClick?: (item: T) => void;
  onContextMenu?: (e: React.MouseEvent, item: T) => void;
  isSelected?: (itemId: string) => boolean;
  onSelectionChange?: (itemId: string) => void;
  onSelectAll?: () => void;
  allSelected?: boolean;
  partiallySelected?: boolean;
  className?: string;
  isLoading?: boolean;
  error?: any;
  emptyMessage?: string;
  emptyIcon?: React.ElementType;
  // Sorting
  onSort?: (columnKey: string) => void;
  getSortDirection?: (columnKey: string) => "asc" | "desc" | null;
  getSortOrder?: (columnKey: string) => number | null;
  sortConfigs?: { field: string; direction: "asc" | "desc" }[];
  // Pagination
  currentPage?: number;
  totalPages?: number;
  pageSize?: number;
  totalRecords?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  showPageSizeSelector?: boolean;
  showGoToPage?: boolean;
  showPageInfo?: boolean;
  renderSkeleton?: () => React.ReactNode;
  itemTestIdPrefix?: string;
}

export function StandardizedTable<T>({
  columns,
  data,
  getItemKey,
  onRowClick,
  onContextMenu,
  isSelected,
  onSelectionChange,
  onSelectAll,
  allSelected = false,
  partiallySelected = false,
  className,
  isLoading = false,
  error,
  emptyMessage = "Nenhum item encontrado",
  emptyIcon: EmptyIcon,
  onSort,
  getSortDirection,
  getSortOrder,
  sortConfigs = [],
  currentPage = 1,
  totalPages = 1,
  pageSize = 40,
  totalRecords = 0,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [20, 40, 60, 100],
  showPageSizeSelector = true,
  showGoToPage = true,
  showPageInfo = true,
  renderSkeleton,
  itemTestIdPrefix,
}: StandardizedTableProps<T>) {
  const { width: scrollbarWidth, isOverlay } = useScrollbarWidth();

  const renderSortIndicator = (columnKey: string) => {
    if (!getSortDirection || !getSortOrder) return null;

    const sortDirection = getSortDirection(columnKey);
    const sortOrder = getSortOrder(columnKey);

    return (
      <div className="inline-flex items-center ml-1">
        {sortDirection === null && <IconSelector className="h-4 w-4 text-muted-foreground" />}
        {sortDirection === "asc" && <IconChevronUp className="h-4 w-4 text-foreground" />}
        {sortDirection === "desc" && <IconChevronDown className="h-4 w-4 text-foreground" />}
        {sortOrder !== null && sortConfigs.length > 1 && <span className="text-xs ml-0.5">{sortOrder + 1}</span>}
      </div>
    );
  };

  if (isLoading && renderSkeleton) {
    return renderSkeleton();
  }

  if (error) {
    return (
      <div className="border border-border rounded-lg p-8 text-center text-destructive bg-card">
        <div className="text-lg font-medium mb-2">Erro ao carregar dados</div>
        <div className="text-sm">Tente novamente mais tarde.</div>
      </div>
    );
  }

  return (
    <div className={cn("h-full flex flex-col", className)}>
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Fixed Header Table */}
        <div className="overflow-hidden">
          <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
            <TableHeader className="[&_tr]:border-b [&_tr]:hover:bg-muted">
              <TableRow className="bg-muted hover:bg-muted even:bg-muted">
                {/* Selection column */}
                {onSelectionChange && (
                  <TableHead className={cn(TABLE_LAYOUT.checkbox.className, "whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0")}>
                    <div className="flex items-center justify-center h-full w-full px-2">
                      <Checkbox
                        checked={allSelected}
                        indeterminate={partiallySelected}
                        onCheckedChange={onSelectAll}
                        aria-label="Select all items"
                        disabled={isLoading || data.length === 0}
                      />
                    </div>
                  </TableHead>
                )}

                {/* Data columns */}
                {columns.map((column) => (
                  <TableHead key={column.key} className={cn("whitespace-nowrap text-foreground font-medium text-sm p-0 bg-muted !border-r-0", column.className)}>
                    {column.sortable && onSort ? (
                      <button
                        onClick={() => onSort(column.key)}
                        className={cn(
                          "flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent",
                          column.align === "center" && "justify-center",
                          column.align === "right" && "justify-end",
                          !column.align && "justify-start",
                        )}
                      >
                        {typeof column.header === "string" ? <TruncatedTextWithTooltip text={column.header} /> : column.header}
                        {renderSortIndicator(column.key)}
                      </button>
                    ) : (
                      <div
                        className={cn(
                          "flex items-center h-full min-h-[2.5rem] px-4 py-2",
                          column.align === "center" && "justify-center text-center",
                          column.align === "right" && "justify-end text-right",
                          !column.align && "justify-start text-left",
                        )}
                      >
                        {typeof column.header === "string" ? <TruncatedTextWithTooltip text={column.header} /> : column.header}
                      </div>
                    )}
                  </TableHead>
                ))}

                {/* Scrollbar spacer - only show if not overlay scrollbar */}
                {!isOverlay && (
                  <TableHead style={{ width: `${scrollbarWidth}px`, minWidth: `${scrollbarWidth}px` }} className="bg-muted p-0 border-0 !border-r-0 shrink-0"></TableHead>
                )}
              </TableRow>
            </TableHeader>
          </Table>
        </div>

        {/* Scrollable Body Table */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
            <TableBody>
              {!data || data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length + (onSelectionChange ? 1 : 0)} className="p-0">
                    <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                      {EmptyIcon && <EmptyIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />}
                      <div className="text-lg font-medium mb-2">{emptyMessage}</div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                data.map((item, index) => {
                  const itemKey = getItemKey(item);
                  const itemIsSelected = isSelected?.(itemKey) ?? false;
                  const isLastRow = index === data.length - 1;

                  return (
                    <TableRow
                      key={itemKey}
                      data-testid={`${itemTestIdPrefix || "table"}-row`}
                      data-state={itemIsSelected ? "selected" : undefined}
                      className={cn(
                        "cursor-pointer transition-colors",
                        // Border - hide on last row
                        !isLastRow && "border-b border-border",
                        // Alternating row colors
                        index % 2 === 1 && "bg-muted/10",
                        // Hover state that works with alternating colors
                        "hover:bg-muted/20",
                        // Selected state overrides alternating colors
                        itemIsSelected && "bg-muted/30 hover:bg-muted/40",
                      )}
                      onClick={() => onRowClick?.(item)}
                      onContextMenu={(e) => onContextMenu?.(e, item)}
                    >
                      {/* Selection checkbox */}
                      {onSelectionChange && (
                        <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                          <div className="flex items-center justify-center h-full w-full px-2 py-2" onClick={(e) => e.stopPropagation()}>
                            <Checkbox checked={itemIsSelected} onCheckedChange={() => onSelectionChange(itemKey)} aria-label={`Select item`} />
                          </div>
                        </TableCell>
                      )}

                      {/* Data columns */}
                      {columns.map((column) => (
                        <TableCell
                          key={column.key}
                          className={cn(
                            column.className,
                            "p-0 !border-r-0 overflow-hidden",
                            column.align === "center" && "text-center",
                            column.align === "right" && "text-right",
                            column.align === "left" && "text-left",
                            !column.align && "text-left",
                          )}
                        >
                          <div className="px-4 py-2.5 overflow-hidden">{(column.render || column.accessor)?.(item)}</div>
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Footer */}
        {onPageChange && (
          <div className="px-4 border-l border-r border-b border-border rounded-b-lg bg-muted/50">
            <SimplePaginationAdvanced
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={onPageChange}
              pageSize={pageSize}
              totalItems={totalRecords}
              pageSizeOptions={pageSizeOptions}
              onPageSizeChange={onPageSizeChange}
              showPageSizeSelector={showPageSizeSelector}
              showGoToPage={showGoToPage}
              showPageInfo={showPageInfo}
            />
          </div>
        )}
      </div>
    </div>
  );
}
