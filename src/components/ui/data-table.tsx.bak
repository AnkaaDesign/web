import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { IconChevronDown, IconChevronUp, IconSelector } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";

interface DataTableColumn<T> {
  key: keyof T | string;
  header: string;
  accessor?: (row: T) => React.ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  align?: "left" | "center" | "right";
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  searchKey?: keyof T | string;
  searchPlaceholder?: string;
  showColumnToggle?: boolean;
  pageSize?: number;
  className?: string;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  searchKey,
  searchPlaceholder = "Search...",
  showColumnToggle = true,
  pageSize = 10,
  className,
}: DataTableProps<T>) {
  const [sorting, setSorting] = React.useState<{
    column: string | null;
    direction: "asc" | "desc";
  }>({ column: null, direction: "asc" });
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
  const [currentPage, setCurrentPage] = React.useState(1);

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
    if (!sorting.column) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = a[sorting.column!];
      const bValue = b[sorting.column!];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      const aString = String(aValue).toLowerCase();
      const bString = String(bValue).toLowerCase();

      if (sorting.direction === "asc") {
        return aString.localeCompare(bString);
      }
      return bString.localeCompare(aString);
    });
  }, [filteredData, sorting]);

  // Paginate data
  const paginatedData = React.useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  const handleSort = (column: string) => {
    if (sorting.column === column) {
      setSorting({
        column,
        direction: sorting.direction === "asc" ? "desc" : "asc",
      });
    } else {
      setSorting({ column, direction: "asc" });
    }
  };

  const visibleColumns = columns.filter((col) => columnVisibility[col.key as string]);

  return (
    <div className={className}>
      <div className="flex items-center py-4 gap-4">
        {searchKey && (
          <Input
            placeholder={searchPlaceholder}
            value={filtering}
            onChange={(event) => {
              setFiltering(event.target.value);
              setCurrentPage(1);
            }}
            className="max-w-sm"
          />
        )}
        {showColumnToggle && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="ml-auto">
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
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {visibleColumns.map((column) => (
                <TableHead key={column.key as string} className={cn("whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0", column.className)}>
                  {column.sortable ? (
                    <button
                      onClick={() => handleSort(column.key as string)}
                      className={cn(
                        "flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent",
                        column.align === "center" && "justify-center",
                        column.align === "right" && "justify-end",
                        column.align === "left" && "justify-start",
                        !column.align && "justify-start",
                      )}
                    >
                      <TruncatedTextWithTooltip text={column.header} />
                      <div className="inline-flex items-center ml-1">
                        {sorting.column !== column.key && <IconSelector className="h-4 w-4 text-muted-foreground" />}
                        {sorting.column === column.key && sorting.direction === "asc" && <IconChevronUp className="h-4 w-4 text-foreground" />}
                        {sorting.column === column.key && sorting.direction === "desc" && <IconChevronDown className="h-4 w-4 text-foreground" />}
                      </div>
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
                      <TruncatedTextWithTooltip text={column.header} />
                    </div>
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length ? (
              paginatedData.map((row, index) => (
                <TableRow key={index}>
                  {visibleColumns.map((column) => (
                    <TableCell key={column.key as string}>{column.accessor ? column.accessor(row) : row[column.key as keyof T]}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={visibleColumns.length} className="h-24 text-center">
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
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))} disabled={currentPage === 1}>
              Previous
            </Button>
            <div className="text-sm">
              Page {currentPage} of {totalPages}
            </div>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
