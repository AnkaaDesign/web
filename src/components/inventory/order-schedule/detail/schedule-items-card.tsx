import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconPackage, IconAlertCircle, IconChevronUp, IconChevronDown, IconSelector } from "@tabler/icons-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ColumnVisibilityManager } from "../../item/list/column-visibility-manager";
import { createItemColumns } from "../../item/list/item-table-columns";
import type { ItemColumn } from "../../item/list/types";
import { useColumnVisibility } from "@/hooks/common/use-column-visibility";
import { useCanViewPrices } from "../../../../hooks";
import { formatCurrency, formatNumber } from "../../../../utils";
import { routes } from "../../../../constants";
import type { Item } from "../../../../types";
import { cn } from "@/lib/utils";

// Per-item trigger-preview projection. Mirrors the shape returned by
// useOrderScheduleProjection — only the fields this table renders are typed.
interface ScheduleProjectionItem {
  itemId: string;
  quantityGapOnly: number;
  totalGapOnly: number;
  quantityGapPlusCycle: number;
  totalGapPlusCycle: number;
  reasonGapOnly?: string | null;
  reasonGapPlusCycle?: string | null;
}

interface ScheduleProjectionMeta {
  gapOnlyTotal: number;
  gapPlusCycleTotal: number;
  scheduledTotal?: number;
  scheduledDate?: string | Date | null;
}

interface ScheduleItemsCardProps {
  items?: Item[];
  projection?: ScheduleProjectionItem[];
  projectionMeta?: ScheduleProjectionMeta | null;
  hasGapOption?: boolean;
  className?: string;
}

const DEFAULT_PAGE_SIZE = 20;
const STORAGE_KEY = "order-schedule-items-visible-columns";

// Projection columns are not part of the base Item model, so they sort via an
// explicit accessor over the projection map rather than a property path.
type ScheduleColumn = ItemColumn & { sortAccessor?: (item: Item) => number | string | null };

export function ScheduleItemsCard({ items, projection, projectionMeta, hasGapOption = false, className }: ScheduleItemsCardProps) {
  const navigate = useNavigate();
  const canViewPrices = useCanViewPrices();
  const safeItems = items || [];

  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

  const projectionByItem = useMemo(
    () => new Map((projection || []).map((p) => [p.itemId, p])),
    [projection],
  );

  // Skipped/zero projection cells show "—". When the API explains why, surface
  // it as a tooltip instead of a bare dash.
  const renderSkippableCell = (value: string | null, reason?: string | null) => {
    if (value !== null) return value;
    if (!reason) return "—";
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help text-muted-foreground underline decoration-dotted underline-offset-2">—</span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-xs text-xs">{reason}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  // Base item columns (code, name, brand, category, measures, stock, price, …)
  // plus the schedule-specific projection columns appended at the end.
  const allColumns = useMemo<ScheduleColumn[]>(() => {
    const base = createItemColumns() as ScheduleColumn[];

    const projectionColumns: ScheduleColumn[] = [];

    if (hasGapOption) {
      projectionColumns.push(
        {
          key: "gapOnlyQty",
          header: "QTD. ATÉ A PRÓXIMA",
          sortable: true,
          align: "right",
          className: "w-36",
          accessor: (item) => {
            const p = projectionByItem.get(item.id);
            return (
              <div className="tabular-nums">
                {renderSkippableCell(p && p.quantityGapOnly > 0 ? formatNumber(p.quantityGapOnly) : null, p?.reasonGapOnly)}
              </div>
            );
          },
          sortAccessor: (item) => projectionByItem.get(item.id)?.quantityGapOnly ?? -1,
        },
        {
          key: "gapOnlyPrice",
          header: "PREÇO ATÉ A PRÓXIMA",
          sortable: true,
          align: "right",
          className: "w-36",
          accessor: (item) => {
            const p = projectionByItem.get(item.id);
            return (
              <div className="tabular-nums">
                {renderSkippableCell(p && p.quantityGapOnly > 0 ? formatCurrency(p.totalGapOnly) : null, p?.reasonGapOnly)}
              </div>
            );
          },
          sortAccessor: (item) => projectionByItem.get(item.id)?.totalGapOnly ?? -1,
        },
      );
    }

    projectionColumns.push(
      {
        key: "expectedQty",
        header: "QUANTIDADE ESPERADA",
        sortable: true,
        align: "right",
        className: "w-36",
        accessor: (item) => {
          const p = projectionByItem.get(item.id);
          return (
            <div className="tabular-nums">
              {renderSkippableCell(p && p.quantityGapPlusCycle > 0 ? formatNumber(p.quantityGapPlusCycle) : null, p?.reasonGapPlusCycle)}
            </div>
          );
        },
        sortAccessor: (item) => projectionByItem.get(item.id)?.quantityGapPlusCycle ?? -1,
      },
      {
        key: "expectedPrice",
        header: "PREÇO ESPERADO",
        sortable: true,
        align: "right",
        className: "w-36",
        accessor: (item) => {
          const p = projectionByItem.get(item.id);
          return (
            <div className="tabular-nums">
              {renderSkippableCell(p && p.quantityGapPlusCycle > 0 ? formatCurrency(p.totalGapPlusCycle) : null, p?.reasonGapPlusCycle)}
            </div>
          );
        },
        sortAccessor: (item) => projectionByItem.get(item.id)?.totalGapPlusCycle ?? -1,
      },
    );

    const merged = [...base, ...projectionColumns];

    // Warehouse users can't see prices: drop every price-bearing column.
    if (canViewPrices) return merged;
    const priceKeys = new Set(["price", "totalPrice", "gapOnlyPrice", "expectedPrice"]);
    return merged.filter((col) => !priceKeys.has(col.key));
  }, [hasGapOption, canViewPrices, projectionByItem]);

  // Default visible: the original schedule columns + the projection columns.
  const defaultColumns = useMemo(() => {
    const keys = ["uniCode", "name", "brand.name", "category.name", "quantity", "measures"];
    if (hasGapOption) keys.push("gapOnlyQty", "gapOnlyPrice");
    keys.push("expectedQty", "expectedPrice");
    return new Set(canViewPrices ? keys : keys.filter((k) => k !== "gapOnlyPrice" && k !== "expectedPrice"));
  }, [hasGapOption, canViewPrices]);

  const { visibleColumns, setVisibleColumns } = useColumnVisibility(STORAGE_KEY, defaultColumns);

  const filteredItems = useMemo(() => {
    if (!searchText.trim()) return safeItems;
    const q = searchText.toLowerCase();
    return safeItems.filter(
      (item) =>
        item.name?.toLowerCase().includes(q) ||
        item.uniCode?.toLowerCase().includes(q) ||
        item.barcodes?.some((b) => b.toLowerCase().includes(q)) ||
        item.brands?.some((b) => b.name.toLowerCase().includes(q)) ||
        item.category?.name?.toLowerCase().includes(q),
    );
  }, [safeItems, searchText]);

  const sortedItems = useMemo(() => {
    if (!sortConfig) return filteredItems;
    const column = allColumns.find((c) => c.key === sortConfig.key);

    const getValue = (item: Item): any => {
      if (column?.sortAccessor) return column.sortAccessor(item);
      if (sortConfig.key.includes(".")) {
        return sortConfig.key.split(".").reduce((obj, key) => obj?.[key], item as any);
      }
      return (item as any)[sortConfig.key];
    };

    return [...filteredItems].sort((a, b) => {
      const aValue = getValue(a);
      const bValue = getValue(b);
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;
      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortConfig.direction === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }
      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredItems, sortConfig, allColumns]);

  const paginatedItems = useMemo(() => {
    const start = page * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [sortedItems, page, pageSize]);

  const totalPages = Math.ceil(sortedItems.length / pageSize);

  const handleSort = (key: string) => {
    setSortConfig((current) => {
      if (!current || current.key !== key) return { key, direction: "asc" };
      if (current.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  };

  const renderSortIcon = (columnKey: string) => {
    if (!sortConfig || sortConfig.key !== columnKey) {
      return <IconSelector className="h-3 w-3 text-muted-foreground" />;
    }
    return sortConfig.direction === "asc" ? <IconChevronUp className="h-3 w-3" /> : <IconChevronDown className="h-3 w-3" />;
  };

  const displayColumns = allColumns.filter((col) => visibleColumns.has(col.key));

  const header = (
    <CardHeader className="pb-4">
      <CardTitle className="flex items-center gap-2">
        <IconPackage className="h-5 w-5 text-muted-foreground" />
        Itens do Agendamento
        {safeItems.length > 0 && (
          <Badge variant="secondary" className="ml-2">
            {safeItems.length}
          </Badge>
        )}
      </CardTitle>
    </CardHeader>
  );

  if (safeItems.length === 0) {
    return (
      <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
        {header}
        <CardContent className="pt-0">
          <div className="text-center py-12">
            <div className="p-4 bg-muted/30 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <IconPackage className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-foreground">Nenhum item configurado</h3>
            <p className="text-sm text-muted-foreground">Este agendamento não possui itens configurados.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Totals row reconciles with the "Executar agora" buttons. Rendered as its own
  // table so it stays pinned above the pagination regardless of the current page;
  // shared column widths keep it aligned with the header/body tables.
  const showTotals = !!projectionMeta;

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      {header}
      <CardContent className="pt-0 space-y-4">
        {/* Search and Column Visibility */}
        <div className="flex gap-2">
          <TableSearchInput
            value={searchText}
            onChange={setSearchText}
            placeholder="Buscar por nome, código, código de barras..."
            className="flex-1"
          />
          <ColumnVisibilityManager columns={allColumns} visibleColumns={visibleColumns} onVisibilityChange={setVisibleColumns} />
        </div>

        {/* Table Container — a single table (header + body + totals) so the
            header always lines up with the body columns. The wrapping div owns
            the vertical scroll; the header sticks to the top and the totals row
            sticks to the bottom. */}
        <div className="rounded-lg border border-border overflow-hidden flex flex-col">
          {/* min-height reserves ~5 rows so the pagination/totals never crowd a short list */}
          <div className="overflow-auto" style={{ minHeight: "320px", maxHeight: "600px" }}>
            <Table className="[&>div]:border-0 w-full">
              <TableHeader className="sticky top-0 z-20 [&_tr]:border-b [&_tr]:border-border">
                <TableRow className="bg-muted hover:bg-muted">
                  {displayColumns.map((column) => (
                    <TableHead
                      key={column.key}
                      className={cn("whitespace-nowrap p-0 bg-muted", column.className)}
                    >
                      {column.sortable !== false ? (
                        <button
                          onClick={() => handleSort(column.key)}
                          className={cn(
                            "flex items-center gap-1 w-full h-10 px-4 hover:bg-muted/70 transition-colors cursor-pointer border-0 bg-transparent",
                            column.align === "center" && "justify-center",
                            column.align === "right" && "justify-end",
                            (!column.align || column.align === "left") && "justify-start",
                          )}
                        >
                          <span>{column.header}</span>
                          {renderSortIcon(column.key)}
                        </button>
                      ) : (
                        <div
                          className={cn(
                            "flex items-center h-10 px-4",
                            column.align === "center" && "justify-center",
                            column.align === "right" && "justify-end",
                            (!column.align || column.align === "left") && "justify-start",
                          )}
                        >
                          <span>{column.header}</span>
                        </div>
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>

              <TableBody>
                {paginatedItems.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={displayColumns.length} className="text-center py-12">
                      <IconAlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">Nenhum item encontrado</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedItems.map((item) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer"
                      onClick={() => navigate(routes.inventory.products.details(item.id))}
                    >
                      {displayColumns.map((column) => (
                        <TableCell
                          key={column.key}
                          className={cn(
                            column.className,
                            "p-0",
                            column.align === "center" && "text-center",
                            column.align === "right" && "text-right",
                            (!column.align || column.align === "left") && "text-left",
                          )}
                        >
                          <div className="px-4 py-2">{column.accessor(item)}</div>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>

              {showTotals && (
                <TableFooter className="sticky bottom-0 z-20 bg-muted border-t border-border">
                  <TableRow className="bg-muted hover:bg-muted font-semibold">
                    {displayColumns.map((column, index) => {
                      let content: React.ReactNode = "";
                      if (column.key === "gapOnlyPrice") content = formatCurrency(projectionMeta!.gapOnlyTotal);
                      else if (column.key === "expectedPrice") content = formatCurrency(projectionMeta!.gapPlusCycleTotal);
                      else if (index === 0) content = "Total";
                      return (
                        <TableCell
                          key={column.key}
                          className={cn(
                            column.className,
                            "p-0 tabular-nums",
                            column.align === "right" && "text-right",
                            column.align === "center" && "text-center",
                            (!column.align || column.align === "left") && "text-left",
                          )}
                        >
                          <div className="px-4 py-2">{content}</div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>

          {/* Pagination Footer */}
          <div className="px-4 border-t border-border bg-muted/50">
            <SimplePaginationAdvanced
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              pageSize={pageSize}
              totalItems={sortedItems.length}
              pageSizeOptions={[20, 40, 60, 100]}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setPage(0);
              }}
              showPageSizeSelector={true}
              showGoToPage={true}
              showPageInfo={true}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ScheduleItemsCard;
