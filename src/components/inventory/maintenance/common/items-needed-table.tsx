import React from "react";
import { useNavigate } from "react-router-dom";
import type { Item } from "../../../../types";
import { routes } from "../../../../constants";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { IconChevronUp, IconChevronDown, IconSelector, IconAlertTriangle, IconPackage } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { useItems } from "../../../../hooks";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { useScrollbarWidth } from "@/hooks/use-scrollbar-width";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { createItemsNeededColumns } from "./items-needed-columns";
import type { ItemNeededColumn } from "./items-needed-columns";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/use-table-state";

interface ItemConfig {
  itemId: string;
  quantity: number;
}

interface ItemsNeededTableProps {
  itemsConfig: ItemConfig[];
  visibleColumns: Set<string>;
  className?: string;
  filters?: { searchingFor?: string };
  onDataChange?: (data: { items: Item[]; totalRecords: number }) => void;
}

export function ItemsNeededTable({ itemsConfig, visibleColumns, className, filters = {}, onDataChange }: ItemsNeededTableProps) {
  const navigate = useNavigate();

  // Get scrollbar width info
  const { width: scrollbarWidth, isOverlay } = useScrollbarWidth();

  // Use URL state management for pagination and sorting
  const { page, pageSize, sortConfigs, setPage, setPageSize, toggleSort } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // Extract item IDs from config
  const itemIds = React.useMemo(() => {
    return itemsConfig.map((config) => config.itemId).filter(Boolean);
  }, [itemsConfig]);

  // Create map of item configs for quick lookup
  const itemConfigMap = React.useMemo(() => {
    return new Map(itemsConfig.map((config) => [config.itemId, config.quantity]));
  }, [itemsConfig]);

  // Memoize include configuration
  const includeConfig = React.useMemo(
    () => ({
      brand: true,
      category: true,
      measures: true,
      prices: {
        orderBy: { createdAt: "desc" as const },
        take: 1,
      },
    }),
    []
  );

  // Build query parameters
  const queryParams = React.useMemo(() => {
    const params: any = {
      where: {
        id: { in: itemIds },
        ...(filters.searchingFor && {
          OR: [
            { name: { contains: filters.searchingFor, mode: "insensitive" } },
            { uniCode: { contains: filters.searchingFor, mode: "insensitive" } },
            { brand: { is: { name: { contains: filters.searchingFor, mode: "insensitive" } } } },
            { category: { is: { name: { contains: filters.searchingFor, mode: "insensitive" } } } },
          ],
        }),
      },
      page: page + 1,
      limit: pageSize,
      include: includeConfig,
      ...(sortConfigs.length > 0 && {
        orderBy: convertSortConfigsToOrderBy(sortConfigs),
      }),
    };

    return params;
  }, [itemIds, filters.searchingFor, page, pageSize, includeConfig, sortConfigs]);

  // Fetch items
  const { data: response, isLoading, error } = useItems(queryParams);

  const rawItems = response?.data || [];
  const totalPages = response?.meta ? Math.ceil(response.meta.totalRecords / pageSize) : 1;
  const totalRecords = response?.meta?.totalRecords || 0;

  // Enrich items with needed quantity and subtotal
  const items = React.useMemo(() => {
    return rawItems.map((item) => {
      const neededQuantity = itemConfigMap.get(item.id) || 0;
      const price = item.prices?.[0]?.value || 0;
      const subtotal = neededQuantity * price;

      return {
        ...item,
        neededQuantity,
        subtotal,
      };
    });
  }, [rawItems, itemConfigMap]);

  // Notify parent of data changes
  const lastNotifiedDataRef = React.useRef<string>("");
  React.useEffect(() => {
    if (onDataChange) {
      const dataKey = items.length > 0 ? `${totalRecords}-${items.map((item) => item.id).join(",")}` : `empty-${totalRecords}`;

      if (dataKey !== lastNotifiedDataRef.current) {
        lastNotifiedDataRef.current = dataKey;
        onDataChange({ items, totalRecords });
      }
    }
  }, [items, totalRecords, onDataChange]);

  // Define all available columns
  const allColumns: ItemNeededColumn[] = createItemsNeededColumns();

  // Filter visible columns
  const columns = React.useMemo(() => allColumns.filter((col) => visibleColumns.has(col.key)), [allColumns, visibleColumns]);

  const renderSortIndicator = (columnKey: string) => {
    const currentSort = sortConfigs.find((s) => s.column === columnKey);

    return (
      <div className="inline-flex items-center ml-1">
        {!currentSort && <IconSelector className="h-4 w-4 text-muted-foreground" />}
        {currentSort?.direction === "asc" && <IconChevronUp className="h-4 w-4 text-foreground" />}
        {currentSort?.direction === "desc" && <IconChevronDown className="h-4 w-4 text-foreground" />}
        {currentSort && sortConfigs.length > 1 && <span className="text-xs ml-0.5">{sortConfigs.findIndex((s) => s.column === columnKey) + 1}</span>}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Carregando itens...</div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg flex flex-col min-h-[400px] max-h-[800px]", className)}>
      {/* Fixed Header Table */}
      <div className="border-l border-r border-t border-border rounded-t-lg flex-shrink-0">
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
            <TableRow className="bg-muted hover:bg-muted even:bg-muted">
              {columns.map((column) => (
                <TableHead key={column.key} className={cn("whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0", column.className)}>
                  {column.sortable ? (
                    <button onClick={() => toggleSort(column.key)} className="flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent" disabled={isLoading || items.length === 0}>
                      <TruncatedTextWithTooltip text={column.header} />
                      {renderSortIndicator(column.key)}
                    </button>
                  ) : (
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <TruncatedTextWithTooltip text={column.header} />
                    </div>
                  )}
                </TableHead>
              ))}

              {/* Scrollbar spacer */}
              {!isOverlay && <TableHead style={{ width: `${scrollbarWidth}px`, minWidth: `${scrollbarWidth}px` }} className="bg-muted p-0 border-0 !border-r-0 shrink-0"></TableHead>}
            </TableRow>
          </TableHeader>
        </Table>
      </div>

      {/* Scrollable Body Table */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden border-l border-r border-border">
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableBody>
            {error ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-destructive">
                    <IconAlertTriangle className="h-8 w-8 mb-4" />
                    <div className="text-lg font-medium mb-2">Não foi possível carregar os itens</div>
                    <div className="text-sm text-muted-foreground">Tente novamente mais tarde.</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <IconPackage className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <div className="text-lg font-medium mb-2">Nenhum item encontrado</div>
                    {filters.searchingFor ? <div className="text-sm">Ajuste a busca para ver mais resultados.</div> : <div className="text-sm">Nenhum item configurado.</div>}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, index) => (
                <TableRow
                  key={item.id}
                  className={cn("cursor-pointer transition-colors border-b border-border", index % 2 === 1 && "bg-muted/10", "hover:bg-muted/20")}
                  onClick={() => navigate(routes.inventory.products.details(item.id))}
                >
                  {columns.map((column) => (
                    <TableCell key={column.key} className={cn(column.className, "p-0 !border-r-0")}>
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
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          pageSize={pageSize}
          totalItems={totalRecords}
          pageSizeOptions={[20, 40, 60, 100]}
          onPageSizeChange={setPageSize}
          showPageSizeSelector={true}
          showGoToPage={true}
          showPageInfo={true}
        />
      </div>
    </div>
  );
}
