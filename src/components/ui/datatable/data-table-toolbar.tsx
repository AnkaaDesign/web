import { memo, useMemo, useState, type ReactNode } from "react";
import type { Table, VisibilityState } from "@tanstack/react-table";
import {
  IconFilter,
  IconFilterOff,
  IconShare,
  IconLink,
  IconFileTypePdf,
  IconFileTypeXls,
  IconListCheck,
  IconChevronsDown,
  IconChevronsUp,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { DataTableColumnManager } from "./data-table-column-manager";
import { columnHeaderText } from "./data-table-utils";
import type { ColumnAlign, DataTableColumnDef } from "./data-table-types";

export type ShareAction = "link" | "pdf" | "xlsx";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  columns: DataTableColumnDef<TData>[];
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  isSearchPending?: boolean;
  enableColumnReorder: boolean;
  columnAlignment: Record<string, ColumnAlign>;
  onColumnAlignmentChange: (alignment: Record<string, ColumnAlign>) => void;
  onResetLayout: () => void;
  hasFilters: boolean;
  filterCount: number;
  onOpenFilters?: () => void;
  shareEnabled: boolean;
  onShare?: (action: ShareAction) => void;
  /** "View selected only" toggle — only shown when there is a selection. */
  selectedCount: number;
  showSelectedOnly: boolean;
  onToggleSelectedOnly: (value: boolean) => void;
  /** Expand/collapse-all control — only shown when row expansion is enabled. */
  enableExpansion?: boolean;
  allExpanded?: boolean;
  onToggleExpandAll?: () => void;
  customActions?: ReactNode;
}

function DataTableToolbarInner<TData>({
  table,
  columns,
  search,
  onSearchChange,
  searchPlaceholder,
  isSearchPending,
  enableColumnReorder,
  columnAlignment,
  onColumnAlignmentChange,
  onResetLayout,
  hasFilters,
  filterCount,
  onOpenFilters,
  shareEnabled,
  onShare,
  selectedCount,
  showSelectedOnly,
  onToggleSelectedOnly,
  enableExpansion,
  allExpanded,
  onToggleExpandAll,
  customActions,
}: DataTableToolbarProps<TData>) {
  const visibility = table.getState().columnVisibility;
  const columnOrder = table.getState().columnOrder;
  const [shareOpen, setShareOpen] = useState(false);

  const baseColumns = useMemo(() => columns.map((c) => ({ id: c.id, header: columnHeaderText(c) })), [columns]);
  const visibleSet = useMemo(
    () => new Set(columns.filter((c) => visibility[c.id] !== false).map((c) => c.id)),
    [columns, visibility],
  );
  const defaultAlign = (id: string): ColumnAlign => columns.find((c) => c.id === id)?.meta?.align ?? "left";

  const handleVisibilityChange = (set: Set<string>) => {
    const record: VisibilityState = {};
    for (const c of columns) record[c.id] = set.has(c.id);
    table.setColumnVisibility(record);
  };

  const share = (action: ShareAction) => {
    setShareOpen(false);
    onShare?.(action);
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <TableSearchInput
        value={search}
        onChange={onSearchChange}
        placeholder={searchPlaceholder ?? "Buscar..."}
        isPending={isSearchPending}
      />

      <div className="flex flex-wrap items-center gap-2">
        {customActions}

        {enableExpansion && (
          <Button variant="outline" onClick={onToggleExpandAll} className="gap-2" title={allExpanded ? "Recolher todos os grupos" : "Expandir todos os grupos"}>
            {allExpanded ? <IconChevronsUp className="h-4 w-4" /> : <IconChevronsDown className="h-4 w-4" />}
            {allExpanded ? "Recolher tudo" : "Expandir tudo"}
          </Button>
        )}

        {selectedCount > 0 && (
          <Button
            variant={showSelectedOnly ? "default" : "outline"}
            onClick={() => onToggleSelectedOnly(!showSelectedOnly)}
            className="gap-2"
          >
            <IconListCheck className="h-4 w-4" />
            Selecionados
            <Badge variant="secondary" className="ml-1 h-5 min-w-0 px-1.5">
              {selectedCount}
            </Badge>
          </Button>
        )}

        <DataTableColumnManager
          columns={baseColumns}
          visibleColumns={visibleSet}
          onVisibilityChange={handleVisibilityChange}
          columnOrder={columnOrder.length ? columnOrder : columns.map((c) => c.id)}
          onColumnOrderChange={enableColumnReorder ? (order) => table.setColumnOrder(order) : () => {}}
          alignment={columnAlignment}
          onAlignmentChange={onColumnAlignmentChange}
          defaultAlign={defaultAlign}
          onReset={onResetLayout}
        />

        {hasFilters && (
          <Button variant={filterCount > 0 ? "default" : "outline"} onClick={onOpenFilters} className="gap-2">
            {filterCount > 0 ? <IconFilter className="h-4 w-4" /> : <IconFilterOff className="h-4 w-4" />}
            Filtros
            {filterCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-0 px-1.5">
                {filterCount}
              </Badge>
            )}
          </Button>
        )}

        {shareEnabled && (
          <Popover open={shareOpen} onOpenChange={setShareOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <IconShare className="h-4 w-4" />
                Compartilhar
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-1.5">
              <button
                type="button"
                onClick={() => share("link")}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
              >
                <IconLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                Copiar link
              </button>
              <button
                type="button"
                onClick={() => share("pdf")}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
              >
                <IconFileTypePdf className="h-4 w-4 shrink-0 text-muted-foreground" />
                Exportar PDF
              </button>
              <button
                type="button"
                onClick={() => share("xlsx")}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
              >
                <IconFileTypeXls className="h-4 w-4 shrink-0 text-muted-foreground" />
                Exportar Excel
              </button>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}

// Memoized so a virtualizer scroll tick re-rendering <DataTable> doesn't re-render the
// whole toolbar (search input, column manager, filter/share buttons) every frame.
export const DataTableToolbar = memo(DataTableToolbarInner) as typeof DataTableToolbarInner;
