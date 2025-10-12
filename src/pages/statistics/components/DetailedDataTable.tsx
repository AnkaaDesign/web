/**
 * Detailed Data Table Component
 *
 * Sortable, filterable data table with:
 * - Column sorting
 * - Search/filter
 * - Pagination
 * - Export to CSV
 * - Row click handler
 * - Custom cell renderers
 */

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  IconArrowUp,
  IconArrowDown,
  IconDownload,
  IconSearch,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export interface TableColumn<T = any> {
  /**
   * Column identifier
   */
  key: string;

  /**
   * Column header label
   */
  label: string;

  /**
   * Is column sortable?
   */
  sortable?: boolean;

  /**
   * Custom cell renderer
   */
  render?: (value: any, row: T) => React.ReactNode;

  /**
   * Column width
   */
  width?: string;

  /**
   * Align content
   */
  align?: "left" | "center" | "right";
}

export interface DetailedDataTableProps<T = any> {
  /**
   * Table columns configuration
   */
  columns: TableColumn<T>[];

  /**
   * Table data rows
   */
  data: T[];

  /**
   * Row click handler
   */
  onRowClick?: (row: T) => void;

  /**
   * Show search input
   */
  searchable?: boolean;

  /**
   * Search placeholder
   */
  searchPlaceholder?: string;

  /**
   * Show export button
   */
  exportable?: boolean;

  /**
   * Export filename
   */
  exportFilename?: string;

  /**
   * Enable pagination
   */
  paginated?: boolean;

  /**
   * Rows per page
   */
  pageSize?: number;

  /**
   * Loading state
   */
  loading?: boolean;

  /**
   * Empty state message
   */
  emptyMessage?: string;

  /**
   * Additional className
   */
  className?: string;
}

/**
 * Detailed Data Table
 *
 * Feature-rich table for displaying detailed statistics data.
 */
export function DetailedDataTable<T extends Record<string, any>>({
  columns,
  data,
  onRowClick,
  searchable = true,
  searchPlaceholder = "Buscar...",
  exportable = true,
  exportFilename = "export.csv",
  paginated = true,
  pageSize = 10,
  loading = false,
  emptyMessage = "Nenhum dado disponível",
  className,
}: DetailedDataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);

  // Filter data based on search
  const filteredData = useMemo(() => {
    if (!searchQuery) return data;

    const query = searchQuery.toLowerCase();
    return data.filter((row) => {
      return Object.values(row).some((value) => {
        return String(value).toLowerCase().includes(query);
      });
    });
  }, [data, searchQuery]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];

      if (aValue === bValue) return 0;

      const comparison = aValue < bValue ? -1 : 1;
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredData, sortKey, sortDirection]);

  // Paginate data
  const paginatedData = useMemo(() => {
    if (!paginated) return sortedData;

    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return sortedData.slice(start, end);
  }, [sortedData, currentPage, pageSize, paginated]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  // Handle column sort
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  // Export to CSV
  const handleExport = () => {
    const headers = columns.map((col) => col.label).join(",");
    const rows = sortedData.map((row) => {
      return columns
        .map((col) => {
          const value = row[col.key];
          // Escape commas and quotes in CSV
          const escaped = String(value).replace(/"/g, '""');
          return `"${escaped}"`;
        })
        .join(",");
    });

    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = exportFilename;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className={cn("border rounded-lg p-8", className)}>
        <div className="flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">
            Carregando dados...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Table Controls */}
      <div className="flex items-center justify-between gap-4">
        {/* Search */}
        {searchable && (
          <div className="relative flex-1 max-w-sm">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        )}

        {/* Export Button */}
        {exportable && (
          <Button variant="outline" size="sm" onClick={handleExport}>
            <IconDownload className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  style={{ width: column.width }}
                  className={cn(
                    column.align === "center" && "text-center",
                    column.align === "right" && "text-right",
                    column.sortable && "cursor-pointer hover:bg-accent"
                  )}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className="flex items-center gap-2">
                    {column.label}
                    {column.sortable && sortKey === column.key && (
                      <>
                        {sortDirection === "asc" ? (
                          <IconArrowUp className="h-4 w-4" />
                        ) : (
                          <IconArrowDown className="h-4 w-4" />
                        )}
                      </>
                    )}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-center py-8 text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((row, rowIndex) => (
                <TableRow
                  key={rowIndex}
                  onClick={() => onRowClick?.(row)}
                  className={cn(onRowClick && "cursor-pointer hover:bg-accent")}
                >
                  {columns.map((column) => {
                    const value = row[column.key];
                    const content = column.render
                      ? column.render(value, row)
                      : value;

                    return (
                      <TableCell
                        key={column.key}
                        className={cn(
                          column.align === "center" && "text-center",
                          column.align === "right" && "text-right"
                        )}
                      >
                        {content}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {paginated && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Mostrando {(currentPage - 1) * pageSize + 1} a{" "}
            {Math.min(currentPage * pageSize, sortedData.length)} de{" "}
            {sortedData.length} resultados
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Anterior
            </Button>
            <div className="text-sm">
              Página {currentPage} de {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
