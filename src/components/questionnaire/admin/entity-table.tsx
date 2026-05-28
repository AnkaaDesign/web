// components/questionnaire/admin/entity-table.tsx
//
// Shared admin data table for the questionnaire domain (Temas, Perguntas,
// Campanhas). Mirrors the skill/topic list structure (SkillList): ONE full-height
// Card wrapping the search row, a flex-1 scrollable table, and the pagination at
// the bottom — so the questionnaire admin matches the assessment admin layout.

import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface EntityColumn<T> {
  key: string;
  header: string;
  align?: "left" | "center" | "right";
  className?: string;
  cell: (row: T) => ReactNode;
}

interface EntityTableProps<T extends { id: string }> {
  columns: EntityColumn<T>[];
  rows: T[];
  isLoading?: boolean;
  searchValue: string;
  searchPlaceholder?: string;
  onSearchChange: (v: string) => void;
  page: number; // 0-based
  pageSize: number;
  totalItems: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
  onRowClick?: (row: T) => void;
  emptyText?: string;
  className?: string;
}

const alignClass = (a?: "left" | "center" | "right") =>
  a === "center" ? "text-center" : a === "right" ? "text-right" : "text-left";

export function EntityTable<T extends { id: string }>({
  columns,
  rows,
  isLoading,
  searchValue,
  searchPlaceholder = "Buscar...",
  onSearchChange,
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  onRowClick,
  emptyText = "Nenhum resultado.",
  className,
}: EntityTableProps<T>) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  return (
    <Card className={cn("flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden p-4">
        {/* Wrap in a flex-row so TableSearchInput's flex-1 grows horizontally, not vertically. */}
        <div className="flex flex-col gap-3 shrink-0 sm:flex-row">
          <TableSearchInput value={searchValue} onChange={onSearchChange} placeholder={searchPlaceholder} />
        </div>

        <div className="flex-1 min-h-0 overflow-auto rounded-md border border-border/40">
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                {columns.map((c) => (
                  <TableHead
                    key={c.key}
                    className={cn("whitespace-nowrap bg-muted text-xs font-bold uppercase text-foreground", alignClass(c.align), c.className)}
                  >
                    {c.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {columns.map((c) => (
                      <TableCell key={c.key}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="py-12 text-center text-sm text-muted-foreground">
                    {emptyText}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row, idx) => (
                  <TableRow
                    key={row.id}
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      idx % 2 === 1 ? "!bg-muted/15" : "!bg-transparent",
                      onRowClick && "cursor-pointer hover:!bg-muted/30",
                    )}
                  >
                    {columns.map((c) => (
                      <TableCell key={c.key} className={cn(alignClass(c.align), c.className)}>
                        {c.cell(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <SimplePaginationAdvanced
          currentPage={page}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          pageSizeOptions={[20, 40, 60, 100]}
          showPageSizeSelector
          showGoToPage
          showPageInfo
        />
      </CardContent>
    </Card>
  );
}
