import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  IconPlus,
  IconExternalLink,
  IconEdit,
  IconCheck,
  IconChecks,
  IconX,
  IconCircleCheck,
  IconHourglass,
  IconTrash,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { DataTablePage } from "@/components/ui/datatable";
import type { DataTableRowAction, DataTableFilterDef, DataTableRowClickMeta } from "@/components/ui/datatable";
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
import { useOrders, useOrderMutations, useOrderBatchMutations, useSuppliers } from "../../../../hooks";
import { getOrders } from "@/api-client";
import type { DataTableFilterValues } from "@/components/ui/datatable";
import type { Order } from "../../../../types";
import {
  routes,
  FAVORITE_PAGES,
  SECTOR_PRIVILEGES,
  ORDER_STATUS,
  ORDER_STATUS_LABELS,
  ORDER_PAYMENT_STATUS,
  ORDER_PAYMENT_STATUS_LABELS,
} from "../../../../constants";
import { createOrderColumns, ORDER_SECTOR_DEFAULTS, ORDER_PRICE_VIEWERS } from "./order-table-columns";

// Trimmed include — only what the columns render (supplier name, item totals/count).
const LIST_INCLUDE = {
  supplier: true,
  items: { include: { item: true } },
  _count: { select: { items: true } },
} as const;

// Payment workflow (contas a pagar) — financial-only; WAREHOUSE never settles payments.
const PAYMENT_MANAGERS = [SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ACCOUNTING];

// The API caps `limit` at 100, so the list is server-paginated (page/limit/sort/filters all go to the
// server). Page + sort ride the URL the DataTable writes in server mode; search + filters arrive via
// `onParamsChange`.
const ORDER_DEFAULT_PAGE_SIZE = 40;
const EMPTY_PARAMS: { search: string; filters: DataTableFilterValues } = { search: "", filters: {} };

/** column id → API orderBy entry. Columns without a server-sortable field are omitted (sort ignored). */
const ORDER_SORT_FIELD_MAP: Record<string, (dir: "asc" | "desc") => Record<string, unknown>> = {
  orderNumber: (d) => ({ orderNumber: d }),
  description: (d) => ({ description: d }),
  status: (d) => ({ statusOrder: d }),
  paymentStatus: (d) => ({ paymentStatusOrder: d }),
  forecast: (d) => ({ forecast: d }),
  paidAt: (d) => ({ paidAt: d }),
  createdAt: (d) => ({ createdAt: d }),
};

function buildOrderOrderBy(sorting: { id: string; desc: boolean }[]): Record<string, unknown> | Record<string, unknown>[] {
  const entries = sorting.map((s) => ORDER_SORT_FIELD_MAP[s.id]?.(s.desc ? "desc" : "asc")).filter((e): e is Record<string, unknown> => !!e);
  if (entries.length === 0) return [{ statusOrder: "asc" }, { createdAt: "desc" }];
  return entries.length === 1 ? entries[0] : entries;
}

function dateRange(v: unknown): { gte?: Date; lte?: Date } | undefined {
  if (!v || typeof v !== "object") return undefined;
  const { from, to } = v as { from?: string; to?: string };
  if (!from && !to) return undefined;
  return { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) };
}

/** Map the declarative filter values + global search onto the order GET query (server mode). */
function buildOrderQuery(filters: DataTableFilterValues, search: string): Record<string, unknown> {
  const q: Record<string, unknown> = {};
  const status = filters.status;
  if (Array.isArray(status) && status.length > 0) q.status = status;
  const pay = filters.paymentStatus;
  if (Array.isArray(pay) && pay.length > 0) q.paymentStatuses = pay;
  const sup = filters.supplierId;
  if (Array.isArray(sup) && sup.length > 0) q.supplierIds = sup;
  const created = dateRange(filters.createdAt);
  if (created) q.createdAt = created;
  const forecast = dateRange(filters.forecast);
  if (forecast) q.forecastRange = forecast;
  const updated = dateRange(filters.updatedAt);
  // API exposes a root `updatedAt` range filter (mirrors `createdAt`); there is NO `updatedAtRange`
  // key, so the old name was silently stripped by zod → the filter returned the full unfiltered set.
  if (updated) q.updatedAt = updated;
  if (search) q.searchingFor = search;
  return q;
}

export function OrderTablePage() {
  const navigate = useNavigate();
  const { updateAsync, deleteAsync, markAwaitingPaymentAsync, markPaidAsync } = useOrderMutations();
  const { batchUpdateAsync, batchDeleteAsync, batchMarkAwaitingPaymentAsync, batchMarkPaidAsync } = useOrderBatchMutations();

  // --- server mode: search + filters via onParamsChange; page/pageSize/sort from the URL ---
  const [searchParams] = useSearchParams();
  const [params, setParams] = useState(EMPTY_PARAMS);
  const paramsKey = useRef("");
  const onParamsChange = useCallback((next: { search: string; filters: DataTableFilterValues }) => {
    const key = JSON.stringify(next);
    if (key === paramsKey.current) return;
    paramsKey.current = key;
    setParams(next);
  }, []);

  const pageRaw = Number(searchParams.get("page") ?? "1");
  const page = Number.isFinite(pageRaw) ? Math.max(1, pageRaw) : 1;
  const pageSizeRaw = Number(searchParams.get("pageSize") ?? String(ORDER_DEFAULT_PAGE_SIZE));
  const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : ORDER_DEFAULT_PAGE_SIZE;
  const sortParam = searchParams.get("sort");
  const sorting = useMemo<{ id: string; desc: boolean }[]>(() => {
    if (!sortParam) return [];
    try {
      const parsed = JSON.parse(sortParam);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [sortParam]);

  const query = useMemo(
    () => ({
      ...buildOrderQuery(params.filters, params.search),
      page,
      limit: pageSize,
      orderBy: buildOrderOrderBy(sorting),
      include: LIST_INCLUDE,
    }),
    [params, page, pageSize, sorting],
  );

  const { data: response, isLoading, error } = useOrders(query as never);
  const orders = useMemo(() => (response as { data?: Order[] } | undefined)?.data ?? [], [response]);
  const totalRecords = (response as { meta?: { totalRecords?: number } } | undefined)?.meta?.totalRecords ?? 0;

  // Export "all": refetch every order matching the current search/filters/sort (the table only holds
  // the current page). The API caps `limit` at 100 (order schema), so page through the full set rather
  // than requesting everything in one shot — a single oversized request would be rejected/truncated,
  // silently dropping rows while the UI promises "Todos os N registros".
  const fetchAllForExport = useCallback(async (): Promise<Order[]> => {
    const PAGE_SIZE = 100;
    const baseQuery = {
      ...buildOrderQuery(params.filters, params.search),
      orderBy: buildOrderOrderBy(sorting),
      include: LIST_INCLUDE,
    };
    const all: Order[] = [];
    for (let page = 1; ; page++) {
      const res = (await getOrders({ ...baseQuery, page, limit: PAGE_SIZE } as never)) as
        | { data?: Order[]; meta?: { hasNextPage?: boolean } }
        | undefined;
      const rows = res?.data ?? [];
      all.push(...rows);
      // Stop when the API reports no further page or returns a short page; the total guard is a
      // defensive backstop against an unbounded loop.
      if (res?.meta?.hasNextPage === false || rows.length < PAGE_SIZE) break;
      if (totalRecords > 0 && all.length >= totalRecords) break;
    }
    return all;
  }, [params, sorting, totalRecords]);

  // Supplier filter options (loaded once; API caps limit at 100).
  const { data: suppliersData } = useSuppliers({ orderBy: { fantasyName: "asc" }, limit: 100 } as never);
  const supplierOptions = useMemo(
    () =>
      ((suppliersData as { data?: Array<{ id: string; fantasyName: string }> } | undefined)?.data ?? [])
        .map((s) => ({ value: s.id, label: s.fantasyName })),
    [suppliersData],
  );

  const columns = useMemo(() => createOrderColumns(), []);

  // Row → detail; hand over the visible order so the detail page can page prev/next.
  const onRowClick = useCallback(
    (order: Order, meta: DataTableRowClickMeta) => {
      navigate(routes.inventory.orders.details(order.id), { state: { ids: meta.orderedIds } });
    },
    [navigate],
  );

  // --- confirmation dialogs (hosted once at page level) ---
  const [deleteDialog, setDeleteDialog] = useState<Order[] | null>(null);
  const [cancelDialog, setCancelDialog] = useState<Order | null>(null);

  const runUpdate = useCallback(
    async (id: string, data: Record<string, unknown>) => {
      try {
        await updateAsync({ id, data: data as never });
      } catch {
        // The api client already surfaced the error notification.
      }
    },
    [updateAsync],
  );

  // Apply a single status transition to N selected orders: one call when several are
  // eligible (PUT /orders/batch), the single-order endpoint when only one is.
  const runStatusUpdate = useCallback(
    async (orders: Order[], status: ORDER_STATUS) => {
      if (orders.length === 0) return;
      try {
        if (orders.length > 1) {
          await batchUpdateAsync({ orders: orders.map((o) => ({ id: o.id, data: { status } })) as never });
        } else {
          await updateAsync({ id: orders[0].id, data: { status } as never });
        }
      } catch {
        // The api client already surfaced the error notification.
      }
    },
    [batchUpdateAsync, updateAsync],
  );

  const confirmDelete = useCallback(async () => {
    const items = deleteDialog;
    if (!items?.length) return;
    try {
      if (items.length > 1) await batchDeleteAsync({ orderIds: items.map((o) => o.id) });
      else await deleteAsync(items[0].id);
    } catch {
      // The api client already surfaced the error notification.
    } finally {
      setDeleteDialog(null);
    }
  }, [deleteDialog, batchDeleteAsync, deleteAsync]);

  const confirmCancel = useCallback(async () => {
    if (!cancelDialog) return;
    await runUpdate(cancelDialog.id, { status: ORDER_STATUS.CANCELLED });
    setCancelDialog(null);
  }, [cancelDialog, runUpdate]);

  const rowActions = useMemo<DataTableRowAction<Order>[]>(
    () => [
      {
        key: "open-new-tab",
        label: "Abrir em nova guia",
        icon: <IconExternalLink className="h-4 w-4" />,
        hidden: (rows) => rows.length !== 1,
        onClick: (rows) => rows[0] && window.open(routes.inventory.orders.details(rows[0].id), "_blank"),
      },
      {
        key: "edit",
        label: "Editar",
        icon: <IconEdit className="h-4 w-4" />,
        requiredPrivilege: SECTOR_PRIVILEGES.WAREHOUSE,
        hidden: (rows) => rows.length !== 1,
        onClick: (rows) => rows[0] && navigate(routes.inventory.orders.edit(rows[0].id)),
      },
      {
        key: "mark-fulfilled",
        label: "Marcar como feito",
        icon: <IconCheck className="h-4 w-4" />,
        requiredPrivilege: SECTOR_PRIVILEGES.WAREHOUSE,
        // Shown whenever at least one selected order can still be fulfilled (CREATED).
        hidden: (rows) => !rows.some((o) => o.status === ORDER_STATUS.CREATED),
        onClick: (rows) =>
          void runStatusUpdate(
            rows.filter((o) => o.status === ORDER_STATUS.CREATED),
            ORDER_STATUS.FULFILLED,
          ),
      },
      {
        key: "mark-received",
        label: "Marcar como recebido",
        icon: <IconChecks className="h-4 w-4" />,
        requiredPrivilege: SECTOR_PRIVILEGES.WAREHOUSE,
        // Shown whenever at least one selected order is not already received/cancelled.
        hidden: (rows) =>
          !rows.some((o) => o.status !== ORDER_STATUS.RECEIVED && o.status !== ORDER_STATUS.CANCELLED),
        onClick: (rows) =>
          void runStatusUpdate(
            rows.filter((o) => o.status !== ORDER_STATUS.RECEIVED && o.status !== ORDER_STATUS.CANCELLED),
            ORDER_STATUS.RECEIVED,
          ),
      },
      {
        key: "cancel",
        label: "Cancelar pedido",
        icon: <IconX className="h-4 w-4" />,
        variant: "destructive",
        requiredPrivilege: SECTOR_PRIVILEGES.WAREHOUSE,
        hidden: (rows) =>
          rows.length !== 1 || rows[0].status === ORDER_STATUS.CANCELLED || rows[0].status === ORDER_STATUS.RECEIVED,
        onClick: (rows) => rows[0] && setCancelDialog(rows[0]),
      },
      // --- payment workflow (single + bulk) ---
      {
        key: "mark-paid",
        label: "Marcar como Pago",
        icon: <IconCircleCheck className="h-4 w-4" />,
        separatorBefore: true,
        requiredPrivilege: PAYMENT_MANAGERS,
        hidden: (rows) => !rows.some((o) => o.paymentStatus !== ORDER_PAYMENT_STATUS.PAID),
        onClick: async (rows) => {
          const eligible = rows.filter((o) => o.paymentStatus !== ORDER_PAYMENT_STATUS.PAID);
          if (eligible.length === 0) return;
          try {
            if (eligible.length > 1) await batchMarkPaidAsync({ orderIds: eligible.map((o) => o.id) });
            else await markPaidAsync(eligible[0].id);
          } catch {
            // The api client already surfaced the error notification.
          }
        },
      },
      {
        key: "mark-awaiting-payment",
        label: "Desfazer pagamento",
        icon: <IconHourglass className="h-4 w-4" />,
        requiredPrivilege: PAYMENT_MANAGERS,
        hidden: (rows) => !rows.some((o) => o.paymentStatus === ORDER_PAYMENT_STATUS.PAID),
        onClick: async (rows) => {
          const eligible = rows.filter((o) => o.paymentStatus === ORDER_PAYMENT_STATUS.PAID);
          if (eligible.length === 0) return;
          try {
            if (eligible.length > 1) await batchMarkAwaitingPaymentAsync({ orderIds: eligible.map((o) => o.id) });
            else await markAwaitingPaymentAsync(eligible[0].id);
          } catch {
            // The api client already surfaced the error notification.
          }
        },
      },
      // --- delete (ADMIN only) ---
      {
        key: "delete",
        label: "Deletar",
        icon: <IconTrash className="h-4 w-4" />,
        variant: "destructive",
        separatorBefore: true,
        requiredPrivilege: SECTOR_PRIVILEGES.ADMIN,
        onClick: (rows) => setDeleteDialog(rows),
      },
    ],
    [navigate, runUpdate, runStatusUpdate, batchMarkPaidAsync, markPaidAsync, batchMarkAwaitingPaymentAsync, markAwaitingPaymentAsync],
  );

  // --- declarative filters (server mode: values are mapped by buildOrderQuery) ---
  const filterDefs = useMemo<DataTableFilterDef<Order>[]>(
    () => [
      {
        key: "status",
        label: "Status",
        type: "multiselect",
        options: Object.values(ORDER_STATUS).map((s) => ({ value: s, label: ORDER_STATUS_LABELS[s] })),
      },
      {
        key: "paymentStatus",
        label: "Status de Pagamento",
        type: "multiselect",
        requiredPrivilege: ORDER_PRICE_VIEWERS,
        options: Object.values(ORDER_PAYMENT_STATUS).map((s) => ({ value: s, label: ORDER_PAYMENT_STATUS_LABELS[s] })),
      },
      {
        key: "supplierId",
        label: "Fornecedor",
        type: "multiselect",
        options: supplierOptions,
      },
      { key: "createdAt", label: "Período de criação", type: "date-range" },
      { key: "forecast", label: "Previsão de entrega", type: "date-range" },
      { key: "updatedAt", label: "Data de conclusão", type: "date-range" },
    ],
    [supplierOptions],
  );

  return (
    <div className="flex h-full flex-col">
      {error ? (
        <div className="mx-4 mt-4 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <IconAlertTriangle className="h-4 w-4 shrink-0" />
          Não foi possível carregar os pedidos. Tente novamente.
        </div>
      ) : null}

      <div className="min-h-0 flex-1">
        <DataTablePage<Order>
        title="Pedidos"
        favoritePage={FAVORITE_PAGES.ESTOQUE_PEDIDOS_LISTAR}
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Estoque", href: routes.inventory.root },
          { label: "Pedidos" },
        ]}
        actions={[
          {
            key: "create",
            label: "Cadastrar",
            icon: IconPlus,
            onClick: () => navigate(routes.inventory.orders.create),
            variant: "default",
          },
        ]}
        table={{
          tableId: "orders-list",
          data: orders,
          columns,
          filterDefs,
          rowActions,
          getRowId: (o) => o.id,
          onRowClick,
          isLoading,
          mode: "server",
          rowCount: totalRecords,
          onParamsChange,
          onExportFetchAll: fetchAllForExport,
          defaultSorting: [
            { id: "status", desc: false },
            { id: "createdAt", desc: true },
          ],
          defaultPageSize: ORDER_DEFAULT_PAGE_SIZE,
          sectorDefaults: ORDER_SECTOR_DEFAULTS,
          estimateRowHeight: 44,
          searchPlaceholder: "Buscar por código, fornecedor...",
          emptyMessage: "Nenhum pedido encontrado. Ajuste os filtros ou crie um novo pedido.",
          exportTitle: "Pedidos",
          exportFilename: "pedidos",
        }}
        />
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog && deleteDialog.length > 1
                ? `Tem certeza que deseja excluir ${deleteDialog.length} pedidos? Esta ação não pode ser desfeita.`
                : `Tem certeza que deseja excluir o pedido ${deleteDialog?.[0]?.id.slice(-8) ?? ""}? Esta ação não pode ser desfeita.`}
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

      {/* Cancel-order confirmation */}
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
