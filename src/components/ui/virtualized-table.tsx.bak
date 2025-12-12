import React, { useRef, useCallback, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useScrollbarWidth } from "@/hooks/use-scrollbar-width";

interface VirtualizedTableColumn<T> {
  key: string;
  header: React.ReactNode;
  accessor: (item: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  sortable?: boolean;
  align?: "left" | "center" | "right";
}

interface VirtualizedTableProps<T> {
  data: T[];
  columns: VirtualizedTableColumn<T>[];
  getRowId: (item: T) => string;
  rowHeight?: number;
  overscan?: number;
  className?: string;
  tableClassName?: string;
  onRowClick?: (item: T) => void;
  onRowContextMenu?: (e: React.MouseEvent, item: T) => void;
  renderRow?: (item: T, index: number, virtualRow: any) => React.ReactNode;
  headerContent?: React.ReactNode;
  isLoading?: boolean;
  loadingComponent?: React.ReactNode;
  emptyComponent?: React.ReactNode;
  estimateSize?: (index: number) => number;
  // Selection props
  selectedItems?: Set<string>;
  onSelectItem?: (itemId: string) => void;
  onSelectAll?: () => void;
  isAllSelected?: boolean;
  isPartiallySelected?: boolean;
  showSelection?: boolean;
  // Sort props
  onSort?: (columnKey: string) => void;
  getSortDirection?: (columnKey: string) => "asc" | "desc" | null;
  renderSortIndicator?: (columnKey: string) => React.ReactNode;
}

export function VirtualizedTable<T>({
  data,
  columns,
  getRowId,
  rowHeight = 48,
  overscan = 5,
  className,
  tableClassName,
  onRowClick,
  onRowContextMenu,
  renderRow,
  headerContent,
  isLoading,
  loadingComponent,
  emptyComponent,
  estimateSize,
  selectedItems,
  onSelectItem,
  onSelectAll,
  isAllSelected,
  isPartiallySelected,
  showSelection = false,
  onSort,

  renderSortIndicator,
}: VirtualizedTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const { width: scrollbarWidth, isOverlay } = useScrollbarWidth();

  // Calculate row size
  const getItemSize = useCallback(
    (index: number) => {
      if (estimateSize) {
        return estimateSize(index);
      }
      return rowHeight;
    },
    [rowHeight, estimateSize],
  );

  // Create virtualizer
  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: getItemSize,
    overscan,
    measureElement: estimateSize ? (element) => element?.getBoundingClientRect().height ?? rowHeight : undefined,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  // Memoize column widths to prevent layout shifts
  const columnStyles = useMemo(() => {
    return columns.map((col) => ({
      width: col.className?.match(/w-\[([\d]+px)\]/)?.[1] || "auto",
    }));
  }, [columns]);

  if (isLoading && loadingComponent) {
    return <>{loadingComponent}</>;
  }

  if (!isLoading && data.length === 0 && emptyComponent) {
    return <>{emptyComponent}</>;
  }

  return (
    <div className={cn("flex flex-col overflow-hidden", className)}>
      {/* Fixed Header */}
      <div className="flex-shrink-0 overflow-hidden">
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", tableClassName)}>
          <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
            <TableRow className="bg-muted hover:bg-muted even:bg-muted">
              {headerContent}
              {!headerContent && (
                <>
                  {/* Selection column */}
                  {showSelection && (
                    <TableHead className="w-[50px] whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0">
                      <div className="flex items-center justify-center h-full w-full px-2">
                        <Checkbox checked={isAllSelected} indeterminate={isPartiallySelected} onCheckedChange={onSelectAll} disabled={isLoading || data.length === 0} />
                      </div>
                    </TableHead>
                  )}

                  {/* Data columns */}
                  {columns.map((column, colIndex) => (
                    <TableHead
                      key={column.key}
                      className={cn("whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0", column.headerClassName || column.className)}
                      style={{ width: columnStyles[colIndex].width }}
                    >
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
                          {column.header}
                          {renderSortIndicator && renderSortIndicator(column.key)}
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
                          {column.header}
                        </div>
                      )}
                    </TableHead>
                  ))}

                  {/* Scrollbar spacer */}
                  {!isOverlay && <TableHead style={{ width: `${scrollbarWidth}px`, minWidth: `${scrollbarWidth}px` }} className="bg-muted p-0 border-0 !border-r-0 shrink-0" />}
                </>
              )}
            </TableRow>
          </TableHeader>
        </Table>
      </div>

      {/* Virtualized Body */}
      <div ref={parentRef} className="flex-1 overflow-y-auto overflow-x-hidden" style={{ contain: "strict" }}>
        <div style={{ height: totalSize, position: "relative" }}>
          <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", tableClassName)}>
            <TableBody>
              {virtualItems.map((virtualRow) => {
                const item = data[virtualRow.index];
                const itemId = getRowId(item);
                const isSelected = selectedItems?.has(itemId);

                if (renderRow) {
                  return renderRow(item, virtualRow.index, virtualRow);
                }

                return (
                  <TableRow
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={estimateSize ? virtualizer.measureElement : undefined}
                    className={cn(
                      "cursor-pointer transition-colors border-b border-border absolute top-0 left-0 w-full",
                      virtualRow.index % 2 === 1 && "bg-muted/10",
                      "hover:bg-muted/20",
                      isSelected && "bg-muted/30 hover:bg-muted/40",
                    )}
                    style={{
                      transform: `translateY(${virtualRow.start}px)`,
                      height: estimateSize ? "auto" : `${virtualRow.size}px`,
                    }}
                    onClick={() => onRowClick?.(item)}
                    onContextMenu={(e) => onRowContextMenu?.(e, item)}
                  >
                    {/* Selection checkbox */}
                    {showSelection && (
                      <TableCell className="w-[50px] p-0 !border-r-0">
                        <div className="flex items-center justify-center h-full w-full px-2 py-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={isSelected} onCheckedChange={() => onSelectItem?.(itemId)} />
                        </div>
                      </TableCell>
                    )}

                    {/* Data columns */}
                    {columns.map((column, colIndex) => (
                      <TableCell
                        key={column.key}
                        className={cn(
                          column.className,
                          "p-0 !border-r-0",
                          column.align === "center" && "text-center",
                          column.align === "right" && "text-right",
                          column.align === "left" && "text-left",
                          !column.align && "text-left",
                        )}
                        style={{ width: columnStyles[colIndex].width }}
                      >
                        <div className="px-4 py-2">{column.accessor(item)}</div>
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
