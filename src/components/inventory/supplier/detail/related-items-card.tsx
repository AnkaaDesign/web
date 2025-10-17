import React, { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconPackage, IconAlertCircle, IconChevronUp, IconChevronDown, IconSelector, IconColumns } from "@tabler/icons-react";
import type { Item } from "../../../../types";
import { formatCurrency, determineStockLevel, getStockLevelTextColor } from "../../../../utils";
import { STOCK_LEVEL_LABELS, ORDER_STATUS, routes } from "../../../../constants";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { Checkbox } from "@/components/ui/checkbox";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { Skeleton } from "@/components/ui/skeleton";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { ColumnVisibilityManager } from "../../item/list/column-visibility-manager";
import { createItemColumns } from "../../item/list/item-table-columns";

interface RelatedItemsCardProps {
  items?: Item[];
  supplierId?: string;
  className?: string;
}

const DEFAULT_PAGE_SIZE = 20;

export function RelatedItemsCard({ items, supplierId, className }: RelatedItemsCardProps) {
  const navigate = useNavigate();
  const safeItems = items || [];

  // Local state for search, pagination, and sorting
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Column visibility with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility(
    "supplier-items-visible-columns",
    new Set(["uniCode", "name", "brand.name", "category.name", "quantity", "price"])
  );

  // Get all available columns for column visibility manager
  const allColumns = useMemo(() => createItemColumns(), []);

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!searchText.trim()) return safeItems;

    const searchLower = searchText.toLowerCase();
    return safeItems.filter((item) => {
      return (
        item.name?.toLowerCase().includes(searchLower) ||
        item.uniCode?.toLowerCase().includes(searchLower) ||
        item.barCode?.toLowerCase().includes(searchLower) ||
        item.brand?.name?.toLowerCase().includes(searchLower) ||
        item.category?.name?.toLowerCase().includes(searchLower)
      );
    });
  }, [safeItems, searchText]);

  // Sort items
  const sortedItems = useMemo(() => {
    if (!sortConfig) return filteredItems;

    return [...filteredItems].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      // Handle nested properties
      if (sortConfig.key.includes(".")) {
        const keys = sortConfig.key.split(".");
        aValue = keys.reduce((obj, key) => obj?.[key], a as any);
        bValue = keys.reduce((obj, key) => obj?.[key], b as any);
      } else {
        aValue = (a as any)[sortConfig.key];
        bValue = (b as any)[sortConfig.key];
      }

      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      // Compare values
      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortConfig.direction === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }

      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredItems, sortConfig]);

  // Paginate items
  const paginatedItems = useMemo(() => {
    const start = page * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [sortedItems, page, pageSize]);

  const totalPages = Math.ceil(sortedItems.length / pageSize);

  // Handle sort
  const handleSort = (key: string) => {
    setSortConfig((current) => {
      if (!current || current.key !== key) {
        return { key, direction: "asc" };
      }
      if (current.direction === "asc") {
        return { key, direction: "desc" };
      }
      return null;
    });
  };

  // Handle selection
  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedItems.map((item) => item.id)));
    }
  };

  const isAllSelected = paginatedItems.length > 0 && selectedIds.size === paginatedItems.length;
  const isPartiallySelected = selectedIds.size > 0 && selectedIds.size < paginatedItems.length;

  // Render sort icon
  const renderSortIcon = (columnKey: string) => {
    if (!sortConfig || sortConfig.key !== columnKey) {
      return <IconSelector className="h-3 w-3 text-muted-foreground" />;
    }
    return sortConfig.direction === "asc" ? <IconChevronUp className="h-3 w-3" /> : <IconChevronDown className="h-3 w-3" />;
  };

  // Get cell content based on column
  const getCellContent = (item: Item, columnKey: string) => {
    const column = allColumns.find((col) => col.key === columnKey);
    if (!column) return null;

    return column.accessor(item);
  };

  // Filter visible columns
  const displayColumns = allColumns.filter((col) => visibleColumns.has(col.key));

  if (safeItems.length === 0) {
    return (
      <Card className={cn("shadow-sm border border-border w-full", className)} level={1}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 rounded-lg bg-primary/10">
                <IconPackage className="h-5 w-5 text-primary" />
              </div>
              Produtos Relacionados
            </CardTitle>
            {supplierId && (
              <Button variant="outline" size="sm" onClick={() => navigate(`${routes.inventory.products.list}?suppliers=${supplierId}`)}>
                Ver todos os itens
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-center py-12">
            <IconAlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum produto associado a este fornecedor.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("shadow-sm border border-border w-full", className)} level={1}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-primary/10">
              <IconPackage className="h-5 w-5 text-primary" />
            </div>
            Produtos Relacionados
          </CardTitle>
          {supplierId && (
            <Button variant="outline" size="sm" onClick={() => navigate(`${routes.inventory.products.list}?suppliers=${supplierId}`)}>
              Ver todos os itens
            </Button>
          )}
        </div>
      </CardHeader>

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

        {/* Table Container matching ItemTable design exactly */}
        <div className="rounded-lg flex flex-col overflow-hidden" style={{ minHeight: "400px", maxHeight: "600px" }}>
          {/* Fixed Header Table */}
          <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden">
            <Table className="w-full">
              <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
                <TableRow className="bg-muted hover:bg-muted even:bg-muted">
                  <TableHead className="w-12 whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0">
                    <div className="flex items-center justify-center h-full w-full px-2">
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={toggleSelectAll}
                        indeterminate={isPartiallySelected}
                        aria-label="Select all items"
                      />
                    </div>
                  </TableHead>
                  {displayColumns.map((column) => (
                    <TableHead
                      key={column.key}
                      className={cn(
                        "whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0",
                        column.className
                      )}
                    >
                      {column.sortable !== false ? (
                        <button
                          onClick={() => handleSort(column.key)}
                          className={cn(
                            "flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent",
                            column.align === "center" && "justify-center",
                            column.align === "right" && "justify-end",
                            !column.align && "justify-start",
                          )}
                        >
                          <span>{column.header}</span>
                          {renderSortIcon(column.key)}
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
                          <span>{column.header}</span>
                        </div>
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
            </Table>
          </div>

          {/* Scrollable Body Table */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden border-l border-r border-border">
            <Table className="w-full">
              <TableBody>
                {paginatedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={displayColumns.length + 1} className="text-center py-12">
                      <IconAlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">Nenhum item encontrado</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedItems.map((item, index) => {
                    const itemIsSelected = selectedIds.has(item.id);
                    return (
                      <TableRow
                        key={item.id}
                        data-state={itemIsSelected ? "selected" : undefined}
                        className={cn(
                          "cursor-pointer transition-colors border-b border-border",
                          index % 2 === 1 && "bg-muted/10",
                          "hover:bg-muted/20",
                          itemIsSelected && "bg-muted/30 hover:bg-muted/40"
                        )}
                        onClick={() => navigate(routes.inventory.products.details(item.id))}
                      >
                        <TableCell className="p-0 !border-r-0">
                          <div className="flex items-center justify-center h-full w-full px-2 py-2" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={itemIsSelected}
                              onCheckedChange={() => toggleSelection(item.id)}
                              aria-label={`Select ${item.name}`}
                              data-checkbox
                            />
                          </div>
                        </TableCell>
                        {displayColumns.map((column) => (
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
                          >
                            <div className="px-4 py-2">{getCellContent(item, column.key)}</div>
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Footer - matching ItemTable exactly */}
          <div className="px-4 border-l border-r border-b border-border rounded-b-lg bg-muted/50">
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
