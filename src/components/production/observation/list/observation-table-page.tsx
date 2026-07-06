import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { IconPlus, IconExternalLink, IconEdit, IconTrash, IconAlertTriangle } from "@tabler/icons-react";
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
import { useObservations, useObservationMutations, useObservationBatchMutations, useTasks } from "../../../../hooks";
import { getObservations } from "@/api-client";
import type { Observation } from "../../../../types";
import { routes, FAVORITE_PAGES, SECTOR_PRIVILEGES } from "../../../../constants";
import { canCreateObservations } from "@/utils/permissions/entity-permissions";
import { useAuth } from "@/contexts/auth-context";
import { createObservationColumns } from "./observation-table-columns";

// Trimmed include — only what the columns render (task name + files count).
const LIST_INCLUDE = {
  task: true,
  files: true,
} as const;

// Sectors allowed to create/edit an observation — mirrors canCreateObservations / canEditObservations
// (ADMIN, COMMERCIAL, FINANCIAL, WAREHOUSE, PRODUCTION_MANAGER — PRODUCTION excluded, matches API).
const OBSERVATION_EDIT_PRIVILEGES = [
  SECTOR_PRIVILEGES.ADMIN,
  SECTOR_PRIVILEGES.COMMERCIAL,
  SECTOR_PRIVILEGES.FINANCIAL,
  SECTOR_PRIVILEGES.WAREHOUSE,
  SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
];
// Sectors allowed to delete an observation — mirrors canDeleteObservations (FINANCIAL, ADMIN). ADMIN always passes.
const OBSERVATION_DELETE_PRIVILEGES = [SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN];

// The API caps `limit` at 100, so the list is server-paginated (page/limit/sort/filters all go to the
// server). Page + sort ride the URL the DataTable writes in server mode; search + filters arrive via
// `onParamsChange`.
const OBSERVATION_DEFAULT_PAGE_SIZE = 40;
const EMPTY_PARAMS: { search: string; filters: DataTableFilterValues } = { search: "", filters: {} };

/** column id → API orderBy entry. Columns without a server-sortable field are omitted (sort ignored). */
const OBSERVATION_SORT_FIELD_MAP: Record<string, (dir: "asc" | "desc") => Record<string, unknown>> = {
  taskName: (d) => ({ task: { name: d } }),
  description: (d) => ({ description: d }),
  createdAt: (d) => ({ createdAt: d }),
  updatedAt: (d) => ({ updatedAt: d }),
};

function buildObservationOrderBy(sorting: { id: string; desc: boolean }[]): Record<string, unknown> | Record<string, unknown>[] {
  const entries = sorting.map((s) => OBSERVATION_SORT_FIELD_MAP[s.id]?.(s.desc ? "desc" : "asc")).filter((e): e is Record<string, unknown> => !!e);
  if (entries.length === 0) return { createdAt: "desc" };
  return entries.length === 1 ? entries[0] : entries;
}

function dateRange(v: unknown): { gte?: Date; lte?: Date } | undefined {
  if (!v || typeof v !== "object") return undefined;
  const { from, to } = v as { from?: string; to?: string };
  if (!from && !to) return undefined;
  return { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) };
}

/** The generic `boolean` filter emits "true"/"false" (or undefined for "Todos"). */
function boolFilter(v: unknown): boolean | undefined {
  if (v === true || v === "true") return true;
  if (v === false || v === "false") return false;
  return undefined;
}

/** Map the declarative filter values + global search onto the observation GET query (server mode). */
function buildObservationQuery(filters: DataTableFilterValues, search: string): Record<string, unknown> {
  const q: Record<string, unknown> = {};
  const tasks = filters.taskIds;
  if (Array.isArray(tasks) && tasks.length > 0) q.taskIds = tasks;
  const hasFiles = boolFilter(filters.hasFiles);
  if (hasFiles !== undefined) q.hasFiles = hasFiles;
  const created = dateRange(filters.createdAt);
  if (created) q.createdAt = created;
  if (search) q.searchingFor = search;
  return q;
}

export function ObservationTablePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { deleteAsync } = useObservationMutations();
  const { batchDeleteAsync } = useObservationBatchMutations();

  const canCreate = canCreateObservations(user);

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
  const pageSizeRaw = Number(searchParams.get("pageSize") ?? String(OBSERVATION_DEFAULT_PAGE_SIZE));
  const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : OBSERVATION_DEFAULT_PAGE_SIZE;
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
      ...buildObservationQuery(params.filters, params.search),
      page,
      limit: pageSize,
      orderBy: buildObservationOrderBy(sorting),
      include: LIST_INCLUDE,
    }),
    [params, page, pageSize, sorting],
  );

  const { data: response, isLoading, error } = useObservations(query as never);
  const observations = useMemo(() => (response as { data?: Observation[] } | undefined)?.data ?? [], [response]);
  const totalRecords = (response as { meta?: { totalRecords?: number } } | undefined)?.meta?.totalRecords ?? 0;

  // Export "all": re-page the whole filtered set (the table only holds the current page). The API caps
  // `limit` at 100, so page through it rather than requesting everything at once.
  const fetchAllForExport = useCallback(async (): Promise<Observation[]> => {
    const PAGE_SIZE = 100;
    const baseQuery = {
      ...buildObservationQuery(params.filters, params.search),
      orderBy: buildObservationOrderBy(sorting),
      include: LIST_INCLUDE,
    };
    const all: Observation[] = [];
    for (let p = 1; ; p++) {
      const res = (await getObservations({ ...baseQuery, page: p, limit: PAGE_SIZE } as never)) as
        | { data?: Observation[]; meta?: { hasNextPage?: boolean } }
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

  const columns = useMemo(() => createObservationColumns(), []);

  // Row → detail; hand over the visible ids so the detail page can page prev/next.
  const onRowClick = useCallback(
    (observation: Observation, meta: DataTableRowClickMeta) => {
      navigate(routes.production.observations.details(observation.id), { state: { ids: meta.orderedIds } });
    },
    [navigate],
  );

  // --- delete confirmation (hosted once at page level) ---
  const [deleteDialog, setDeleteDialog] = useState<Observation[] | null>(null);

  const confirmDelete = useCallback(async () => {
    const items = deleteDialog;
    if (!items?.length) return;
    try {
      if (items.length > 1) await batchDeleteAsync({ observationIds: items.map((o) => o.id) });
      else await deleteAsync(items[0].id);
    } catch {
      // The api client already surfaced the error notification.
    } finally {
      setDeleteDialog(null);
    }
  }, [deleteDialog, batchDeleteAsync, deleteAsync]);

  const rowActions = useMemo<DataTableRowAction<Observation>[]>(
    () => [
      {
        key: "open-new-tab",
        label: "Abrir em nova guia",
        icon: <IconExternalLink className="h-4 w-4" />,
        hidden: (rows) => rows.length !== 1,
        onClick: (rows) => rows[0] && window.open(routes.production.observations.details(rows[0].id), "_blank"),
      },
      {
        key: "edit",
        label: "Editar",
        icon: <IconEdit className="h-4 w-4" />,
        separatorBefore: true,
        requiredPrivilege: OBSERVATION_EDIT_PRIVILEGES,
        hidden: (rows) => rows.length !== 1,
        onClick: (rows) => rows[0] && navigate(routes.production.observations.edit(rows[0].id)),
      },
      {
        key: "delete",
        label: "Excluir",
        icon: <IconTrash className="h-4 w-4" />,
        variant: "destructive",
        separatorBefore: true,
        requiredPrivilege: OBSERVATION_DELETE_PRIVILEGES,
        onClick: (rows) => setDeleteDialog(rows),
      },
    ],
    [navigate],
  );

  // --- declarative filters (server mode: values are mapped by buildObservationQuery) ---
  const filterDefs = useMemo<DataTableFilterDef<Observation>[]>(
    () => [
      { key: "taskIds", label: "Tarefa", type: "multiselect", options: taskOptions },
      { key: "hasFiles", label: "Com arquivos anexos", type: "boolean" },
      { key: "createdAt", label: "Período de criação", type: "date-range" },
    ],
    [taskOptions],
  );

  return (
    <div className="flex h-full flex-col">
      {error ? (
        <div className="mx-4 mt-4 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <IconAlertTriangle className="h-4 w-4 shrink-0" />
          Não foi possível carregar as observações. Tente novamente.
        </div>
      ) : null}

      <div className="min-h-0 flex-1">
        <DataTablePage<Observation>
          title="Observações"
          favoritePage={FAVORITE_PAGES.PRODUCAO_OBSERVACOES_LISTAR}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Produção", href: routes.production.root },
            { label: "Observações" },
          ]}
          actions={
            canCreate
              ? [
                  {
                    key: "create",
                    label: "Nova Observação",
                    icon: IconPlus,
                    onClick: () => navigate(routes.production.observations.create),
                    variant: "default",
                  },
                ]
              : []
          }
          table={{
            tableId: "observations-list",
            data: observations,
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
            defaultSorting: [{ id: "createdAt", desc: true }],
            defaultPageSize: OBSERVATION_DEFAULT_PAGE_SIZE,
            estimateRowHeight: 44,
            searchPlaceholder: "Buscar por tarefa, descrição...",
            emptyMessage: "Nenhuma observação encontrada. Ajuste os filtros ou crie uma nova observação.",
            exportTitle: "Observações",
            exportFilename: "observacoes",
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
                ? `Tem certeza que deseja excluir ${deleteDialog.length} observações? Esta ação não pode ser desfeita.`
                : `Tem certeza que deseja excluir esta observação? Esta ação não pode ser desfeita.`}
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
