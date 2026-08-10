// components/questionnaire/admin/entity-table.tsx
//
// Shared admin data table for the questionnaire domain (Temas, Perguntas,
// Campanhas). Mirrors the skill/topic list structure (SkillList): ONE full-height
// Card wrapping the search row, a flex-1 scrollable table, and the pagination at
// the bottom — so the questionnaire admin matches the assessment admin layout.

import { useState, type ReactNode } from "react";
import { IconArrowsSort, IconSortAscending, IconSortDescending } from "@tabler/icons-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
import { cn } from "@/lib/utils";

export interface EntityColumn<T> {
  key: string;
  header: string;
  align?: "left" | "center" | "right";
  className?: string;
  cell: (row: T) => ReactNode;
  /** Torna o cabeçalho clicável. A tradução `key` → `orderBy` fica na página. */
  sortable?: boolean;
}

export type EntitySort = { key: string; direction: "asc" | "desc" } | null;

/** One entry of the right-click menu built per row by `contextActions`. */
export interface EntityRowAction {
  key: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  /** Renders in destructive red and behind a leading separator. */
  destructive?: boolean;
  /** Draws a separator above this entry. */
  separatorBefore?: boolean;
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
  /** Right-click menu for a row. Return an empty array to suppress the menu. */
  contextActions?: (row: T) => EntityRowAction[];
  /** Coluna ordenada no momento; `null` = ordenação padrão da página. */
  sort?: EntitySort;
  onSortChange?: (sort: EntitySort) => void;
  emptyText?: string;
  className?: string;
}

/** asc → desc → padrão. */
const nextSort = (current: EntitySort, key: string): EntitySort => {
  if (current?.key !== key) return { key, direction: "asc" };
  if (current.direction === "asc") return { key, direction: "desc" };
  return null;
};

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
  contextActions,
  sort = null,
  onSortChange,
  emptyText = "Nenhum resultado.",
  className,
}: EntityTableProps<T>) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const [menu, setMenu] = useState<{ x: number; y: number; actions: EntityRowAction[] } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, row: T) => {
    if (!contextActions) return;
    const actions = contextActions(row);
    if (!actions.length) return;
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, actions });
  };

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
                {columns.map((c) => {
                  const isSortable = !!c.sortable && !!onSortChange;
                  const active = sort?.key === c.key ? sort.direction : null;
                  return (
                    <TableHead
                      key={c.key}
                      aria-sort={active ? (active === "asc" ? "ascending" : "descending") : undefined}
                      className={cn(
                        "whitespace-nowrap bg-muted text-xs font-bold uppercase text-foreground",
                        alignClass(c.align),
                        c.className,
                        isSortable && "p-0",
                      )}
                    >
                      {isSortable ? (
                        <button
                          type="button"
                          onClick={() => onSortChange!(nextSort(sort, c.key))}
                          className={cn(
                            "flex h-full w-full items-center gap-1.5 px-3 py-2 transition-colors hover:text-primary",
                            c.align === "right" && "justify-end",
                            c.align === "center" && "justify-center",
                          )}
                        >
                          <span className="truncate">{c.header}</span>
                          {active === "asc" ? (
                            <IconSortAscending className="h-3.5 w-3.5 shrink-0 text-primary" />
                          ) : active === "desc" ? (
                            <IconSortDescending className="h-3.5 w-3.5 shrink-0 text-primary" />
                          ) : (
                            <IconArrowsSort className="h-3.5 w-3.5 shrink-0 opacity-40" />
                          )}
                        </button>
                      ) : (
                        c.header
                      )}
                    </TableHead>
                  );
                })}
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
                    onContextMenu={(e) => handleContextMenu(e, row)}
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

      <DropdownMenu open={!!menu} onOpenChange={(open) => !open && setMenu(null)}>
        <PositionedDropdownMenuContent
          position={menu}
          isOpen={!!menu}
          className="w-56 ![position:fixed]"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {(menu?.actions ?? []).map((action) => (
            <div key={action.key}>
              {action.separatorBefore && <DropdownMenuSeparator />}
              <DropdownMenuItem
                disabled={action.disabled}
                onClick={() => {
                  setMenu(null);
                  action.onClick();
                }}
                className={cn(action.destructive && "text-destructive")}
              >
                {action.icon}
                {action.label}
              </DropdownMenuItem>
            </div>
          ))}
        </PositionedDropdownMenuContent>
      </DropdownMenu>
    </Card>
  );
}
