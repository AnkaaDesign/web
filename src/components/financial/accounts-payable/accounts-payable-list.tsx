import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { addDays } from "date-fns";
import {
  IconAlertTriangle,
  IconCashBanknote,
  IconCircleCheck,
  IconExternalLink,
  IconHourglass,
  IconReceipt2,
} from "@tabler/icons-react";

import type { Order } from "../../../types";
import { routes, ORDER_PAYMENT_STATUS, PAYMENT_METHOD_LABELS } from "../../../constants";
import { useOrders, useOrderMutations, useOrderBatchMutations, useOrderPaymentSummary } from "../../../hooks";
import { calculateOrderTotal } from "../../../utils/order";
import { formatCurrency, formatDate } from "../../../utils";
import { formatOrderNumber } from "@/utils/order-code";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { useTableState } from "@/hooks/common/use-table-state";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { OrderPaymentStatusBadge } from "@/components/inventory/order/common/order-payment-status-badge";

// Order grand total for payables = items (+ICMS/IPI) − discount + freight,
// mirroring how the order PDF/detail compute the amount actually owed.
function getPayableTotal(order: Order): number {
  return calculateOrderTotal(order) + (order.freight ?? 0);
}

// Due-date hint derived from paymentDueDays: counted from the moment payment
// was requested (fallback: order creation).
function getDueDate(order: Order): Date | null {
  if (order.paymentDueDays == null) return null;
  const base = order.paymentRequestedAt ?? order.createdAt;
  return addDays(new Date(base), order.paymentDueDays);
}

const OPEN_STATUSES: ORDER_PAYMENT_STATUS[] = [
  ORDER_PAYMENT_STATUS.NOT_REQUESTED,
  ORDER_PAYMENT_STATUS.REQUESTED,
  ORDER_PAYMENT_STATUS.AWAITING_PAYMENT,
];

const ALL_STATUSES: ORDER_PAYMENT_STATUS[] = [...OPEN_STATUSES, ORDER_PAYMENT_STATUS.PAID];

const STATUS_PARAM = "paymentStatus";
const SEARCH_PARAM = "search";

// PAID rows are unbounded, so the PAID quick-filter (and the summary card,
// server-side) are windowed to the last N days.
const PAID_WINDOW_DAYS = 90;

interface AccountsPayableListProps {
  className?: string;
}

export function AccountsPayableList({ className }: AccountsPayableListProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // --- URL state: pagination + selection (canonical useTableState pattern) ---
  const {
    page,
    pageSize,
    selectedIds,
    showSelectedOnly,
    setPage,
    setPageSize,
    toggleSelectAll,
    toggleShowSelectedOnly,
    isSelected,
    isAllSelected,
    isPartiallySelected,
    selectionCount,
    handleRowClick: handleRowClickSelection,
  } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // --- URL state: status chips (default = everything not yet paid) ---------
  const selectedStatuses = useMemo<ORDER_PAYMENT_STATUS[]>(() => {
    const raw = searchParams.get(STATUS_PARAM);
    if (!raw) return OPEN_STATUSES;
    const parsed = raw.split(",").filter((s): s is ORDER_PAYMENT_STATUS => ALL_STATUSES.includes(s as ORDER_PAYMENT_STATUS));
    return parsed.length > 0 ? parsed : OPEN_STATUSES;
  }, [searchParams]);

  const toggleStatus = useCallback(
    (status: ORDER_PAYMENT_STATUS) => {
      const next = selectedStatuses.includes(status)
        ? selectedStatuses.filter((s) => s !== status)
        : [...selectedStatuses, status];
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next.length === 0 || (next.length === OPEN_STATUSES.length && OPEN_STATUSES.every((s) => next.includes(s)))) {
            params.delete(STATUS_PARAM);
          } else {
            params.set(STATUS_PARAM, next.join(","));
          }
          params.delete("page"); // filter change resets pagination
          return params;
        },
        { replace: true },
      );
    },
    [selectedStatuses, setSearchParams],
  );

  // --- URL state: debounced search -----------------------------------------
  const urlSearch = searchParams.get(SEARCH_PARAM) || "";
  const [searchText, setSearchText] = useState(urlSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(urlSearch);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(searchText);
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          const current = params.get(SEARCH_PARAM) || "";
          if (current === searchText) return prev; // no change — keep page param intact
          if (searchText) {
            params.set(SEARCH_PARAM, searchText);
          } else {
            params.delete(SEARCH_PARAM);
          }
          params.delete("page"); // search change resets pagination
          return params;
        },
        { replace: true },
      );
    }, 500);
    return () => clearTimeout(handle);
  }, [searchText, setSearchParams]);

  // --- Summary cards: lightweight server-side aggregates --------------------
  const {
    data: summaryResponse,
    isLoading: isSummaryLoading,
    refetch: refetchSummary,
  } = useOrderPaymentSummary();
  const summary = summaryResponse?.data;

  // --- Table query: standard pagination with paymentStatus filters ----------
  const paidWindowStart = useMemo(() => {
    const d = addDays(new Date(), -PAID_WINDOW_DAYS);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const tableParams = useMemo(() => {
    const includesPaid = selectedStatuses.includes(ORDER_PAYMENT_STATUS.PAID);
    const openSelected = selectedStatuses.filter((s) => s !== ORDER_PAYMENT_STATUS.PAID);

    // PAID rows are windowed (paidAt >= now − 90d, applied server-side);
    // open statuses are naturally bounded so they get a plain status filter.
    const paidCondition = { paymentStatus: ORDER_PAYMENT_STATUS.PAID, paidAt: { gte: paidWindowStart } };
    const where =
      includesPaid && openSelected.length > 0
        ? { OR: [{ paymentStatus: { in: openSelected } }, paidCondition] }
        : includesPaid
          ? paidCondition
          : { paymentStatus: { in: openSelected } };

    return {
      // Keys inside `where` combine with AND — when "ver selecionados" is
      // active, the id filter narrows the status window to the selection.
      where: showSelectedOnly && selectedIds.length > 0 ? { ...where, id: { in: selectedIds } } : where,
      include: { supplier: true, items: true },
      orderBy: [{ paymentStatusOrder: "asc" as const }, { createdAt: "desc" as const }],
      page: page + 1, // useTableState is 0-based; API is 1-based
      limit: pageSize,
      ...(debouncedSearch ? { searchingFor: debouncedSearch } : {}),
    };
  }, [selectedStatuses, paidWindowStart, page, pageSize, debouncedSearch, showSelectedOnly, selectedIds]);

  const { data: response, isLoading, error, refetch } = useOrders(tableParams);
  const pageOrders = useMemo(() => response?.data ?? [], [response?.data]);
  const totalRecords = response?.meta?.totalRecords ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

  // Group the current page by supplier (alphabetical), with per-supplier
  // subtotals. Grouping is per page — a supplier may continue on the next page.
  const supplierGroups = useMemo(() => {
    const groups = new Map<string, { name: string; orders: Order[]; subtotal: number }>();
    pageOrders.forEach((order) => {
      const key = order.supplierId ?? "__none__";
      const name = order.supplier?.fantasyName ?? "Sem fornecedor";
      if (!groups.has(key)) {
        groups.set(key, { name, orders: [], subtotal: 0 });
      }
      const group = groups.get(key)!;
      group.orders.push(order);
      group.subtotal += getPayableTotal(order);
    });
    return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [pageOrders]);

  const pageTotal = useMemo(() => pageOrders.reduce((sum, order) => sum + getPayableTotal(order), 0), [pageOrders]);

  // --- Payment mutations (single + bulk, same pattern as the orders table) ----
  const { requestPaymentAsync, markAwaitingPaymentAsync, markPaidAsync } = useOrderMutations();
  const { batchRequestPaymentAsync, batchMarkAwaitingPaymentAsync, batchMarkPaidAsync } = useOrderBatchMutations();

  // --- Selection helpers -------------------------------------------------------
  const currentPageOrderIds = useMemo(() => pageOrders.map((order) => order.id), [pageOrders]);
  const allSelected = isAllSelected(currentPageOrderIds);
  const partiallySelected = isPartiallySelected(currentPageOrderIds);

  const handleSelectAll = useCallback(() => {
    toggleSelectAll(currentPageOrderIds);
  }, [toggleSelectAll, currentPageOrderIds]);

  const handleSelectOrder = useCallback(
    (orderId: string, event?: React.MouseEvent) => {
      handleRowClickSelection(orderId, currentPageOrderIds, event?.shiftKey || false);
    },
    [handleRowClickSelection, currentPageOrderIds],
  );

  // --- Context menu (single row or bulk over the current selection) ------------
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; orders: Order[]; isBulk: boolean } | null>(null);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, order: Order) => {
      e.preventDefault();
      e.stopPropagation();

      if (selectionCount > 0 && isSelected(order.id)) {
        // Show bulk actions for all selected orders on the current page
        const selectedOrdersList = pageOrders.filter((o) => isSelected(o.id));
        setContextMenu({ x: e.clientX, y: e.clientY, orders: selectedOrdersList, isBulk: selectedOrdersList.length > 1 });
      } else {
        setContextMenu({ x: e.clientX, y: e.clientY, orders: [order], isBulk: false });
      }
    },
    [selectionCount, isSelected, pageOrders],
  );

  const handleOpenOrder = useCallback(() => {
    if (contextMenu && !contextMenu.isBulk) {
      navigate(routes.inventory.orders.details(contextMenu.orders[0].id));
      setContextMenu(null);
    }
  }, [contextMenu, navigate]);

  // Payment actions (single + bulk). Bulk uses the dedicated batch endpoints so
  // the API answers with ONE response (one interceptor toast) per operation;
  // only the eligible orders are sent.
  const runPaymentAction = useCallback(
    async (
      eligibilityFilter: (order: Order) => boolean,
      single: (id: string) => Promise<unknown>,
      batch: (params: { orderIds: string[] }) => Promise<unknown>,
    ) => {
      if (!contextMenu) return;
      const eligible = contextMenu.orders.filter(eligibilityFilter);
      const isBulk = contextMenu.isBulk;
      setContextMenu(null);
      if (eligible.length === 0) return;

      try {
        if (isBulk && eligible.length > 1) {
          await batch({ orderIds: eligible.map((o) => o.id) });
        } else {
          await single(eligible[0].id);
        }
        refetch();
        refetchSummary();
      } catch {
        // Error toast handled by API client interceptor
      }
    },
    [contextMenu, refetch, refetchSummary],
  );

  const handleRequestPaymentFromMenu = useCallback(
    () =>
      runPaymentAction(
        (o) => o.paymentStatus === ORDER_PAYMENT_STATUS.NOT_REQUESTED,
        requestPaymentAsync,
        batchRequestPaymentAsync,
      ),
    [runPaymentAction, requestPaymentAsync, batchRequestPaymentAsync],
  );

  const handleMarkAwaitingPaymentFromMenu = useCallback(
    () =>
      runPaymentAction(
        (o) => o.paymentStatus === ORDER_PAYMENT_STATUS.NOT_REQUESTED || o.paymentStatus === ORDER_PAYMENT_STATUS.REQUESTED,
        markAwaitingPaymentAsync,
        batchMarkAwaitingPaymentAsync,
      ),
    [runPaymentAction, markAwaitingPaymentAsync, batchMarkAwaitingPaymentAsync],
  );

  const handleMarkPaidFromMenu = useCallback(
    () =>
      runPaymentAction(
        (o) => o.paymentStatus !== ORDER_PAYMENT_STATUS.PAID,
        markPaidAsync,
        batchMarkPaidAsync,
      ),
    [runPaymentAction, markPaidAsync, batchMarkPaidAsync],
  );

  // Menu eligibility — for bulk, show the action when at least one selected
  // order can transition (the handler filters to the eligible subset).
  const contextOrders = contextMenu?.orders ?? [];
  const canRequest = contextOrders.some((o) => o.paymentStatus === ORDER_PAYMENT_STATUS.NOT_REQUESTED);
  const canAwait = contextOrders.some(
    (o) => o.paymentStatus === ORDER_PAYMENT_STATUS.NOT_REQUESTED || o.paymentStatus === ORDER_PAYMENT_STATUS.REQUESTED,
  );
  const canPay = contextOrders.some((o) => o.paymentStatus !== ORDER_PAYMENT_STATUS.PAID);

  // --- Summary card metadata ----------------------------------------------------
  const summaryCards: Array<{ status: ORDER_PAYMENT_STATUS; bucket?: { count: number; total: number }; hint?: string }> = [
    { status: ORDER_PAYMENT_STATUS.NOT_REQUESTED, bucket: summary?.NOT_REQUESTED },
    { status: ORDER_PAYMENT_STATUS.REQUESTED, bucket: summary?.REQUESTED },
    { status: ORDER_PAYMENT_STATUS.AWAITING_PAYMENT, bucket: summary?.AWAITING_PAYMENT },
    { status: ORDER_PAYMENT_STATUS.PAID, bucket: summary?.PAID_LAST_90_DAYS, hint: `últimos ${PAID_WINDOW_DAYS} dias` },
  ];

  // --- Render ---------------------------------------------------------------------
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Summary cards (double as quick status filters) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 flex-shrink-0">
        {summaryCards.map(({ status, bucket, hint }) => {
          const active = selectedStatuses.includes(status);
          return (
            <Card
              key={status}
              role="button"
              tabIndex={0}
              onClick={() => toggleStatus(status)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleStatus(status);
                }
              }}
              className={cn(
                "cursor-pointer transition-colors border",
                active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30 opacity-75",
              )}
            >
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <OrderPaymentStatusBadge status={status} size="sm" />
                  <Badge variant="default" className="justify-center min-w-8">
                    {isSummaryLoading || !bucket ? "…" : bucket.count}
                  </Badge>
                </div>
                <p className="text-xl font-bold tabular-nums">{isSummaryLoading || !bucket ? "—" : formatCurrency(bucket.total)}</p>
                <p className="text-xs text-muted-foreground">{hint ? `Total (${hint})` : "Total em aberto"}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Search + summary line */}
      <Card className="flex-1 min-h-0 flex flex-col shadow-sm border border-border">
        <CardContent className="flex-1 min-h-0 flex flex-col p-4 space-y-4 overflow-hidden">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <TableSearchInput
              value={searchText}
              onChange={(value) => setSearchText(value)}
              placeholder="Buscar por descrição, fornecedor, item..."
              isPending={searchText !== debouncedSearch}
            />
            <div className="flex items-center gap-2">
              <ShowSelectedToggle showSelectedOnly={showSelectedOnly} onToggle={toggleShowSelectedOnly} selectionCount={selectionCount} />
              <div className="text-sm text-muted-foreground whitespace-nowrap sm:text-right">
                {totalRecords} {totalRecords === 1 ? "pedido" : "pedidos"} • página:{" "}
                <span className="font-semibold text-foreground tabular-nums">{formatCurrency(pageTotal)}</span>
              </div>
            </div>
          </div>

          {/* Grouped table */}
          <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-border">
            <Table className="w-full">
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead className="w-12 bg-muted p-0">
                    <div className="flex items-center justify-center h-full w-full px-2">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={handleSelectAll}
                        aria-label="Selecionar todos os pedidos"
                        disabled={isLoading || pageOrders.length === 0}
                        indeterminate={partiallySelected}
                      />
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs w-20">Nº</TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs min-w-[16rem]">Descrição</TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs w-32 text-right">Total</TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs w-36">Forma de Pagamento</TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs w-32">Vencimento</TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs w-44">Pagamento</TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs w-28">Solicitado em</TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs w-28">Pago em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={9}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={9} className="p-0">
                      <div className="flex flex-col items-center justify-center p-8 text-center text-destructive">
                        <IconAlertTriangle className="h-8 w-8 mb-4" />
                        <div className="text-lg font-medium mb-2">Não foi possível carregar as contas a pagar</div>
                        <div className="text-sm text-muted-foreground">Tente novamente mais tarde.</div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : supplierGroups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="p-0">
                      <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                        <IconReceipt2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
                        <div className="text-lg font-medium mb-2">Nenhuma conta a pagar encontrada</div>
                        <div className="text-sm">Ajuste os filtros de status ou a busca para ver mais resultados.</div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  supplierGroups.map((group) => (
                    <React.Fragment key={group.name}>
                      {/* Supplier group header with subtotal (current page) */}
                      <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-border">
                        <TableCell colSpan={3} className="py-2 font-semibold">
                          {group.name}
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            ({group.orders.length} {group.orders.length === 1 ? "pedido" : "pedidos"})
                          </span>
                        </TableCell>
                        <TableCell className="py-2 text-right font-semibold tabular-nums">{formatCurrency(group.subtotal)}</TableCell>
                        <TableCell colSpan={5} />
                      </TableRow>
                      {group.orders.map((order, index) => {
                        const dueDate = getDueDate(order);
                        const isOverdue = !!dueDate && order.paymentStatus !== ORDER_PAYMENT_STATUS.PAID && dueDate < new Date();
                        const orderIsSelected = isSelected(order.id);
                        return (
                          <TableRow
                            key={order.id}
                            data-state={orderIsSelected ? "selected" : undefined}
                            className={cn(
                              "cursor-pointer transition-colors border-b border-border",
                              index % 2 === 1 && "bg-muted/10",
                              "hover:bg-muted/20",
                              orderIsSelected && "bg-muted/30 hover:bg-muted/40",
                            )}
                            onClick={() => navigate(routes.inventory.orders.details(order.id))}
                            onContextMenu={(e) => handleContextMenu(e, order)}
                          >
                            <TableCell className="w-12 p-0">
                              <div
                                className="flex items-center justify-center h-full w-full px-2 py-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectOrder(order.id, e);
                                }}
                              >
                                <Checkbox checked={orderIsSelected} aria-label={`Selecionar pedido ${order.orderNumber ?? order.id}`} data-checkbox />
                              </div>
                            </TableCell>
                            <TableCell className="text-sm font-medium tabular-nums">
                              {order.orderNumber != null ? formatOrderNumber(order.orderNumber) : "—"}
                            </TableCell>
                            <TableCell>
                              <TruncatedTextWithTooltip text={order.description || "-"} className="text-sm" />
                            </TableCell>
                            <TableCell className="text-sm font-medium tabular-nums text-right">{formatCurrency(getPayableTotal(order))}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {order.paymentMethod ? PAYMENT_METHOD_LABELS[order.paymentMethod] : "-"}
                            </TableCell>
                            <TableCell>
                              {dueDate ? (
                                <span className={cn("text-sm whitespace-nowrap", isOverdue ? "text-destructive font-medium" : "text-muted-foreground")}>
                                  {formatDate(dueDate)}
                                  {isOverdue && " (vencido)"}
                                </span>
                              ) : (
                                <span className="text-sm text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <OrderPaymentStatusBadge status={order.paymentStatus} />
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {order.paymentRequestedAt ? formatDate(order.paymentRequestedAt) : "-"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {order.paidAt ? formatDate(order.paidAt) : "-"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </React.Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex-shrink-0">
            <SimplePaginationAdvanced
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              pageSize={pageSize}
              totalItems={totalRecords}
              pageSizeOptions={[20, 40, 60, 100]}
              onPageSizeChange={setPageSize}
            />
          </div>
        </CardContent>
      </Card>

      {/* Context Menu */}
      <DropdownMenu open={!!contextMenu} onOpenChange={(open) => !open && setContextMenu(null)}>
        <PositionedDropdownMenuContent
          position={contextMenu}
          isOpen={!!contextMenu}
          className="w-64 ![position:fixed]"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {contextMenu?.isBulk && (
            <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">{contextMenu.orders.length} pedidos selecionados</div>
          )}

          {!contextMenu?.isBulk && (
            <DropdownMenuItem onClick={handleOpenOrder}>
              <IconExternalLink className="mr-2 h-4 w-4" />
              Ver pedido
            </DropdownMenuItem>
          )}

          {!contextMenu?.isBulk && (canRequest || canAwait || canPay) && <DropdownMenuSeparator />}

          {canRequest && (
            <DropdownMenuItem onClick={handleRequestPaymentFromMenu} className="text-amber-700 dark:text-amber-400">
              <IconCashBanknote className="mr-2 h-4 w-4" />
              Solicitar Pagamento
            </DropdownMenuItem>
          )}

          {canAwait && (
            <DropdownMenuItem onClick={handleMarkAwaitingPaymentFromMenu} className="text-orange-700 dark:text-orange-400">
              <IconHourglass className="mr-2 h-4 w-4" />
              Marcar Aguardando Pagamento
            </DropdownMenuItem>
          )}

          {canPay && (
            <DropdownMenuItem onClick={handleMarkPaidFromMenu} className="text-green-700 dark:text-green-400">
              <IconCircleCheck className="mr-2 h-4 w-4" />
              Marcar como Pago
            </DropdownMenuItem>
          )}
        </PositionedDropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
