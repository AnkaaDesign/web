import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Item } from "../../../../types";
import { routes } from "../../../../constants";
import { useAuth } from "../../../../hooks/useAuth";
import { canEditItems, canDeleteItems, shouldShowInteractiveElements } from "@/utils/permissions/entity-permissions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { IconChevronUp, IconChevronDown, IconCheck, IconX, IconAlertTriangle, IconEdit, IconTrash, IconSelector, IconPercentage, IconPackage, IconPlus, IconGitMerge, IconClipboardCheck } from "@tabler/icons-react";
import { ItemListSkeleton } from "./item-list-skeleton";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useItemMutations, useItemBatchMutations, useItems } from "../../../../hooks";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import type { ItemGetManyFormData } from "../../../../schemas";
import { useScrollbarWidth } from "@/hooks/use-scrollbar-width";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { createItemColumns } from "./item-table-columns";
import type { ItemColumn } from "./types";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/use-table-state";
import { PriceAdjustmentModal } from "../modals/price-adjustment-modal";

interface ItemTableProps {
  visibleColumns: Set<string>;
  className?: string;
  onEdit?: (items: Item[]) => void;
  onActivate?: (items: Item[]) => void;
  onDeactivate?: (items: Item[]) => void;
  onDelete?: (items: Item[]) => void;
  onMerge?: (items: Item[]) => void;
  onStockBalance?: (items: Item[]) => void;
  filters?: Partial<ItemGetManyFormData>;
  onDataChange?: (data: { items: Item[]; totalRecords: number }) => void;
}

export function ItemTable({ visibleColumns, className, onEdit, onActivate, onDeactivate, onDelete, onMerge, onStockBalance, filters = {}, onDataChange }: ItemTableProps) {
  const navigate = useNavigate();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { delete: deleteItem } = useItemMutations();
  const { batchDelete } = useItemBatchMutations();

  // Permission checks
  const canEdit = user ? canEditItems(user) : false;
  const canDelete = user ? canDeleteItems(user) : false;
  const showInteractive = user ? shouldShowInteractiveElements(user, 'item') : false;

  // Get scrollbar width info
  const { width: scrollbarWidth, isOverlay } = useScrollbarWidth();

  // Use URL state management for pagination and selection
  const {
    page,
    pageSize,
    selectedIds,
    sortConfigs,
    showSelectedOnly,
    setPage,
    setPageSize,
    toggleSelection,
    toggleSelectAll,
    toggleSort,
    getSortDirection,
    getSortOrder,
    isSelected,
    isAllSelected,
    isPartiallySelected,
    selectionCount,
    resetSelection,
    removeFromSelection,
    handleRowClick: handleRowClickSelection,
  } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // Memoize include configuration to prevent re-renders
  const includeConfig = React.useMemo(
    () => ({
      brand: true,
      category: true,
      supplier: true,
      measures: true,
      prices: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      orderItems: {
        include: {
          order: {
            select: {
              status: true,
            },
          },
        },
      },
      _count: {
        select: {
          activities: true,
          borrows: true,
          orderItems: true,
          prices: true,
          measures: true,
          relatedItems: true,
          relatedTo: true,
        },
      },
    }),
    [],
  );

  // Create a stable representation of query parameters using a ref to prevent infinite re-renders
  const queryParamsRef = React.useRef<any>({});
  const queryParamsStringRef = React.useRef("");

  // Memoize query parameters with content-based comparison
  const queryParams = React.useMemo(() => {
    // Build params object
    const params = {
      // When showSelectedOnly is true, don't apply filters
      ...(showSelectedOnly ? {} : filters),
      page: page + 1, // Convert 0-based to 1-based for API
      limit: pageSize,
      include: includeConfig,
      // Convert sortConfigs to orderBy format for API
      ...(sortConfigs.length > 0 && {
        orderBy: convertSortConfigsToOrderBy(sortConfigs),
      }),
      // When showSelectedOnly is true, only show selected items
      ...(showSelectedOnly &&
        selectedIds.length > 0 && {
          where: {
            id: { in: selectedIds },
          },
        }),
    };

    // Only update the ref if the content actually changed
    const currentParamsString = JSON.stringify(params);
    if (currentParamsString !== queryParamsStringRef.current) {
      console.log("[ItemTable] QueryParams content changed, updating ref");
      queryParamsStringRef.current = currentParamsString;
      queryParamsRef.current = params;
    }

    return queryParamsRef.current;
  }, [filters, page, pageSize, includeConfig, sortConfigs, showSelectedOnly, selectedIds]);

  // Use the items hook with memoized parameters
  const { data: response, isLoading, error } = useItems(queryParams);

  const items = response?.data || [];
  const totalPages = response?.meta ? Math.ceil(response.meta.totalRecords / pageSize) : 1;
  const totalRecords = response?.meta?.totalRecords || 0;

  // Notify parent component of data changes
  // Use a ref to track if we've already notified for this exact data
  const lastNotifiedDataRef = React.useRef<string>("");
  const isMountedRef = React.useRef(true);

  React.useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    if (onDataChange && isMountedRef.current) {
      // Create a unique key for the current data to detect real changes
      const dataKey = items.length > 0 ? `${totalRecords}-${items.map((item) => item.id).join(",")}` : `empty-${totalRecords}`;

      // Only notify if this exact data hasn't been notified yet
      if (dataKey !== lastNotifiedDataRef.current) {
        lastNotifiedDataRef.current = dataKey;
        onDataChange({ items, totalRecords });
      }
    }
  }, [items, totalRecords, onDataChange]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    items: Item[];
    isBulk: boolean;
  } | null>(null);

  // Price adjustment modal state
  const [priceAdjustmentModal, setPriceAdjustmentModal] = useState<{
    open: boolean;
    items: Item[];
  }>({
    open: false,
    items: [],
  });

  // Define all available columns
  const allColumns: ItemColumn[] = createItemColumns();

  /* Original columns array replaced by createItemColumns() - keeping for reference
  const originalColumns: ItemColumn[] = [
    {
      key: "uniCode",
      header: "Código",
      accessor: (item: Item) => <div className="font-mono text-sm truncate">{item.uniCode || "-"}</div>,
      sortable: true,
      className: TABLE_LAYOUT.firstDataColumn.className,
      align: "left",
    },
    {
      key: "name",
      header: "Nome",
      accessor: (item: Item) => <div className="font-medium truncate">{item.name}</div>,
      sortable: true,
      className: "w-64",
      align: "left",
    },
    {
      key: "brand.name",
      header: "Marca",
      accessor: (item: Item) => <div className="truncate">{item.brand?.name || "-"}</div>,
      sortable: true,
      className: "w-32",
      align: "left",
    },
    {
      key: "abcxyz",
      header: "ABC/XYZ",
      accessor: (item: Item) => (
        <div className="flex">
          <AbcXyzBadge item={item} showBoth={true} size="sm" />
        </div>
      ),
      sortable: false,
      className: "w-24",
      align: "left",
    },
    {
      key: "quantity",
      header: "Quantidade",
      accessor: (item: Item) => (
        <div className="flex">
          <StockStatusIndicator item={item} showQuantity={true} />
        </div>
      ),
      sortable: true,
      className: "w-28",
      align: "left",
    },
    {
      key: "monthlyConsumption",
      header: "Consumo Mensal",
      accessor: (item: Item) => renderMonthlyConsumptionWithTrend(item),
      sortable: true,
      className: "w-32", // Slightly wider to accommodate trend
      align: "left",
    },
    {
      key: "price",
      header: "Preço",
      accessor: (item: Item) => <div className="font-medium truncate">{item.prices?.[0]?.value ? formatCurrency(item.prices[0].value) : "-"}</div>,
      sortable: true,
      className: "w-28",
      align: "left",
    },
    {
      key: "totalPrice",
      header: "Valor Total",
      accessor: (item: Item) => <div className="font-semibold truncate">{item.totalPrice ? formatCurrency(item.totalPrice) : "-"}</div>,
      sortable: true,
      className: "w-28",
      align: "left",
    },
    {
      key: "CA",
      header: "CA",
      accessor: (item: Item) => <div className="font-mono text-sm truncate">{item.ppeCA || "-"}</div>,
      sortable: true,
      className: "w-28",
      align: "left",
    },
    {
      key: "barcodes",
      header: "Códigos de Barras",
      accessor: (item: Item) => <div className="font-mono text-xs truncate">{item.barcodes?.length > 0 ? item.barcodes.join(", ") : "-"}</div>,
      sortable: false,
      className: "w-48",
      align: "left",
    },
    {
      key: "maxQuantity",
      header: "Qtd. Máxima",
      accessor: (item: Item) => <div className="text-muted-foreground truncate">{item.maxQuantity ?? "-"}</div>,
      sortable: true,
      className: "w-28",
      align: "left",
    },
    {
      key: "reorderPoint",
      header: "Ponto de Reposição",
      accessor: (item: Item) => <div className="text-muted-foreground truncate">{item.reorderPoint ?? "-"}</div>,
      sortable: true,
      className: "w-28",
      align: "left",
    },
    {
      key: "reorderQuantity",
      header: "Qtd. de Reposição",
      accessor: (item: Item) => <div className="text-muted-foreground truncate">{item.reorderQuantity ?? "-"}</div>,
      sortable: true,
      className: "w-28",
      align: "left",
    },
    {
      key: "boxQuantity",
      header: "Qtd. por Caixa",
      accessor: (item: Item) => <div className="text-muted-foreground truncate">{item.boxQuantity ?? "-"}</div>,
      sortable: true,
      className: "w-28",
      align: "left",
    },
    {
      key: "icms",
      header: "ICMS",
      accessor: (item: Item) => <div className="text-muted-foreground truncate">{item.icms ? `${item.icms}%` : "-"}</div>,
      sortable: true,
      className: "w-20",
      align: "left",
    },
    {
      key: "ipi",
      header: "IPI",
      accessor: (item: Item) => <div className="text-muted-foreground truncate">{item.ipi ? `${item.ipi}%` : "-"}</div>,
      sortable: true,
      className: "w-20",
      align: "left",
    },
    {
      key: "category.name",
      header: "Categoria",
      accessor: (item: Item) => <div className="truncate">{item.category?.name || "-"}</div>,
      sortable: true,
      className: "w-40",
      align: "left",
    },
    {
      key: "measures",
      header: "Medidas",
      accessor: (item: Item) => (
        <MeasureDisplayCompact item={item} />
      ),
      sortable: false,
      className: "w-48",
      align: "left",
    },
    {
      key: "supplier.fantasyName",
      header: "Fornecedor",
      accessor: (item: Item) => <div>{item.supplier?.fantasyName || "-"}</div>,
      sortable: true,
      className: "w-40",
      align: "left",
    },
    {
      key: "ppeType",
      header: "Tipo EPI",
      accessor: (item: Item) => {
        const ppeType = item.ppeType;
        if (!ppeType) {
          return <div className="text-muted-foreground">-</div>;
        }
        return (
          <Badge variant="outline" className="text-xs">
            {PPE_TYPE_LABELS[ppeType] || ppeType}
          </Badge>
        );
      },
      sortable: false,
      className: "w-32",
      align: "left",
    },
    {
      key: "ppeSize",
      header: "Tamanho EPI",
      accessor: (item: Item) => {
        const ppeSize = item.ppeSize;
        if (!ppeSize) {
          return <div className="text-muted-foreground">-</div>;
        }
        return (
          <Badge variant="outline" className="text-xs">
            {PPE_SIZE_LABELS[ppeSize] || ppeSize.replace("SIZE_", "")}
          </Badge>
        );
      },
      sortable: false,
      className: "w-32",
      align: "left",
    },
    {
      key: "shouldAssignToUser",
      header: "Atribuir ao Usuário",
      accessor: (item: Item) => (
        <div className="flex">
          <Badge variant={item.shouldAssignToUser ? "default" : "secondary"}>{item.shouldAssignToUser ? "Sim" : "Não"}</Badge>
        </div>
      ),
      sortable: true,
      className: "w-32",
      align: "left",
    },
    {
      key: "estimatedLeadTime",
      header: "Prazo Estimado",
      accessor: (item: Item) => <div className="text-muted-foreground">{item.estimatedLeadTime ? `${item.estimatedLeadTime} dias` : "-"}</div>,
      sortable: true,
      className: "w-32",
      align: "left",
    },
    {
      key: "isActive",
      header: "Status",
      accessor: (item: Item) => (
        <div className="flex">
          <Badge variant={item.isActive ? "default" : "secondary"}>{item.isActive ? "Ativo" : "Inativo"}</Badge>
        </div>
      ),
      sortable: true,
      className: "w-20",
      align: "left",
    },
    {
      key: "createdAt",
      header: "Criado em",
      accessor: (item: Item) => <div className="text-sm text-muted-foreground">{new Date(item.createdAt).toLocaleDateString("pt-BR")}</div>,
      sortable: true,
      className: "w-32",
      align: "left",
    },
    {
      key: "updatedAt",
      header: "Atualizado em",
      accessor: (item: Item) => <div className="text-sm text-muted-foreground">{new Date(item.updatedAt).toLocaleDateString("pt-BR")}</div>,
      sortable: true,
      className: "w-32",
      align: "left",
    },
  ];
  */

  // Filter columns based on visibility
  const columns = allColumns.filter((col) => visibleColumns.has(col.key));

  // Get current page item IDs for selection
  const currentPageItemIds = React.useMemo(() => {
    return items.map((item) => item.id);
  }, [items]);

  // Selection handlers
  const allSelected = isAllSelected(currentPageItemIds);
  const partiallySelected = isPartiallySelected(currentPageItemIds);

  const handleSelectAll = () => {
    toggleSelectAll(currentPageItemIds);
  };

  const handleSelectItem = (itemId: string, event?: React.MouseEvent) => {
    handleRowClickSelection(itemId, currentPageItemIds, event?.shiftKey || false);
  };

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

  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent, item: Item) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if clicked item is part of selection
    const isItemSelected = isSelected(item.id);
    const hasSelection = selectionCount > 0;

    if (hasSelection && isItemSelected) {
      // Show bulk actions for all selected items
      const selectedItemsList = items.filter((i) => isSelected(i.id));
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        items: selectedItemsList,
        isBulk: true,
      });
    } else {
      // Show actions for just the clicked item
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        items: [item],
        isBulk: false,
      });
    }
  };

  const handleEdit = () => {
    if (contextMenu) {
      if (contextMenu.isBulk && contextMenu.items.length > 1) {
        // Bulk edit
        if (onEdit) {
          onEdit(contextMenu.items);
        } else {
        }
      } else {
        // Single edit
        navigate(routes.inventory.products.edit(contextMenu.items[0].id));
      }
      setContextMenu(null);
    }
  };

  const handleActivate = () => {
    if (contextMenu) {
      if (onActivate) {
        onActivate(contextMenu.items);
      } else {
      }
      setContextMenu(null);
    }
  };

  const handleDeactivate = () => {
    if (contextMenu) {
      if (onDeactivate) {
        onDeactivate(contextMenu.items);
      } else {
      }
      setContextMenu(null);
    }
  };

  const handlePriceAdjustment = () => {
    if (contextMenu) {
      setPriceAdjustmentModal({
        open: true,
        items: contextMenu.items,
      });
      setContextMenu(null);
    }
  };

  const handleDelete = () => {
    if (contextMenu && onDelete) {
      onDelete(contextMenu.items);
      setContextMenu(null);
    }
  };

  const handleMerge = () => {
    if (contextMenu && onMerge) {
      onMerge(contextMenu.items);
      setContextMenu(null);
    }
  };

  const handleStockBalance = () => {
    if (contextMenu && onStockBalance) {
      onStockBalance(contextMenu.items);
      setContextMenu(null);
    }
  };

  // Close context menu when clicking outside
  React.useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  // Pagination handlers are now handled by useTableState hook

  if (isLoading) {
    return <ItemListSkeleton />;
  }

  return (
    <div className={cn("rounded-lg flex flex-col overflow-hidden", className)}>
      {/* Fixed Header Table */}
      <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden">
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
            <TableRow className="bg-muted hover:bg-muted even:bg-muted">
              {/* Selection column */}
              {showInteractive && (
                <TableHead className={cn(TABLE_LAYOUT.checkbox.className, "whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0")}>
                  <div className="flex items-center justify-center h-full w-full px-2">
                    <Checkbox
                      checked={allSelected}
                    indeterminate={partiallySelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all items"
                    disabled={isLoading || items.length === 0}
                  />
                </div>
                </TableHead>
              )}

              {/* Data columns */}
              {columns.map((column) => (
                <TableHead key={column.key} className={cn("whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0", column.className)}>
                  {column.sortable ? (
                    <button
                      onClick={() => toggleSort(column.key)}
                      className={cn(
                        "flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent",
                        column.align === "center" && "justify-center",
                        column.align === "right" && "justify-end",
                        !column.align && "justify-start",
                      )}
                      disabled={isLoading || items.length === 0}
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
                        !column.align && "justify-start text-left",
                      )}
                    >
                      <TruncatedTextWithTooltip text={column.header} />
                    </div>
                  )}
                </TableHead>
              ))}

              {/* Scrollbar spacer - only show if not overlay scrollbar */}
              {!isOverlay && (
                <TableHead style={{ width: `${scrollbarWidth}px`, minWidth: `${scrollbarWidth}px` }} className="bg-muted p-0 border-0 !border-r-0 shrink-0"></TableHead>
              )}
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
                <TableCell colSpan={columns.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-destructive">
                    <IconAlertTriangle className="h-8 w-8 mb-4" />
                    <div className="text-lg font-medium mb-2">Não foi possível carregar os produtos</div>
                    <div className="text-sm text-muted-foreground">Tente novamente mais tarde.</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <IconPackage className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <div className="text-lg font-medium mb-2">Nenhum produto encontrado</div>
                    {filters && Object.keys(filters).length > 1 ? (
                      <div className="text-sm">Ajuste os filtros para ver mais resultados.</div>
                    ) : (
                      <>
                        <div className="text-sm mb-4">Comece cadastrando seu primeiro produto.</div>
                        <Button onClick={() => navigate(routes.inventory.products.create)} variant="outline">
                          <IconPlus className="h-4 w-4 mr-2" />
                          Cadastrar Produto
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, index) => {
                const itemIsSelected = isSelected(item.id);

                return (
                  <TableRow
                    key={item.id}
                    data-state={itemIsSelected ? "selected" : undefined}
                    className={cn(
                      "cursor-pointer transition-colors border-b border-border",
                      // Alternating row colors
                      index % 2 === 1 && "bg-muted/10",
                      // Hover state that works with alternating colors
                      "hover:bg-muted/20",
                      // Selected state overrides alternating colors
                      itemIsSelected && "bg-muted/30 hover:bg-muted/40",
                    )}
                    onClick={() => navigate(routes.inventory.products.details(item.id))}
                    onContextMenu={(e) => handleContextMenu(e, item)}
                  >
                    {/* Selection checkbox */}
                    {showInteractive && (
                      <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                        <div
                          className="flex items-center justify-center h-full w-full px-2 py-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectItem(item.id, e);
                          }}
                        >
                          <Checkbox checked={itemIsSelected} aria-label={`Select ${item.name}`} data-checkbox />
                        </div>
                      </TableCell>
                    )}

                    {/* Data columns */}
                    {columns.map((column) => (
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
                        <div className="px-4 py-2">{column.accessor(item)}</div>
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
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

      {/* Context Menu */}
      <DropdownMenu open={!!contextMenu} onOpenChange={(open) => !open && setContextMenu(null)}>
        <DropdownMenuContent
          style={{
            position: "fixed",
            left: contextMenu?.x,
            top: contextMenu?.y,
          }}
          className="w-56"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {contextMenu?.isBulk && <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">{contextMenu.items.length} itens selecionados</div>}

          {canEdit && (
            <DropdownMenuItem onClick={handleEdit}>
              <IconEdit className="mr-2 h-4 w-4" />
              {contextMenu?.isBulk && contextMenu.items.length > 1 ? "Editar em lote" : "Editar"}
            </DropdownMenuItem>
          )}

          {canEdit && contextMenu?.isBulk && contextMenu.items.length >= 1 && (
            <DropdownMenuItem onClick={handleStockBalance}>
              <IconClipboardCheck className="mr-2 h-4 w-4" />
              Balanço de estoque
            </DropdownMenuItem>
          )}

          {canEdit && (
            <DropdownMenuItem onClick={handlePriceAdjustment}>
              <IconPercentage className="mr-2 h-4 w-4" />
              Aplicar Ajuste
            </DropdownMenuItem>
          )}

          {canEdit && contextMenu?.isBulk && contextMenu.items.length >= 2 && (
            <DropdownMenuItem onClick={handleMerge}>
              <IconGitMerge className="mr-2 h-4 w-4" />
              Mesclar Itens
            </DropdownMenuItem>
          )}

          {canEdit && contextMenu?.items.some((item) => !item.isActive) && (
            <DropdownMenuItem onClick={handleActivate} className="text-green-700">
              <IconCheck className="mr-2 h-4 w-4" />
              {contextMenu?.isBulk && contextMenu.items.length > 1 ? "Ativar selecionados" : "Ativar"}
            </DropdownMenuItem>
          )}

          {canEdit && contextMenu?.items.some((item) => item.isActive) && (
            <DropdownMenuItem onClick={handleDeactivate} className="text-destructive">
              <IconX className="mr-2 h-4 w-4" />
              {contextMenu?.isBulk && contextMenu.items.length > 1 ? "Desativar selecionados" : "Desativar"}
            </DropdownMenuItem>
          )}

          {(canEdit || canDelete) && <DropdownMenuSeparator />}

          {canDelete && (
            <DropdownMenuItem onClick={handleDelete} className="text-destructive">
              <IconTrash className="mr-2 h-4 w-4" />
              {contextMenu?.isBulk && contextMenu.items.length > 1 ? "Deletar selecionados" : "Deletar"}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Price Adjustment Modal */}
      <PriceAdjustmentModal
        open={priceAdjustmentModal.open}
        onOpenChange={(open) => setPriceAdjustmentModal({ ...priceAdjustmentModal, open })}
        selectedItems={priceAdjustmentModal.items}
        onSuccess={() => {
          // Refetch data after successful price adjustment
          // The hook will automatically refetch due to React Query's invalidation
        }}
      />
    </div>
  );
}
