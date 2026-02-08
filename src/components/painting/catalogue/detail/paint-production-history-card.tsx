import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { IconPaint, IconFlask, IconChevronDown, IconChevronUp, IconSelector } from "@tabler/icons-react";
import type { Paint, PaintProduction } from "../../../../types";
import { formatDate } from "../../../../utils";
import { cn } from "@/lib/utils";
import { useTableState } from "@/hooks/common/use-table-state";
import { useColumnVisibility } from "@/hooks/common/use-column-visibility";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { useScrollbarWidth } from "@/hooks/common/use-scrollbar-width";
import { routes } from "../../../../constants";
import { createPaintProductionColumns, getDefaultVisibleColumns } from "@/components/painting/production/list/paint-production-table-columns";
import type { PaintProductionColumn } from "@/components/painting/production/list/paint-production-table-columns";
import { ColumnVisibilityManager } from "@/components/painting/production/list/column-visibility-manager";

interface PaintProductionHistoryCardProps {
  paint: Paint;
  className?: string;
}

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
    const items: PaintProduction[] = [];

    if (paint.formulas) {
      paint.formulas.forEach((formula) => {
        if (formula.paintProduction) {
          formula.paintProduction.forEach((production) => {
            // Attach the formula relation and parent paint to the production object
            items.push({
              ...production,
              formula: {
                ...formula,
                paint: paint, // Use the parent paint data with full relations
              },
            });
          });
        }
      });
    }

    return items;
  }, [paint]);

  // Filter by search term
  const filteredItems = useMemo(() => {
    if (!searchTerm) return productionItems;

    const search = searchTerm.toLowerCase();
    return productionItems.filter((production) => {
      const formulaDesc = production.formula?.description?.toLowerCase() || "";
      const paintName = production.formula?.paint?.name?.toLowerCase() || "";
      const volume = production.volumeLiters.toString();
      const date = formatDate(production.createdAt).toLowerCase();

      return formulaDesc.includes(search) || paintName.includes(search) || volume.includes(search) || date.includes(search);
    });
  }, [productionItems, searchTerm]);

  // Sort items
  const sortedItems = useMemo(() => {
    if (sortConfigs.length === 0) {
      return [...filteredItems].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return [...filteredItems].sort((a, b) => {
      for (const config of sortConfigs) {
        let comparison = 0;
        const { column, direction } = config;

        switch (column) {
          case "volumeLiters":
            comparison = a.volumeLiters - b.volumeLiters;
            break;
          case "createdAt":
            comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            break;
          case "formula.paint.name":
            comparison = (a.formula?.paint?.name || "").localeCompare(b.formula?.paint?.name || "");
            break;
        }

        if (comparison !== 0) {
          return direction === "desc" ? -comparison : comparison;
        }
      }
      return 0;
    });
  }, [filteredItems, sortConfigs]);

  // Paginate items
  const paginatedItems = useMemo(() => {
    // Ensure currentPage is at least 1 to prevent negative indexes
    const safePage = Math.max(1, currentPage);
    const startIndex = (safePage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return sortedItems.slice(startIndex, endIndex);
  }, [sortedItems, currentPage, pageSize]);

  // Calculate total pages
  const totalPages = Math.ceil(sortedItems.length / pageSize);

  // Auto-correct current page if out of bounds
  React.useEffect(() => {
    if (sortedItems.length > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    } else if (currentPage < 1) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages, sortedItems.length]);

  // Handle page change
  const handlePageChange = (page: number) => {
    // Ensure page is at least 1
    setCurrentPage(Math.max(1, page));
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
  const allColumns: PaintProductionColumn[] = createPaintProductionColumns();
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
    <Card className={cn("flex flex-col overflow-hidden", className)}>
      <CardHeader className="flex-shrink-0">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconPaint className="h-5 w-5" />
            Histórico de Produção
          </div>
          {productionItems.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => navigate(routes.painting.productions.root)}>
              Ver todas as produções
            </Button>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col space-y-4 p-4">
        {/* Search and Column Controls */}
        <div className="flex flex-col gap-3 sm:flex-row flex-shrink-0">
          <TableSearchInput
            value={displaySearchText}
            onChange={handleSearchChange}
            placeholder="Buscar por tinta, fórmula, volume ou data..."
            isPending={displaySearchText !== searchTerm}
          />
          <div className="flex gap-2">
            <ColumnVisibilityManager columns={allColumns} visibleColumns={visibleColumns} onVisibilityChange={setVisibleColumns} />
          </div>
        </div>

        {/* Table - Full width with min/max height */}
        <div className="flex-1 min-h-0">
          <div className="flex flex-col overflow-hidden rounded-lg h-full">
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
                          {searchTerm ? (
                            <div className="text-sm">Ajuste a busca para ver mais resultados.</div>
                          ) : (
                            <div className="text-sm">As produções desta tinta aparecerão aqui quando forem realizadas</div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedItems.map((production, index) => (
                      <TableRow
                        key={production.id}
                        className={cn(
                          "cursor-pointer transition-colors border-b border-border",
                          index % 2 === 1 && "bg-muted/10",
                          "hover:bg-muted/20"
                        )}
                        onClick={() => handleViewProduction(production)}
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
                            <div className="px-4 py-2">{column.accessor(production)}</div>
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
        </div>
      </CardContent>
    </Card>
  );
}
