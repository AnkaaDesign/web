import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Order } from "../../../../types";
import { routes, ORDER_STATUS } from "../../../../constants";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { IconChevronUp, IconChevronDown, IconEdit, IconTrash, IconSelector, IconEye, IconAlertTriangle, IconShoppingCart, IconCheck, IconChecks, IconX, IconPlus } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useOrders, useOrderMutations, useOrderBatchMutations } from "../../../../hooks";
import { toast } from "sonner";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import type { OrderGetManyFormData } from "../../../../schemas";
import { useScrollbarWidth } from "@/hooks/use-scrollbar-width";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/use-table-state";
import { OrderTableSkeleton } from "./order-table-skeleton";
import { createOrderColumns } from "./order-table-columns";

interface OrderTableProps {
  visibleColumns: Set<string>;
  className?: string;
  onEdit?: (orders: Order[]) => void;
  onDelete?: (orders: Order[]) => void;
  filters?: Partial<OrderGetManyFormData>;
  onDataChange?: (data: { orders: Order[]; totalRecords: number }) => void;
}

export function OrderTable({ visibleColumns, className, onEdit, filters = {}, onDataChange }: OrderTableProps) {
  const navigate = useNavigate();
  const { delete: deleteOrder, updateAsync: updateOrder } = useOrderMutations();
  const { batchDelete } = useOrderBatchMutations();

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    orders: Order[];
    isBulk: boolean;
  } | null>(null);

  // Use viewport boundary checking hook
  
  // Delete confirmation dialog state
  const [deleteDialog, setDeleteDialog] = useState<{
    items: Order[];
    isBulk: boolean;
  } | null>(null);

  // Cancel confirmation dialog state
  const [cancelDialog, setCancelDialog] = useState<Order | null>(null);

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
  } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // Memoize include configuration to prevent re-renders
  const includeConfig = React.useMemo(
    () => ({
      supplier: true,
      items: {
        include: {
          item: true,
        },
      },
      _count: {
        select: {
          items: true,
        },
      },
    }),
    [],
  );

  // Memoize query parameters to prevent infinite re-renders
  const queryParams = React.useMemo(
    () => ({
      // When showSelectedOnly is true, don't apply filters
      ...(showSelectedOnly ? {} : filters),
      // Convert from 0-based component page to 1-based API page
      page: page + 1,
      limit: pageSize,
      include: includeConfig,
      // Convert sortConfigs to orderBy format for API
      // Always use convertSortConfigsToOrderBy to ensure correct format
      orderBy: convertSortConfigsToOrderBy(
        sortConfigs.length > 0
          ? sortConfigs
          : [
              { column: "statusOrder", direction: "asc" },
              { column: "createdAt", direction: "desc" },
            ],
      ),
      // Filter by selected IDs when showSelectedOnly is true
      ...(showSelectedOnly &&
        selectedIds.length > 0 && {
          where: {
            id: { in: selectedIds },
          },
        }),
    }),
    [filters, page, pageSize, includeConfig, sortConfigs, showSelectedOnly, selectedIds],
  );

  // Fetch data in the table component
  const { data: response, isLoading, error, refetch } = useOrders(queryParams);

  const orders = response?.data || [];
  const totalRecords = response?.meta?.totalRecords || 0;
  const totalPages = response?.meta ? Math.ceil(response.meta.totalRecords / pageSize) : 1;

  // Notify parent component of data changes
  const lastNotifiedDataRef = React.useRef<string>("");
  const isMountedRef = React.useRef(true);

  React.useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    if (onDataChange && isMountedRef.current) {
      const dataKey = orders.length > 0 ? `${totalRecords}-${orders.map((order) => order.id).join(",")}` : `empty-${totalRecords}`;

      if (dataKey !== lastNotifiedDataRef.current) {
        lastNotifiedDataRef.current = dataKey;
        onDataChange({ orders, totalRecords });
      }
    }
  }, [orders, totalRecords, onDataChange]);

  // Get columns
  const columns = React.useMemo(() => createOrderColumns(), []);
  const filteredColumns = React.useMemo(() => columns.filter((col) => visibleColumns.has(col.key)), [columns, visibleColumns]);

  // Handle selection
  const currentPageOrderIds = React.useMemo(() => {
    return orders.map((order) => order.id);
  }, [orders]);

  const handleSelectAll = React.useCallback(() => {
    toggleSelectAll(currentPageOrderIds);
  }, [toggleSelectAll, currentPageOrderIds]);

  // Handle row click
  const handleRowClick = React.useCallback(
    (order: Order, event: React.MouseEvent) => {
      // Don't navigate if clicking checkbox or context menu
      if ((event.target as HTMLElement).closest('[role="checkbox"]') || (event.target as HTMLElement).closest('[role="menu"]')) {
        return;
      }
      navigate(routes.inventory.orders?.details?.(order.id) || `/inventory/orders/details/${order.id}`);
    },
    [navigate],
  );

  // Handle actions

  const handleMarkAsFulfilled = React.useCallback(
    async (order: Order) => {
      if (order.status === ORDER_STATUS.FULFILLED) return;

      try {
        await updateOrder({ id: order.id, data: { status: ORDER_STATUS.FULFILLED } });
        refetch();
      } catch (error) {
        // Error handled by API client
      }
    },
    [updateOrder, refetch],
  );

  const handleMarkAsReceived = React.useCallback(
    async (order: Order) => {
      if (order.status === ORDER_STATUS.RECEIVED) return;

      try {
        await updateOrder({ id: order.id, data: { status: ORDER_STATUS.RECEIVED } });
        refetch();
      } catch (error) {
        // Error handled by API client
      }
    },
    [updateOrder, refetch],
  );

  const handleMarkAsCancelled = React.useCallback(
    async (order: Order) => {
      if (order.status === ORDER_STATUS.CANCELLED) return;
      setCancelDialog(order);
    },
    [],
  );

  const confirmCancel = async () => {
    if (!cancelDialog) return;

    try {
      await updateOrder({ id: cancelDialog.id, data: { status: ORDER_STATUS.CANCELLED } });
      refetch();
    } catch (error) {
      // Error handled by API client
    } finally {
      setCancelDialog(null);
    }
  };

  const handleDelete = React.useCallback(
    async (order: Order) => {
      setDeleteDialog({ items: [order], isBulk: false });
    },
    [],
  );

  const handleBulkDelete = React.useCallback(
    async (orderIds: string[]) => {
      const selectedOrders = orders.filter((order) => orderIds.includes(order.id));
      setDeleteDialog({ items: selectedOrders, isBulk: true });
    },
    [orders],
  );

  const confirmDelete = async () => {
    if (!deleteDialog) return;

    try {
      if (deleteDialog.isBulk) {
        const orderIds = deleteDialog.items.map((order) => order.id);
        await batchDelete({ orderIds });
        resetSelection();
      } else {
        await deleteOrder(deleteDialog.items[0].id);
        removeFromSelection([deleteDialog.items[0].id]);
      }
      refetch();
    } catch (error) {
      // Error handled by API client
    } finally {
      setDeleteDialog(null);
    }
  };

  // Context menu handlers
  const handleContextMenu = React.useCallback(
    (e: React.MouseEvent, order: Order) => {
      e.preventDefault();
      e.stopPropagation();

      // Check if clicked order is part of selection
      const isOrderSelected = isSelected(order.id);
      const hasSelection = selectionCount > 0;

      if (hasSelection && isOrderSelected) {
        // Show bulk actions for all selected orders
        const selectedOrdersList = orders.filter((o) => isSelected(o.id));
        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          orders: selectedOrdersList,
          isBulk: true,
        });
      } else {
        // Show actions for just the clicked order
        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          orders: [order],
          isBulk: false,
        });
      }
    },
    [isSelected, selectionCount, orders],
  );

  const handleViewDetails = React.useCallback(() => {
    if (contextMenu && !contextMenu.isBulk) {
      navigate(routes.inventory.orders?.details?.(contextMenu.orders[0].id) || `/inventory/orders/details/${contextMenu.orders[0].id}`);
      setContextMenu(null);
    }
  }, [contextMenu, navigate]);

  const handleEditOrder = React.useCallback(() => {
    if (contextMenu) {
      if (contextMenu.isBulk) {
        // Handle bulk edit if needed
        onEdit?.(contextMenu.orders);
      } else {
        // Single edit
        navigate(routes.inventory.orders?.edit?.(contextMenu.orders[0].id) || `/inventory/orders/edit/${contextMenu.orders[0].id}`);
      }
      setContextMenu(null);
    }
  }, [contextMenu, navigate, onEdit]);

  const handleMarkAsFulfilledFromMenu = React.useCallback(async () => {
    if (contextMenu && !contextMenu.isBulk) {
      const order = contextMenu.orders[0];
      await handleMarkAsFulfilled(order);
      setContextMenu(null);
    }
  }, [contextMenu, handleMarkAsFulfilled]);

  const handleMarkAsReceivedFromMenu = React.useCallback(async () => {
    if (contextMenu && !contextMenu.isBulk) {
      const order = contextMenu.orders[0];
      await handleMarkAsReceived(order);
      setContextMenu(null);
    }
  }, [contextMenu, handleMarkAsReceived]);

  const handleMarkAsCancelledFromMenu = React.useCallback(async () => {
    if (contextMenu && !contextMenu.isBulk) {
      const order = contextMenu.orders[0];
      await handleMarkAsCancelled(order);
      setContextMenu(null);
    }
  }, [contextMenu, handleMarkAsCancelled]);

  const handleDeleteFromMenu = React.useCallback(async () => {
    if (contextMenu) {
      if (contextMenu.isBulk) {
        // Bulk delete
        const orderIds = contextMenu.orders.map((o) => o.id);
        await handleBulkDelete(orderIds);
      } else {
        // Single delete
        await handleDelete(contextMenu.orders[0]);
      }
      setContextMenu(null);
    }
  }, [contextMenu, handleBulkDelete, handleDelete]);

  // Close context menu when clicking outside
  React.useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

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

  if (isLoading) {
    return <OrderTableSkeleton visibleColumns={visibleColumns} className={className} />;
  }

  const allSelected = isAllSelected(currentPageOrderIds);
  const someSelected = isPartiallySelected(currentPageOrderIds);

  return (
    <div className={cn("rounded-lg flex flex-col overflow-hidden", className)}>
      {/* Fixed Header */}
      <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden">
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
            <TableRow className="bg-muted hover:bg-muted even:bg-muted">
              <TableHead className={cn(TABLE_LAYOUT.checkbox.className, "whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0")}>
                <div className="flex items-center justify-center h-full w-full px-2">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="Selecionar todos"
                    disabled={isLoading || orders.length === 0}
                  />
                </div>
              </TableHead>
              {filteredColumns.map((column) => (
                <TableHead key={column.key} className={cn("whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0", column.className)}>
                  {column.sortable ? (
                    <button
                      onClick={() => toggleSort(column.key)}
                      className={cn(
                        "flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer border-0 bg-transparent",
                        column.align === "center" && "justify-center",
                        column.align === "right" && "justify-end",
                        !column.align && "justify-start",
                      )}
                      disabled={isLoading || orders.length === 0}
                    >
                      <span className="truncate">{column.header}</span>
                      {renderSortIndicator(column.key)}
                    </button>
                  ) : (
                    <div
                      className={cn(
                        "flex items-center h-full min-h-[2.5rem] px-4 py-2",
                        column.align === "center" && "justify-center",
                        column.align === "right" && "justify-end",
                        !column.align && "justify-start",
                      )}
                    >
                      <span className="truncate">{column.header}</span>
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

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden border-l border-r border-border">
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableBody>
            {error ? (
              <TableRow>
                <TableCell colSpan={filteredColumns.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-destructive">
                    <IconAlertTriangle className="h-8 w-8 mb-4" />
                    <div className="text-lg font-medium mb-2">Não foi possível carregar os pedidos</div>
                    <div className="text-sm text-muted-foreground">Tente novamente mais tarde.</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={filteredColumns.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <IconShoppingCart className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <div className="text-lg font-medium mb-2">Nenhum pedido encontrado</div>
                    {filters && Object.keys(filters).length > 1 ? (
                      <div className="text-sm">Ajuste os filtros para ver mais resultados.</div>
                    ) : (
                      <>
                        <div className="text-sm mb-4">Comece criando o primeiro pedido.</div>
                        <Button onClick={() => navigate(routes.inventory.orders.create)} variant="outline">
                          <IconPlus className="h-4 w-4 mr-2" />
                          Novo Pedido
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order, index) => {
                const isOrderSelected = isSelected(order.id);

                return (
                  <TableRow
                    key={order.id}
                    className={cn(
                      "cursor-pointer transition-colors border-b border-border",
                      // Alternating row colors
                      index % 2 === 1 && "bg-muted/10",
                      // Hover state that works with alternating colors
                      "hover:bg-muted/20",
                      // Selected state overrides alternating colors
                      isOrderSelected && "bg-muted/30 hover:bg-muted/40",
                    )}
                    onClick={(e) => handleRowClick(order, e)}
                    onContextMenu={(e) => handleContextMenu(e, order)}
                  >
                    <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                      <div className="flex items-center justify-center h-full w-full px-2 py-2" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={isOrderSelected} onCheckedChange={() => toggleSelection(order.id)} aria-label={`Selecionar pedido ${order.id.slice(-8)}`} />
                      </div>
                    </TableCell>
                    {filteredColumns.map((column) => (
                      <TableCell key={column.key} className={cn("p-0 !border-r-0", column.className)}>
                        <div
                          className={cn(
                            "px-4 py-2",
                            column.align === "center" && "text-center",
                            column.align === "right" && "text-right",
                            column.align === "left" && "text-left",
                            !column.align && "text-left",
                          )}
                        >
                          {column.accessor(order)}
                        </div>
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
        <SimplePaginationAdvanced currentPage={page} totalPages={totalPages} pageSize={pageSize} totalItems={totalRecords} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      {/* Context Menu */}
      <DropdownMenu open={!!contextMenu} onOpenChange={(open) => !open && setContextMenu(null)}>
        <PositionedDropdownMenuContent
        position={contextMenu}
        isOpen={!!contextMenu}
        className="w-56 ![position:fixed]"
        onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {contextMenu?.isBulk && <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">{contextMenu.orders.length} pedidos selecionados</div>}

          {!contextMenu?.isBulk && (
            <>
              <DropdownMenuItem onClick={handleViewDetails}>
                <IconEye className="mr-2 h-4 w-4" />
                Visualizar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleEditOrder}>
                <IconEdit className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>

              {/* Order-specific actions */}
              {contextMenu?.orders[0] && contextMenu.orders[0].status === ORDER_STATUS.CREATED && (
                <DropdownMenuItem onClick={handleMarkAsFulfilledFromMenu} className="text-amber-600 dark:text-amber-400">
                  <IconCheck className="mr-2 h-4 w-4" />
                  Marcar como pedido
                </DropdownMenuItem>
              )}

              {contextMenu?.orders[0] && contextMenu.orders[0].status !== ORDER_STATUS.RECEIVED && contextMenu.orders[0].status !== ORDER_STATUS.CANCELLED && (
                <DropdownMenuItem onClick={handleMarkAsReceivedFromMenu} className="text-green-700 dark:text-green-400">
                  <IconChecks className="mr-2 h-4 w-4" />
                  Marcar como recebido
                </DropdownMenuItem>
              )}

              {contextMenu?.orders[0] && contextMenu.orders[0].status !== ORDER_STATUS.CANCELLED && contextMenu.orders[0].status !== ORDER_STATUS.RECEIVED && (
                <DropdownMenuItem onClick={handleMarkAsCancelledFromMenu}>
                  <IconX className="mr-2 h-4 w-4" />
                  Cancelar pedido
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />
            </>
          )}

          <DropdownMenuItem onClick={handleDeleteFromMenu} className="text-destructive">
            <IconTrash className="mr-2 h-4 w-4" />
            {contextMenu?.isBulk && contextMenu.orders.length > 1 ? "Deletar selecionados" : "Deletar"}
          </DropdownMenuItem>
        </PositionedDropdownMenuContent>
      </DropdownMenu>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog?.isBulk
                ? `Tem certeza que deseja excluir ${deleteDialog.items.length} ${deleteDialog.items.length === 1 ? "pedido" : "pedidos"}? Esta ação não pode ser desfeita.`
                : `Tem certeza que deseja excluir o pedido ${deleteDialog?.items[0]?.id.slice(-8)}? Esta ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Order Confirmation Dialog */}
      <AlertDialog open={!!cancelDialog} onOpenChange={(open) => !open && setCancelDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar cancelamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar o pedido {cancelDialog?.id.slice(-8)}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Cancelar pedido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
