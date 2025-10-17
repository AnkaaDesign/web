import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { IconPaint, IconCalendar, IconFlask, IconDroplet, IconChevronDown, IconChevronUp, IconSelector, IconExternalLink } from "@tabler/icons-react";
import type { Paint, PaintProduction } from "../../../../types";
import { formatDate } from "../../../../utils";
import { cn } from "@/lib/utils";
import { useTableState } from "@/hooks/use-table-state";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { useScrollbarWidth } from "@/hooks/use-scrollbar-width";
import { routes } from "../../../../constants";

interface PaintProductionHistoryCardProps {
  paint: Paint;
  className?: string;
}

// Column definition
interface ProductionColumn {
  key: string;
  header: string;
  accessor: (item: { production: PaintProduction; formulaDescription: string }) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

// Column visibility manager component
function ColumnVisibilityManager({
  columns,
  visibleColumns,
  onVisibilityChange,
}: {
  columns: ProductionColumn[];
  visibleColumns: Set<string>;
  onVisibilityChange: (columns: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [localVisible, setLocalVisible] = useState(visibleColumns);

  const handleToggle = (columnKey: string, checked: boolean) => {
    const newVisible = new Set(localVisible);
    if (checked) {
      newVisible.add(columnKey);
    } else {
      newVisible.delete(columnKey);
    }
    setLocalVisible(newVisible);
  };

  const handleApply = () => {
    onVisibilityChange(localVisible);
    setOpen(false);
  };

  const visibleCount = localVisible.size;
  const totalCount = columns.length;

  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>
        Colunas ({visibleCount}/{totalCount})
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-64 bg-popover border border-border rounded-md shadow-lg z-50 p-4">
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {columns.map((column) => (
                <label key={column.key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localVisible.has(column.key)}
                    onChange={(e) => handleToggle(column.key, e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">{column.header}</span>
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Button size="sm" onClick={handleApply}>
                Aplicar
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Default visible columns
const getDefaultVisibleColumns = (): Set<string> => {
  return new Set(["formula", "volumeLiters", "createdAt"]);
};

// Create columns
const createProductionColumns = (): ProductionColumn[] => {
  return [
    {
      key: "formula",
      header: "FÓRMULA",
      accessor: (item) => <TruncatedTextWithTooltip text={item.formulaDescription || "N/A"} />,
      sortable: false,
      className: "w-96",
      align: "left",
    },
    {
      key: "volumeLiters",
      header: "VOLUME",
      accessor: (item) => (
        <div className="flex items-center gap-1">
          <IconDroplet className="h-4 w-4 text-muted-foreground" />
          <span>{item.production.volumeLiters.toFixed(2)} L</span>
        </div>
      ),
      sortable: true,
      className: "w-32",
      align: "left",
    },
    {
      key: "createdAt",
      header: "DATA",
      accessor: (item) => (
        <div className="flex items-center gap-1">
          <IconCalendar className="h-4 w-4 text-muted-foreground" />
          <span>{formatDate(item.production.createdAt)}</span>
        </div>
      ),
      sortable: true,
      className: "w-40",
      align: "left",
    },
  ];
};

export function PaintProductionHistoryCard({ paint, className }: PaintProductionHistoryCardProps) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [displaySearchText, setDisplaySearchText] = useState("");

  // Table state management
  const { sortConfigs, toggleSort, getSortDirection, getSortOrder } = useTableState({
    defaultPageSize: 20,
    resetSelectionOnPageChange: false,
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Column visibility
  const { visibleColumns, setVisibleColumns } = useColumnVisibility("paint-production-history-visible-columns", getDefaultVisibleColumns());

  // Get scrollbar width info
  const { width: scrollbarWidth, isOverlay } = useScrollbarWidth();

  // Get all paint production records from formulas
  const productionItems = useMemo(() => {
    const items: Array<{ production: PaintProduction; formulaDescription: string }> = [];

    if (paint.formulas) {
      paint.formulas.forEach((formula) => {
        if (formula.paintProduction) {
          formula.paintProduction.forEach((production) => {
            items.push({
              production,
              formulaDescription: formula.description,
            });
          });
        }
      });
    }

    return items;
  }, [paint.formulas]);

  // Filter by search term
  const filteredItems = useMemo(() => {
    if (!searchTerm) return productionItems;

    const search = searchTerm.toLowerCase();
    return productionItems.filter((item) => {
      const formulaDesc = item.formulaDescription.toLowerCase();
      const volume = item.production.volumeLiters.toString();
      const date = formatDate(item.production.createdAt).toLowerCase();

      return formulaDesc.includes(search) || volume.includes(search) || date.includes(search);
    });
  }, [productionItems, searchTerm]);

  // Sort items
  const sortedItems = useMemo(() => {
    if (sortConfigs.length === 0) {
      return [...filteredItems].sort((a, b) => new Date(b.production.createdAt).getTime() - new Date(a.production.createdAt).getTime());
    }

    return [...filteredItems].sort((a, b) => {
      for (const config of sortConfigs) {
        let comparison = 0;
        const { column, direction } = config;

        switch (column) {
          case "volumeLiters":
            comparison = a.production.volumeLiters - b.production.volumeLiters;
            break;
          case "createdAt":
            comparison = new Date(a.production.createdAt).getTime() - new Date(b.production.createdAt).getTime();
            break;
        }

        if (comparison !== 0) {
          return direction === "desc" ? -comparison : comparison;
        }
      }
      return 0;
    });
  }, [filteredItems, sortConfigs]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = productionItems.length;
    const totalVolume = productionItems.reduce((sum, item) => sum + item.production.volumeLiters, 0);
    const lastProduction = productionItems.length > 0 ? productionItems[0].production.createdAt : null;
    return { total, totalVolume, lastProduction };
  }, [productionItems]);

  // Paginate items
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return sortedItems.slice(startIndex, endIndex);
  }, [sortedItems, currentPage, pageSize]);

  // Calculate total pages
  const totalPages = Math.ceil(sortedItems.length / pageSize);

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Handle page size change
  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  // Handle search with debounce
  const handleSearchChange = (value: string) => {
    setDisplaySearchText(value);
    const timeoutId = setTimeout(() => {
      setSearchTerm(value);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timeoutId);
  };

  // Define columns
  const allColumns: ProductionColumn[] = createProductionColumns();
  const filteredVisibleColumns = allColumns.filter((col) => visibleColumns.has(col.key));

  // Render sort indicator
  const renderSortIndicator = (columnKey: string) => {
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

  // Handle row click
  const handleViewProduction = (production: PaintProduction) => {
    navigate(routes.painting.productions.details(production.id));
  };

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)} level={1}>
      <CardHeader className="pb-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-primary/10">
              <IconPaint className="h-5 w-5 text-primary" />
            </div>
            Histórico de Produção
          </CardTitle>
          {stats.total > 0 && (
            <Button variant="outline" size="sm" onClick={() => navigate(routes.painting.productions.root)}>
              Ver todas as produções
            </Button>
          )}
        </div>

        {/* Statistics */}
        {stats.total > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
            <div className="bg-card-nested rounded-lg p-3 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Total de Produções</p>
              <p className="text-lg font-semibold text-purple-600 dark:text-purple-400">{stats.total}</p>
            </div>
            <div className="bg-card-nested rounded-lg p-3 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Volume Total</p>
              <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">{stats.totalVolume.toFixed(2)}L</p>
            </div>
            <div className="bg-card-nested rounded-lg p-3 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Última Produção</p>
              <p className="text-lg font-semibold text-green-600 dark:text-green-400">{stats.lastProduction ? formatDate(stats.lastProduction) : "N/A"}</p>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0 flex-1 flex flex-col overflow-hidden">
        {productionItems.length === 0 ? (
          <div className="text-center py-12">
            <IconFlask className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-2">Nenhuma produção registrada</p>
            <p className="text-sm text-muted-foreground">As produções desta tinta aparecerão aqui quando forem realizadas</p>
          </div>
        ) : (
          <>
            {/* Search and Column Controls */}
            <div className="flex items-center gap-3 mb-4">
              <TableSearchInput
                value={displaySearchText}
                onChange={handleSearchChange}
                placeholder="Buscar por fórmula, volume ou data..."
                isPending={displaySearchText !== searchTerm}
              />
              <ColumnVisibilityManager columns={allColumns} visibleColumns={visibleColumns} onVisibilityChange={setVisibleColumns} />
            </div>

            {/* Table Container */}
            <div className="flex-1 flex flex-col overflow-hidden rounded-lg" style={{ minHeight: "400px", maxHeight: "600px" }}>
              {/* Fixed Header */}
              <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden">
                <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
                  <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
                    <TableRow className="bg-muted hover:bg-muted even:bg-muted">
                      {filteredVisibleColumns.map((column) => (
                        <TableHead key={column.key} className={cn("whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0", column.className)}>
                          {column.sortable ? (
                            <button
                              onClick={() => toggleSort(column.key)}
                              className={cn(
                                "flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent",
                                column.align === "center" && "justify-center",
                                column.align === "right" && "justify-end",
                                !column.align && "justify-start"
                              )}
                            >
                              <TruncatedTextWithTooltip text={column.header} />
                              {renderSortIndicator(column.key)}
                            </button>
                          ) : (
                            <div
                              className={cn(
                                "flex items-center h-full min-h-[2.5rem] px-4 py-2",
                                column.align === "center" && "justify-center text-center",
                                column.align === "right" && "justify-end text-right",
                                !column.align && "justify-start text-left"
                              )}
                            >
                              <TruncatedTextWithTooltip text={column.header} />
                            </div>
                          )}
                        </TableHead>
                      ))}
                      {!isOverlay && <TableHead style={{ width: `${scrollbarWidth}px`, minWidth: `${scrollbarWidth}px` }} className="bg-muted p-0 border-0 !border-r-0 shrink-0"></TableHead>}
                    </TableRow>
                  </TableHeader>
                </Table>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden border-l border-r border-border">
                <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
                  <TableBody>
                    {paginatedItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={filteredVisibleColumns.length} className="p-0">
                          <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                            <IconFlask className="h-12 w-12 text-muted-foreground/50 mb-4" />
                            <div className="text-lg font-medium mb-2">Nenhuma produção encontrada</div>
                            {searchTerm && <div className="text-sm">Ajuste a busca para ver mais resultados.</div>}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedItems.map((item, index) => (
                        <TableRow
                          key={item.production.id}
                          className={cn(
                            "cursor-pointer transition-colors border-b border-border",
                            index % 2 === 1 && "bg-muted/10",
                            "hover:bg-muted/20"
                          )}
                          onClick={() => handleViewProduction(item.production)}
                        >
                          {filteredVisibleColumns.map((column) => (
                            <TableCell
                              key={column.key}
                              className={cn(
                                column.className,
                                "p-0 !border-r-0",
                                column.align === "center" && "text-center",
                                column.align === "right" && "text-right",
                                column.align === "left" && "text-left",
                                !column.align && "text-left"
                              )}
                            >
                              <div className="px-4 py-2">{column.accessor(item)}</div>
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Footer */}
              <div className="px-4 border-l border-r border-b border-border rounded-b-lg bg-muted/50">
                <SimplePaginationAdvanced
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                  pageSize={pageSize}
                  totalItems={sortedItems.length}
                  pageSizeOptions={[10, 20, 40, 60]}
                  onPageSizeChange={handlePageSizeChange}
                  showPageSizeSelector={true}
                  showGoToPage={true}
                  showPageInfo={true}
                />
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
