import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { IconChevronDown } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { useTableState } from "@/hooks/common/use-table-state";

interface DataTableColumn<T> {
  key: keyof T | string;
  header: string;
  accessor?: (row: T) => React.ReactNode;
  sortable?: boolean;
  filterable?: boolean;
}

interface DataTableWithSelectionProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  searchKey?: keyof T | string;
  searchPlaceholder?: string;
  showColumnToggle?: boolean;
  className?: string;
  rowId: (row: T) => string;
  bulkActionsComponent?: React.ReactNode;
  /**
   * Default page size (default: 40)
   */
  defaultPageSize?: number;
  /**
   * Whether to reset selection when pagination changes (default: false)
   */
  resetSelectionOnPageChange?: boolean;
}

export function DataTableWithSelection<T extends Record<string, any>>({
  data,
  columns,
  searchKey,
  searchPlaceholder = "Search...",
  showColumnToggle = true,
  className,
  rowId,
  bulkActionsComponent,
  defaultPageSize = 40,
  resetSelectionOnPageChange = false,
}: DataTableWithSelectionProps<T>) {
  // Use URL state management for pagination and selection
  const {
    page: currentPage,
    pageSize,
    sortConfigs,
    setPage,
    setPageSize,
    toggleSelection,
    toggleSelectAll,
    toggleSort,
    getSortDirection,
    isSelected,
    isAllSelected,
    isPartiallySelected,
    selectionCount,
  } = useTableState({
    defaultPageSize,
    resetSelectionOnPageChange,
  });

  const [filtering, setFiltering] = React.useState("");
  const [columnVisibility, setColumnVisibility] = React.useState<Record<string, boolean>>(() =>
    columns.reduce(
      (acc, col) => ({
        ...acc,
        [col.key as string]: true,
      }),
      {},
    ),
  );

  // Filter data
  const filteredData = React.useMemo(() => {
    if (!filtering || !searchKey) return data;

    return data.filter((row) => {
      const value = String(row[searchKey] || "");
      return value.toLowerCase().includes(filtering.toLowerCase());
    });
  }, [data, filtering, searchKey]);

  // Sort data
  const sortedData = React.useMemo(() => {
    if (sortConfigs.length === 0) return filteredData;

    return [...filteredData].sort((a, b) => {
      for (const { column, direction } of sortConfigs) {
        const aValue = a[column];
        const bValue = b[column];

        if (aValue === null || aValue === undefined) return direction === "asc" ? 1 : -1;
        if (bValue === null || bValue === undefined) return direction === "asc" ? -1 : 1;

        const aString = String(aValue).toLowerCase();
        const bString = String(bValue).toLowerCase();

        const comparison = aString.localeCompare(bString);
        if (comparison !== 0) {
          return direction === "asc" ? comparison : -comparison;
        }
      }
      return 0;
    });
  }, [filteredData, sortConfigs]);

  // Paginate data
  const paginatedData = React.useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  const visibleColumns = columns.filter((col) => columnVisibility[col.key as string]);

  // Get current page row IDs for selection
  const currentPageRowIds = React.useMemo(() => {
    return paginatedData.map(rowId);
  }, [paginatedData, rowId]);

  // Selection handlers
  const isAllPageRowsSelected = isAllSelected(currentPageRowIds);
  const isPartialSelection = isPartiallySelected(currentPageRowIds);

  const handleSelectAll = () => {
    toggleSelectAll(currentPageRowIds);
  };

  const handleSelectRow = (id: string) => {
    toggleSelection(id);
  };

  return (
    <div className={className}>
      {bulkActionsComponent && selectionCount > 0 && <div className="mb-4">{bulkActionsComponent}</div>}

      <div className="flex items-center py-4 gap-4">
        {searchKey && (
          <Input
            placeholder={searchPlaceholder}
            value={filtering}
            onChange={(value) => {
              setFiltering(value as string);
              setPage(1);
            }}
            className="max-w-sm"
          />
        )}
        {showColumnToggle && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="ml-auto h-12">
                Columns <IconChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {columns.map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.key as string}
                    className="capitalize"
                    checked={columnVisibility[column.key as string]}
                    onCheckedChange={(value) =>
                      setColumnVisibility((prev) => ({
                        ...prev,
                        [column.key as string]: !!value,
                      }))
                    }
                  >
                    {column.header}
                  </DropdownMenuCheckboxItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <div className="flex items-center justify-center">
                  <Checkbox
                    checked={isAllPageRowsSelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all"
                    className={cn("!border-neutral-500 dark:border-neutral-300", isPartialSelection && "data-[state=checked]:bg-muted data-[state=checked]:text-muted-foreground")}
                  />
                </div>
              </TableHead>
              {visibleColumns.map((column) => (
                <TableHead
                  key={column.key as string}
                  className={column.sortable ? "cursor-pointer select-none" : ""}
                  onClick={() => column.sortable && toggleSort(column.key as string)}
                >
                  <div className="flex items-center gap-2 py-2">
                    {column.header}
                    {column.sortable && getSortDirection(column.key as string) && (
                      <span className="text-xs font-enhanced-unicode sort-arrow">{getSortDirection(column.key as string) === "asc" ? "↑" : "↓"}</span>
                    )}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length ? (
              paginatedData.map((row) => {
                const id = rowId(row);
                const rowIsSelected = isSelected(id);

                return (
                  <TableRow key={id} data-state={rowIsSelected && "selected"} className={cn("cursor-pointer", rowIsSelected && "bg-muted/50")} onClick={() => handleSelectRow(id)}>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center">
                        <Checkbox checked={rowIsSelected} onCheckedChange={() => handleSelectRow(id)} aria-label="Select row" />
                      </div>
                    </TableCell>
                    {visibleColumns.map((column) => (
                      <TableCell key={column.key as string}>{column.accessor ? column.accessor(row) : row[column.key as keyof T]}</TableCell>
                    ))}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={visibleColumns.length + 1} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between space-x-2 py-4">
          <div className="text-sm text-muted-foreground">
            Showing {Math.min((currentPage - 1) * pageSize + 1, sortedData.length)} to {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length} results
            {selectionCount > 0 && <span className="ml-2 font-medium">({selectionCount} selected)</span>}
          </div>
          <div className="flex items-center space-x-2">
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="border border-border rounded px-2 py-1 text-sm">
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={40}>40</option>
              <option value={60}>60</option>
              <option value={100}>100</option>
            </select>
            <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>
              Previous
            </Button>
            <div className="text-sm">
              Page {currentPage} of {totalPages}
            </div>
            <Button variant="outline" size="sm" onClick={() => setPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
