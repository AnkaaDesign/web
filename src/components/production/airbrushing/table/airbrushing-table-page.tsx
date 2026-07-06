import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { IconPlus, IconExternalLink, IconEdit, IconProgressCheck, IconTrash, IconAlertTriangle } from "@tabler/icons-react";
import { DataTablePage } from "@/components/ui/datatable";
import type { DataTableRowAction, DataTableFilterDef, DataTableRowClickMeta, DataTableFilterValues } from "@/components/ui/datatable";
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
import { useAirbrushings, useAirbrushingMutations, useAirbrushingBatchMutations, useTasks, useUsers } from "../../../../hooks";
import { getAirbrushings } from "@/api-client";
import type { Airbrushing } from "../../../../types";
import {
  routes,
  FAVORITE_PAGES,
  SECTOR_PRIVILEGES,
  AIRBRUSHING_STATUS,
  AIRBRUSHING_STATUS_LABELS,
  AIRBRUSHING_PAYMENT_STATUS,
  AIRBRUSHING_PAYMENT_STATUS_LABELS,
} from "../../../../constants";
import { canCreateAirbrushings } from "@/utils/permissions/entity-permissions";
import { useAuth } from "@/contexts/auth-context";
import { createAirbrushingColumns, AIRBRUSHING_MONEY_VIEWERS } from "./airbrushing-table-columns";
import { SetStatusModal } from "./set-status-modal";

// Trimmed include — only what the columns render (task name + customer, painter name). NOTE: the
// layouts count column is intentionally omitted (the API include has no `_count`, so counting would
// require fetching every layouts File[] — a heavy payload for a single number).
const LIST_INCLUDE = {
  task: { include: { customer: true } },
  painter: true,
} as const;

// Sectors allowed to create/edit/delete/change-status of an airbrushing — mirrors
// canEdit/canDelete/canCreateAirbrushings (ADMIN, COMMERCIAL, FINANCIAL). ADMIN always passes the gate.
const AIRBRUSHING_MANAGE_PRIVILEGES = [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.FINANCIAL];

// The API caps `limit` at 100, so the list is server-paginated (page/limit/sort/filters all go to the
// server). Page + sort ride the URL the DataTable writes in server mode; search + filters arrive via
// `onParamsChange`.
const AIRBRUSHING_DEFAULT_PAGE_SIZE = 40;
const EMPTY_PARAMS: { search: string; filters: DataTableFilterValues } = { search: "", filters: {} };

/** column id → API orderBy entry. Columns without a server-sortable field are omitted (sort ignored). */
const AIRBRUSHING_SORT_FIELD_MAP: Record<string, (dir: "asc" | "desc") => Record<string, unknown>> = {
  taskName: (d) => ({ task: { name: d } }),
  customer: (d) => ({ task: { customer: { fantasyName: d } } }),
  painter: (d) => ({ painter: { name: d } }),
  status: (d) => ({ statusOrder: d }),
  paymentStatus: (d) => ({ paymentStatus: d }),
  price: (d) => ({ price: d }),
  startDate: (d) => ({ startDate: d }),
  finishDate: (d) => ({ finishDate: d }),
  startedAt: (d) => ({ startedAt: d }),
  finishedAt: (d) => ({ finishedAt: d }),
  createdAt: (d) => ({ createdAt: d }),
};

function buildAirbrushingOrderBy(sorting: { id: string; desc: boolean }[]): Record<string, unknown> | Record<string, unknown>[] {
  const entries = sorting.map((s) => AIRBRUSHING_SORT_FIELD_MAP[s.id]?.(s.desc ? "desc" : "asc")).filter((e): e is Record<string, unknown> => !!e);
  if (entries.length === 0) return [{ statusOrder: "asc" }, { createdAt: "desc" }];
  return entries.length === 1 ? entries[0] : entries;
}

function dateRange(v: unknown): { gte?: Date; lte?: Date } | undefined {
  if (!v || typeof v !== "object") return undefined;
  const { from, to } = v as { from?: string; to?: string };
  if (!from && !to) return undefined;
  return { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) };
}

function numberRange(v: unknown): { min?: number; max?: number } | undefined {
  if (!v || typeof v !== "object") return undefined;
  const { min, max } = v as { min?: number; max?: number };
  if (min == null && max == null) return undefined;
  return { ...(min != null ? { min } : {}), ...(max != null ? { max } : {}) };
}

/** The generic `boolean` filter emits "true"/"false" (or undefined for "Todos"). */
function boolFilter(v: unknown): boolean | undefined {
  if (v === true || v === "true") return true;
  if (v === false || v === "false") return false;
  return undefined;
}

/** Map the declarative filter values + global search onto the airbrushing GET query (server mode). */
function buildAirbrushingQuery(filters: DataTableFilterValues, search: string): Record<string, unknown> {
  const q: Record<string, unknown> = {};
  const status = filters.status;
  if (Array.isArray(status) && status.length > 0) q.status = status;
  const pay = filters.paymentStatus;
  if (Array.isArray(pay) && pay.length > 0) q.paymentStatuses = pay;
  const tasks = filters.taskIds;
  if (Array.isArray(tasks) && tasks.length > 0) q.taskIds = tasks;
  const painters = filters.painterIds;
  if (Array.isArray(painters) && painters.length > 0) q.painterIds = painters;
  const price = numberRange(filters.priceRange);
  if (price) q.priceRange = price;
  const hasStart = boolFilter(filters.hasStartDate);
  if (hasStart !== undefined) q.hasStartDate = hasStart;
  const hasFinish = boolFilter(filters.hasFinishDate);
  if (hasFinish !== undefined) q.hasFinishDate = hasFinish;
  const created = dateRange(filters.createdAt);
  if (created) q.createdAt = created;
  if (search) q.searchingFor = search;
  return q;
}

export function AirbrushingTablePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { updateAsync, deleteAsync } = useAirbrushingMutations();
  const { batchUpdateAsync, batchDeleteAsync } = useAirbrushingBatchMutations();

  const canCreate = canCreateAirbrushings(user);

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
  const pageSizeRaw = Number(searchParams.get("pageSize") ?? String(AIRBRUSHING_DEFAULT_PAGE_SIZE));
  const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : AIRBRUSHING_DEFAULT_PAGE_SIZE;
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
      ...buildAirbrushingQuery(params.filters, params.search),
      page,
      limit: pageSize,
      orderBy: buildAirbrushingOrderBy(sorting),
      include: LIST_INCLUDE,
    }),
    [params, page, pageSize, sorting],
  );

  const { data: response, isLoading, error } = useAirbrushings(query as never);
  const airbrushings = useMemo(() => (response as { data?: Airbrushing[] } | undefined)?.data ?? [], [response]);
  const totalRecords = (response as { meta?: { totalRecords?: number } } | undefined)?.meta?.totalRecords ?? 0;

  // Export "all": re-page the whole filtered set (the table only holds the current page). The API caps
  // `limit` at 100, so page through it rather than requesting everything at once.
  const fetchAllForExport = useCallback(async (): Promise<Airbrushing[]> => {
    const PAGE_SIZE = 100;
    const baseQuery = {
      ...buildAirbrushingQuery(params.filters, params.search),
      orderBy: buildAirbrushingOrderBy(sorting),
      include: LIST_INCLUDE,
    };
    const all: Airbrushing[] = [];
    for (let p = 1; ; p++) {
      const res = (await getAirbrushings({ ...baseQuery, page: p, limit: PAGE_SIZE } as never)) as
        | { data?: Airbrushing[]; meta?: { hasNextPage?: boolean } }
        | undefined;
      const rows = res?.data ?? [];
      all.push(...rows);
      if (res?.meta?.hasNextPage === false || rows.length < PAGE_SIZE) break;
      if (totalRecords > 0 && all.length >= totalRecords) break;
    }
    return all;
  }, [params, sorting, totalRecords]);

  // Filter options (loaded once; API caps limit at 100).
  const { data: tasksData } = useTasks({ orderBy: { name: "asc" }, limit: 100 });
  const taskOptions = useMemo(
    () => ((tasksData as { data?: Array<{ id: string; name: string }> } | undefined)?.data ?? []).map((t) => ({ value: t.id, label: t.name })),
    [tasksData],
  );

  const { data: usersData } = useUsers({ orderBy: { name: "asc" }, limit: 100 } as never);
  const painterOptions = useMemo(
    () => ((usersData as { data?: Array<{ id: string; name: string }> } | undefined)?.data ?? []).map((u) => ({ value: u.id, label: u.name })),
    [usersData],
  );

  const columns = useMemo(() => createAirbrushingColumns(), []);

  // Row → detail; hand over the visible ids so the detail page can page prev/next.
  const onRowClick = useCallback(
    (airbrushing: Airbrushing, meta: DataTableRowClickMeta) => {
      navigate(routes.production.airbrushings.details(airbrushing.id), { state: { ids: meta.orderedIds } });
    },
    [navigate],
  );

  // --- confirmation / status dialogs (hosted once at page level) ---
  const [deleteDialog, setDeleteDialog] = useState<Airbrushing[] | null>(null);
  const [statusDialog, setStatusDialog] = useState<Airbrushing[] | null>(null);

  const confirmDelete = useCallback(async () => {
    const items = deleteDialog;
    if (!items?.length) return;
    try {
      if (items.length > 1) await batchDeleteAsync({ airbrushingIds: items.map((a) => a.id) });
      else await deleteAsync(items[0].id);
    } catch {
      // The api client already surfaced the error notification.
    } finally {
      setDeleteDialog(null);
    }
  }, [deleteDialog, batchDeleteAsync, deleteAsync]);

  // Apply one status to N selected airbrushings: batch endpoint when several, single endpoint when one.
  const confirmStatus = useCallback(
    async (status: AIRBRUSHING_STATUS) => {
      const rows = statusDialog;
      if (!rows?.length) {
        setStatusDialog(null);
        return;
      }
      try {
        if (rows.length > 1) {
          await batchUpdateAsync({ airbrushings: rows.map((a) => ({ id: a.id, data: { status } })) } as never);
        } else {
          await updateAsync({ id: rows[0].id, data: { status } as never });
        }
      } catch {
        // The api client already surfaced the error notification.
      } finally {
        setStatusDialog(null);
      }
    },
    [statusDialog, batchUpdateAsync, updateAsync],
  );

  const rowActions = useMemo<DataTableRowAction<Airbrushing>[]>(
    () => [
      {
        key: "open-new-tab",
        label: "Abrir em nova guia",
        icon: <IconExternalLink className="h-4 w-4" />,
        hidden: (rows) => rows.length !== 1,
        onClick: (rows) => rows[0] && window.open(routes.production.airbrushings.details(rows[0].id), "_blank"),
      },
      {
        key: "edit",
        label: "Editar",
        icon: <IconEdit className="h-4 w-4" />,
        requiredPrivilege: AIRBRUSHING_MANAGE_PRIVILEGES,
        hidden: (rows) => rows.length !== 1,
        onClick: (rows) => rows[0] && navigate(routes.production.airbrushings.edit(rows[0].id)),
      },
      {
        key: "set-status",
        label: "Alterar status",
        icon: <IconProgressCheck className="h-4 w-4" />,
        separatorBefore: true,
        requiredPrivilege: AIRBRUSHING_MANAGE_PRIVILEGES,
        hidden: (rows) => rows.length === 0,
        onClick: (rows) => setStatusDialog(rows),
      },
      {
        key: "delete",
        label: "Excluir",
        icon: <IconTrash className="h-4 w-4" />,
        variant: "destructive",
        separatorBefore: true,
        requiredPrivilege: AIRBRUSHING_MANAGE_PRIVILEGES,
        onClick: (rows) => setDeleteDialog(rows),
      },
    ],
    [navigate],
  );

  // --- declarative filters (server mode: values are mapped by buildAirbrushingQuery) ---
  const filterDefs = useMemo<DataTableFilterDef<Airbrushing>[]>(
    () => [
      {
        key: "status",
        label: "Status",
        type: "multiselect",
        options: Object.values(AIRBRUSHING_STATUS).map((s) => ({ value: s, label: AIRBRUSHING_STATUS_LABELS[s] })),
      },
      {
        key: "paymentStatus",
        label: "Status de Pagamento",
        type: "multiselect",
        requiredPrivilege: AIRBRUSHING_MONEY_VIEWERS,
        options: Object.values(AIRBRUSHING_PAYMENT_STATUS).map((s) => ({ value: s, label: AIRBRUSHING_PAYMENT_STATUS_LABELS[s] })),
      },
      { key: "taskIds", label: "Tarefa", type: "multiselect", options: taskOptions },
      { key: "painterIds", label: "Pintor", type: "multiselect", options: painterOptions },
      {
        key: "priceRange",
        label: "Faixa de preço",
        type: "number-range",
        currency: true,
        requiredPrivilege: AIRBRUSHING_MONEY_VIEWERS,
      },
      { key: "hasStartDate", label: "Tem data de início", type: "boolean" },
      { key: "hasFinishDate", label: "Tem data de término", type: "boolean" },
      { key: "createdAt", label: "Período de criação", type: "date-range" },
    ],
    [taskOptions, painterOptions],
  );

  return (
    <div className="flex h-full flex-col">
      {error ? (
        <div className="mx-4 mt-4 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <IconAlertTriangle className="h-4 w-4 shrink-0" />
          Não foi possível carregar as aerografias. Tente novamente.
        </div>
      ) : null}

      <div className="min-h-0 flex-1">
        <DataTablePage<Airbrushing>
          title="Aerografia"
          favoritePage={FAVORITE_PAGES.PRODUCAO_AEROGRAFIA_LISTAR}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Produção", href: routes.production.root },
            { label: "Aerografia" },
          ]}
          actions={
            canCreate
              ? [
                  {
                    key: "create",
                    label: "Nova Aerografia",
                    icon: IconPlus,
                    onClick: () => navigate(routes.production.airbrushings.create),
                    variant: "default",
                  },
                ]
              : []
          }
          table={{
            tableId: "airbrushings-list",
            data: airbrushings,
            columns,
            filterDefs,
            rowActions,
            getRowId: (a) => a.id,
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
            defaultPageSize: AIRBRUSHING_DEFAULT_PAGE_SIZE,
            estimateRowHeight: 44,
            searchPlaceholder: "Buscar por tarefa, cliente...",
            emptyMessage: "Nenhuma aerografia encontrada. Ajuste os filtros ou crie uma nova aerografia.",
            exportTitle: "Aerografias",
            exportFilename: "aerografias",
          }}
        />
      </div>

      {/* Status change (single + bulk) */}
      {statusDialog && (
        <SetStatusModal
          open={!!statusDialog}
          onOpenChange={(open) => !open && setStatusDialog(null)}
          airbrushings={statusDialog}
          onConfirm={confirmStatus}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog && deleteDialog.length > 1
                ? `Tem certeza que deseja excluir ${deleteDialog.length} aerografias? Esta ação não pode ser desfeita.`
                : `Tem certeza que deseja excluir esta aerografia? Esta ação não pode ser desfeita.`}
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
    </div>
  );
}
