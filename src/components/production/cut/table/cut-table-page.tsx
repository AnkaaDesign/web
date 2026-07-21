import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { arrayMove } from "@dnd-kit/sortable";
import { IconExternalLink, IconPlayerPlay, IconCheck, IconScissors, IconTrash, IconAlertTriangle, IconPlus } from "@tabler/icons-react";
import { DataTablePage } from "@/components/ui/datatable";
import { usePrivileges } from "@/hooks/common/use-privileges";
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
import { useCuts, useCutMutations, useCutBatchMutations } from "../../../../hooks";
import { getCuts } from "@/api-client";
import { useAuth } from "@/contexts/auth-context";
import { canRequestCut, canCreateCuts } from "@/utils/permissions/entity-permissions";
import type { Cut } from "../../../../types";
import {
  routes,
  FAVORITE_PAGES,
  SECTOR_PRIVILEGES,
  CUT_STATUS,
  CUT_STATUS_LABELS,
  CUT_TYPE,
  CUT_TYPE_LABELS,
  CUT_ORIGIN,
  CUT_ORIGIN_LABELS,
  CUT_REQUEST_REASON,
} from "../../../../constants";
import { CutRequestModal } from "../list/cut-request-modal";
import { createCutColumns, CUT_SECTOR_DEFAULTS } from "./cut-table-columns";

// Trimmed include — only what the columns render (task name, file thumbnail/name, recut parent file).
const LIST_INCLUDE = {
  task: { include: { customer: true } },
  file: true,
  parentCut: { include: { file: true } },
} as const;

// Roles allowed to change cut status (start/finish) — mirrors canManageCutStatus / API PUT /cuts/:id.
const CUT_STATUS_MANAGERS = [SECTOR_PRIVILEGES.DESIGNER, SECTOR_PRIVILEGES.PLOTTING, SECTOR_PRIVILEGES.WAREHOUSE];
// Roles allowed to delete cuts — mirrors canDeleteCuts / API DELETE /cuts/:id (ADMIN always passes).
const CUT_DELETERS = [SECTOR_PRIVILEGES.DESIGNER];

// The API caps `limit` at 100, so the list is server-paginated (page/limit/sort/filters all go to the
// server). Page + sort ride the URL the DataTable writes in server mode; search + filters arrive via
// `onParamsChange`.
const CUT_DEFAULT_PAGE_SIZE = 40;
const EMPTY_PARAMS: { search: string; filters: DataTableFilterValues } = { search: "", filters: {} };

/** column id → API orderBy entry. Columns without a server-sortable field are omitted (sort ignored). */
const CUT_SORT_FIELD_MAP: Record<string, (dir: "asc" | "desc") => Record<string, unknown>> = {
  taskName: (d) => ({ task: { name: d } }),
  status: (d) => ({ statusOrder: d }),
  startedAt: (d) => ({ startedAt: d }),
  completedAt: (d) => ({ completedAt: d }),
};

function buildCutOrderBy(sorting: { id: string; desc: boolean }[]): Record<string, unknown> | Record<string, unknown>[] {
  const entries = sorting.map((s) => CUT_SORT_FIELD_MAP[s.id]?.(s.desc ? "desc" : "asc")).filter((e): e is Record<string, unknown> => !!e);
  if (entries.length === 0) return { statusOrder: "asc" };
  return entries.length === 1 ? entries[0] : entries;
}

// The "queue" ordering that drag-reorder operates on: status groups first, then the user-defined
// `priority` within each group, then createdAt, then `id` as a FULLY-UNIQUE final tiebreak. Without the
// `id` key, cuts that tie on (statusOrder, priority, createdAt) — e.g. a fresh queue where everything
// defaults to priority 0 and a batch-created recut shares one transaction timestamp — come back from
// Postgres in unspecified physical order, which reshuffles run-to-run (the "messy reorder" symptom).
// Reorder is ONLY offered while this is the active sort; an ad-hoc column sort disables the grab.
const QUEUE_ORDER_BY: Record<string, unknown>[] = [{ statusOrder: "asc" }, { priority: "asc" }, { createdAt: "asc" }, { id: "asc" }];

// Spacing used when (re)seeding priorities so there's room to drop between neighbours later.
const PRIORITY_STEP = 1000;
// Distinct-enough gap: below this we treat two neighbour priorities as "equal" and reseed the group.
const PRIORITY_EPSILON = 1e-6;

/** Is the current sort the default queue order (empty, or the status-asc the table starts with)? */
function isQueueSort(sorting: { id: string; desc: boolean }[]): boolean {
  return sorting.length === 0 || (sorting.length === 1 && sorting[0].id === "status" && !sorting[0].desc);
}

/** Nearest cuts sharing `status` immediately before/after `index` in the given order. */
function sameStatusNeighbors(rows: Cut[], index: number, status: Cut["status"]): { prev?: Cut; next?: Cut } {
  let prev: Cut | undefined;
  let next: Cut | undefined;
  for (let i = index - 1; i >= 0; i--) {
    if (rows[i].status === status) {
      prev = rows[i];
      break;
    }
  }
  for (let i = index + 1; i < rows.length; i++) {
    if (rows[i].status === status) {
      next = rows[i];
      break;
    }
  }
  return { prev, next };
}

function dateRange(v: unknown): { gte?: Date; lte?: Date } | undefined {
  if (!v || typeof v !== "object") return undefined;
  const { from, to } = v as { from?: string; to?: string };
  if (!from && !to) return undefined;
  return { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) };
}

/** Map the declarative filter values + global search onto the cut GET query (server mode). */
function buildCutQuery(filters: DataTableFilterValues, search: string): Record<string, unknown> {
  const q: Record<string, unknown> = {};
  // Convenience array filters (mapped to `where` by the cut schema transform).
  const status = filters.status;
  if (Array.isArray(status) && status.length > 0) q.status = status;
  const type = filters.type;
  if (Array.isArray(type) && type.length > 0) q.type = type;
  const origin = filters.origin;
  if (Array.isArray(origin) && origin.length > 0) q.origin = origin;
  // Date-range filters have no convenience alias → go straight onto `where`.
  const where: Record<string, unknown> = {};
  const started = dateRange(filters.startedAt);
  if (started) where.startedAt = started;
  const completed = dateRange(filters.completedAt);
  if (completed) where.completedAt = completed;
  if (Object.keys(where).length > 0) q.where = where;
  if (search) q.searchingFor = search;
  return q;
}

export function CutTablePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { createAsync, updateAsync, deleteAsync } = useCutMutations();
  const { batchCreateAsync, batchUpdateAsync, batchDeleteAsync } = useCutBatchMutations();

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
  const pageSizeRaw = Number(searchParams.get("pageSize") ?? String(CUT_DEFAULT_PAGE_SIZE));
  const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : CUT_DEFAULT_PAGE_SIZE;
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

  // Queue order (status → priority → createdAt) when the user hasn't picked an ad-hoc column sort;
  // otherwise honour their chosen column. Drag-reorder is only enabled in the queue-order case.
  const queueSort = isQueueSort(sorting);
  // Memoized so the non-queue branch (which builds a fresh object) doesn't churn the query each render.
  const orderBy = useMemo(() => (queueSort ? QUEUE_ORDER_BY : buildCutOrderBy(sorting)), [queueSort, sorting]);

  const query = useMemo(
    () => ({
      ...buildCutQuery(params.filters, params.search),
      page,
      limit: pageSize,
      orderBy,
      include: LIST_INCLUDE,
    }),
    [params, page, pageSize, orderBy],
  );

  const { data: response, isLoading, error } = useCuts(query as never);
  const cuts = useMemo(() => (response as { data?: Cut[] } | undefined)?.data ?? [], [response]);
  const totalRecords = (response as { meta?: { totalRecords?: number } } | undefined)?.meta?.totalRecords ?? 0;

  // Export "all": page through every cut matching the current search/filters/sort (the table only
  // holds the current page). The API caps `limit` at 100, so page through the full set.
  const fetchAllForExport = useCallback(async (): Promise<Cut[]> => {
    const PAGE_SIZE = 100;
    const baseQuery = {
      ...buildCutQuery(params.filters, params.search),
      orderBy,
      include: LIST_INCLUDE,
    };
    const all: Cut[] = [];
    for (let page = 1; ; page++) {
      const res = (await getCuts({ ...baseQuery, page, limit: PAGE_SIZE } as never)) as
        | { data?: Cut[]; meta?: { hasNextPage?: boolean } }
        | undefined;
      const rows = res?.data ?? [];
      all.push(...rows);
      if (res?.meta?.hasNextPage === false || rows.length < PAGE_SIZE) break;
      if (totalRecords > 0 && all.length >= totalRecords) break;
    }
    return all;
  }, [params, orderBy, totalRecords]);

  // --- drag-to-reorder (priority within a status group) ---
  const { canAccess } = usePrivileges();
  // Only roles that can PUT /cuts (status managers) may persist a reorder — mirrors the endpoint guard.
  const canReorder = canAccess(CUT_STATUS_MANAGERS);
  // Optimistic order applied immediately on drop; cleared when fresh server data arrives (the refetch
  // triggered by the mutation returns the rows already in the new priority order).
  const [orderOverride, setOrderOverride] = useState<Cut[] | null>(null);
  // The optimistic paint must survive UNRELATED refetches (window-focus, sibling `cutKeys.all`
  // invalidations) but be dropped once the server reflects our own reorder write. Clearing on EVERY
  // `response` change (the old behavior) let any stray refetch snap the queue back to the pre-write
  // order — the "doesn't stay where I leave it" symptom. Instead, clear only on the first `response`
  // that arrives AFTER a reorder mutation settled: by then the PUT is persisted, so the incoming server
  // data already includes our change (and a cross-status drop correctly falls back to server truth).
  const clearOverrideOnNextResponse = useRef(false);
  useEffect(() => {
    if (clearOverrideOnNextResponse.current) {
      clearOverrideOnNextResponse.current = false;
      setOrderOverride(null);
    }
  }, [response]);
  const tableData = orderOverride ?? cuts;
  // Read the on-screen order without re-creating the drop handler on every data change.
  const tableDataRef = useRef(tableData);
  tableDataRef.current = tableData;

  const handleReorder = useCallback(
    async (activeId: string, overId: string) => {
      const current = tableDataRef.current;
      const from = current.findIndex((c) => c.id === activeId);
      const to = current.findIndex((c) => c.id === overId);
      if (from < 0 || to < 0 || from === to) return;

      const moved = current[from];
      const reordered = arrayMove(current, from, to);

      // Recompute the moved cut's priority from its same-status neighbours (status stays primary, so a
      // cross-status drop self-corrects on refetch — but we still keep priority within its own group).
      const newIndex = reordered.findIndex((c) => c.id === activeId);
      const { prev, next } = sameStatusNeighbors(reordered, newIndex, moved.status);
      const pPrev = prev?.priority;
      const pNext = next?.priority;

      // Only cut in its status group → the drop can't change any within-status order; bail BEFORE
      // painting an override (otherwise it'd stick, since no mutation → no refetch to clear it).
      if (pPrev == null && pNext == null) return;

      setOrderOverride(reordered); // paint the new order instantly

      let newPriority: number | null = null;
      if (pPrev != null && pNext != null) {
        // Midpoint — unless the neighbours are effectively equal (e.g. a fresh queue of all-0s), in
        // which case there's no room to insert between them and we reseed the whole group below.
        newPriority = pNext - pPrev > PRIORITY_EPSILON ? (pPrev + pNext) / 2 : null;
      } else if (pPrev != null) {
        newPriority = pPrev + PRIORITY_STEP;
      } else {
        newPriority = (pNext as number) - PRIORITY_STEP;
      }

      try {
        if (newPriority != null) {
          await updateAsync({ id: moved.id, data: { priority: newPriority } as never });
        } else {
          // Reseed: spread the status group over PRIORITY_STEP gaps in its new order, writing only the
          // rows whose value actually changes.
          const group = reordered.filter((c) => c.status === moved.status);
          const updates = group
            .map((c, i) => ({ id: c.id, priority: i * PRIORITY_STEP }))
            .filter((u) => {
              const existing = group.find((c) => c.id === u.id);
              return existing && existing.priority !== u.priority;
            });
          if (updates.length > 0) await batchUpdateAsync({ cuts: updates as never });
        }
        // Write persisted — arm the override to clear on the next server response (which now reflects it).
        clearOverrideOnNextResponse.current = true;
      } catch {
        // The api client already surfaced the error; drop the optimistic order so the UI reflects reality.
        setOrderOverride(null);
      }
    },
    [updateAsync, batchUpdateAsync],
  );

  // Grab is offered only in queue order and only to roles that can persist it.
  const rowReorder = useMemo(
    () => (queueSort && canReorder ? { onReorder: (a: string, b: string) => void handleReorder(a, b) } : undefined),
    [queueSort, canReorder, handleReorder],
  );

  const columns = useMemo(() => createCutColumns(), []);

  // Row → detail; hand over the visible cut order so the detail page can page prev/next.
  const onRowClick = useCallback(
    (cut: Cut, meta: DataTableRowClickMeta) => {
      navigate(routes.production.cutting.details(cut.id), { state: { ids: meta.orderedIds } });
    },
    [navigate],
  );

  // --- dialogs + request modal (hosted once at page level) ---
  const [deleteDialog, setDeleteDialog] = useState<Cut[] | null>(null);
  const [requestCut, setRequestCut] = useState<Cut | null>(null);

  // Apply a single status transition (+ its timestamp) to N cuts: PUT /cuts/batch when several are
  // eligible, the single-cut endpoint when only one is.
  const runStatusUpdate = useCallback(
    async (rows: Cut[], patch: { status: CUT_STATUS; startedAt?: Date; completedAt?: Date }) => {
      if (rows.length === 0) return;
      try {
        if (rows.length > 1) {
          await batchUpdateAsync({ cuts: rows.map((c) => ({ id: c.id, ...patch })) as never });
        } else {
          await updateAsync({ id: rows[0].id, data: patch as never });
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
      if (items.length > 1) await batchDeleteAsync({ cutIds: items.map((c) => c.id) });
      else await deleteAsync(items[0].id);
    } catch {
      // The api client already surfaced the error notification.
    } finally {
      setDeleteDialog(null);
    }
  }, [deleteDialog, batchDeleteAsync, deleteAsync]);

  // Create N recut requests from the selected cut (bulk when quantity > 1).
  const handleSubmitRequest = useCallback(
    async (data: { quantity: number; reason: CUT_REQUEST_REASON }) => {
      if (!requestCut) return;
      const cutsToCreate = Array.from({ length: data.quantity }, () => ({
        fileId: requestCut.fileId,
        type: requestCut.type,
        origin: CUT_ORIGIN.REQUEST,
        reason: data.reason,
        parentCutId: requestCut.id,
        taskId: requestCut.taskId,
      }));
      try {
        if (cutsToCreate.length > 1) await batchCreateAsync({ cuts: cutsToCreate } as never);
        else await createAsync(cutsToCreate[0] as never);
        setRequestCut(null);
      } catch {
        // The api client already surfaced the error notification.
      }
    },
    [requestCut, batchCreateAsync, createAsync],
  );

  const rowActions = useMemo<DataTableRowAction<Cut>[]>(
    () => [
      {
        key: "open-new-tab",
        label: "Abrir em nova guia",
        icon: <IconExternalLink className="h-4 w-4" />,
        hidden: (rows) => rows.length !== 1,
        onClick: (rows) => rows[0] && window.open(routes.production.cutting.details(rows[0].id), "_blank"),
      },
      {
        key: "start",
        label: "Iniciar corte",
        icon: <IconPlayerPlay className="h-4 w-4" />,
        requiredPrivilege: CUT_STATUS_MANAGERS,
        // Shown whenever at least one selected cut is still pending.
        hidden: (rows) => !rows.some((c) => c.status === CUT_STATUS.PENDING),
        onClick: (rows) =>
          void runStatusUpdate(
            rows.filter((c) => c.status === CUT_STATUS.PENDING),
            { status: CUT_STATUS.CUTTING, startedAt: new Date() },
          ),
      },
      {
        key: "finish",
        label: "Finalizar corte",
        icon: <IconCheck className="h-4 w-4" />,
        requiredPrivilege: CUT_STATUS_MANAGERS,
        // Shown whenever at least one selected cut is currently being cut.
        hidden: (rows) => !rows.some((c) => c.status === CUT_STATUS.CUTTING),
        onClick: (rows) =>
          void runStatusUpdate(
            rows.filter((c) => c.status === CUT_STATUS.CUTTING),
            { status: CUT_STATUS.COMPLETED, completedAt: new Date() },
          ),
      },
      {
        key: "request",
        label: "Solicitar novo corte",
        icon: <IconScissors className="h-4 w-4" />,
        separatorBefore: true,
        // canRequestCut carries the team-leader nuance a static privilege gate can't express.
        hidden: (rows) => rows.length !== 1 || rows[0].status === CUT_STATUS.COMPLETED || !canRequestCut(user),
        onClick: (rows) => rows[0] && setRequestCut(rows[0]),
      },
      {
        key: "delete",
        label: "Excluir",
        icon: <IconTrash className="h-4 w-4" />,
        variant: "destructive",
        separatorBefore: true,
        requiredPrivilege: CUT_DELETERS,
        onClick: (rows) => setDeleteDialog(rows),
      },
    ],
    [runStatusUpdate, user],
  );

  // --- declarative filters (server mode: values are mapped by buildCutQuery) ---
  const filterDefs = useMemo<DataTableFilterDef<Cut>[]>(
    () => [
      {
        key: "status",
        label: "Status",
        type: "multiselect",
        options: Object.values(CUT_STATUS).map((s) => ({ value: s, label: CUT_STATUS_LABELS[s] })),
      },
      {
        key: "type",
        label: "Tipo de Corte",
        type: "multiselect",
        options: Object.values(CUT_TYPE).map((t) => ({ value: t, label: CUT_TYPE_LABELS[t] })),
      },
      {
        key: "origin",
        label: "Origem",
        type: "multiselect",
        options: Object.values(CUT_ORIGIN).map((o) => ({ value: o, label: CUT_ORIGIN_LABELS[o] })),
      },
      { key: "startedAt", label: "Iniciado em", type: "date-range" },
      { key: "completedAt", label: "Finalizado em", type: "date-range" },
    ],
    [],
  );

  return (
    <div className="flex h-full flex-col">
      {error ? (
        <div className="mx-4 mt-4 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <IconAlertTriangle className="h-4 w-4 shrink-0" />
          Não foi possível carregar os cortes. Tente novamente.
        </div>
      ) : null}

      <div className="min-h-0 flex-1">
        <DataTablePage<Cut>
          title="Cortes"
          favoritePage={FAVORITE_PAGES.PRODUCAO_RECORTE_LISTAR}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Produção", href: routes.production.root },
            { label: "Cortes" },
          ]}
          actions={
            canCreateCuts(user)
              ? [
                  {
                    key: "create",
                    label: "Adicionar",
                    icon: IconPlus,
                    onClick: () => navigate(routes.production.cutting.create),
                    variant: "default",
                  },
                ]
              : []
          }
          table={{
            tableId: "cutting-list",
            data: tableData,
            columns,
            filterDefs,
            rowActions,
            rowReorder,
            getRowId: (c) => c.id,
            onRowClick,
            isLoading,
            mode: "server",
            rowCount: totalRecords,
            onParamsChange,
            onExportFetchAll: fetchAllForExport,
            defaultSorting: [{ id: "status", desc: false }],
            defaultPageSize: CUT_DEFAULT_PAGE_SIZE,
            sectorDefaults: CUT_SECTOR_DEFAULTS,
            estimateRowHeight: 60,
            searchPlaceholder: "Buscar por tarefa ou cliente...",
            emptyMessage: "Nenhum item de corte encontrado.",
            exportTitle: "Cortes",
            exportFilename: "cortes",
          }}
        />
      </div>

      {/* Recut request modal */}
      <CutRequestModal open={!!requestCut} onOpenChange={(open) => !open && setRequestCut(null)} onSubmit={handleSubmitRequest} cutItem={requestCut} />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteDialog && deleteDialog.length > 1 ? "Excluir cortes" : "Excluir corte"}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog && deleteDialog.length > 1
                ? `Tem certeza que deseja excluir ${deleteDialog.length} cortes? Esta ação não pode ser desfeita.`
                : "Tem certeza que deseja excluir este corte? Esta ação não pode ser desfeita."}
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
