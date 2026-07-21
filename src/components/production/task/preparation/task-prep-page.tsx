import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  IconClipboardList,
  IconPlus,
  IconExternalLink,
  IconEdit,
  IconCalendarCheck,
  IconDoorEnter,
  IconPlayerPlay,
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconCopy,
  IconClipboardCopy,
  IconSettings2,
  IconBuildingFactory2,
  IconCalendarTime,
  IconFileInvoice,
  IconPhoto,
  IconFileText,
  IconPalette,
  IconCut,
  IconLayout,
  IconTrash,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page-header";
import {
  DataTable,
  useScrollHideHeader,
  type DataTableRowClickMeta,
  type DataTableRowAction,
  type DataTableFilterDef,
} from "@/components/ui/datatable";
import { useCurrentUser } from "@/hooks/common/use-auth";
import { useTasks, useTaskMutations, useTaskBatchMutations } from "@/hooks/production/use-task";
import { canEditTasks, canFinishTask, canManageTaskStatus, canLeaderManageTask } from "@/utils/permissions/entity-permissions";
import { getTaskQuoteEditRoute } from "@/utils/task";
import { areAllServiceOrdersComplete } from "@/utils/serviceOrder";
import { TaskDuplicateModal } from "@/components/production/task/modals/task-duplicate-modal";
import { SetSectorModal } from "@/components/production/task/schedule/set-sector-modal";
import { SetTermModal } from "@/components/production/task/schedule/set-term-modal";
import { SetStatusModal } from "@/components/production/task/schedule/set-status-modal";
import { SetQuoteLayoutModal } from "@/components/production/task/schedule/set-quote-layout-modal";
import { AdvancedBulkActionsHandler } from "@/components/production/task/bulk-operations/AdvancedBulkActionsHandler";
import { CopyFromTaskModal } from "@/components/production/task/schedule/copy-from-task-modal";
import { Button } from "@/components/ui/button";
import { taskService } from "@/api-client/task";
import type { CopyableTaskField } from "@/types/task-copy";
import { toast } from "@/components/ui/sonner";
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
import {
  routes,
  FAVORITE_PAGES,
  TASK_STATUS,
  SECTOR_PRIVILEGES,
  TRUCK_CATEGORY_LABELS,
  IMPLEMENT_TYPE_LABELS,
} from "@/constants";
import type { Task } from "@/types";
import { clusterTasks, expandClusterTasks, expandClusterTaskIds, type ClusteredTask } from "./cluster-tasks";
import { createTaskPreparationColumns, TASK_PREP_SECTOR_DEFAULTS } from "./task-prep-columns";

// Trimmed include — only what the columns render (vs. the legacy 3-7 MB payload). No truck layouts
// beyond the minimal Medidas fields. The only nested billing data is the quote's customerConfigs
// customer names (the FINANCIAL "Faturar Para" column). `assignedToId` is the one extra scalar we keep
// so the progress cell can flag "pending assigned to you".
const LIST_INCLUDE = {
  serviceOrders: { select: { id: true, type: true, status: true, assignedToId: true, description: true, observation: true } },
  // Forecast "reagendada" flag on the date cell: fetch ONLY the latest MANUAL reschedule (not the full
  // history that the legacy view loaded). where+orderBy+take:1 keeps this a single tiny row per task,
  // so the violet hover indicator is restored without the payload cost the migration trimmed.
  forecastHistory: {
    select: { source: true, previousDate: true, newDate: true, reason: true, createdAt: true },
    where: { source: "MANUAL", previousDate: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 1,
  },
  customer: { select: { id: true, fantasyName: true, corporateName: true } },
  truck: {
    select: {
      id: true,
      plate: true,
      category: true,
      chassisNumber: true,
      implementType: true,
      // Layouts power the (default-hidden) "Medidas" column — formatTaskMeasures reads
      // height + the sections' widths off the left/right side. Keep the nested select
      // minimal (just those fields) so the payload stays lean.
      leftSideMeasure: { select: { id: true, height: true, sections: { select: { id: true, width: true } } } },
      rightSideMeasure: { select: { id: true, height: true, sections: { select: { id: true, width: true } } } },
    },
  },
  quote: {
    select: {
      id: true,
      total: true,
      status: true,
      // FINANCIAL "Faturar Para" column — the quote's billing customers (cheap nested select).
      customerConfigs: { select: { customer: { select: { corporateName: true, fantasyName: true } } } },
    },
  },
  generalPainting: { select: { id: true, name: true, hex: true } },
  sector: { select: { id: true, name: true } },
  responsibles: { select: { id: true, name: true } },
} as const;

// The "Avançados" submenu the occasional/per-sector actions collapse into.
const ADVANCED_GROUP = { id: "advanced", label: "Avançados", icon: <IconSettings2 className="h-4 w-4" /> };

// Per-sector TOP-LEVEL (primary) context-menu actions, derived from what each sector actually edits
// most on tasks (changelog analysis). Any gated-allowed action NOT listed here drops into "Avançados";
// destructive actions (cancelar/excluir) always sit at the bottom. This keeps each sector's menu short
// and focused on its real workflow instead of showing everyone the full ADMIN-sized list:
//   • PRODUCTION  → status 69% / startedAt 26% → just the workflow (no edit/quote/setor).
//   • LOGISTIC    → layouts 40% / forecast 21% / entry 12% / files → entry/release + layout + files up top.
//   • PROD_MANAGER→ status / sectorId 14% / term 11% / forecast → workflow + setor + prazo.
//   • COMMERCIAL  → CREATE 16% / quote / customer → create/quote/edit/prazo.
//   • ADMIN       → does everything → keep only the workflow essentials top-level, rest in Avançados.
//   • DESIGNER    → ~no task-field edits → arts/cuts live in Avançados.
const SECTOR_PRIMARY: Partial<Record<SECTOR_PRIVILEGES, string[]>> = {
  [SECTOR_PRIVILEGES.ADMIN]: ["open-new-tab", "edit", "disponibilizar", "iniciar", "finalizar", "liberar", "dar-entrada", "definir-setor", "definir-prazo"],
  [SECTOR_PRIVILEGES.PRODUCTION_MANAGER]: ["open-new-tab", "edit", "disponibilizar", "iniciar", "finalizar", "definir-setor", "definir-prazo", "liberar", "dar-entrada"],
  [SECTOR_PRIVILEGES.PRODUCTION]: ["open-new-tab", "disponibilizar", "iniciar", "finalizar", "liberar"],
  [SECTOR_PRIVILEGES.LOGISTIC]: ["open-new-tab", "edit", "dar-entrada", "liberar", "adv-layout", "adv-base-files"],
  [SECTOR_PRIVILEGES.COMMERCIAL]: ["open-new-tab", "edit", "criar-copias", "definir-prazo"],
  [SECTOR_PRIVILEGES.DESIGNER]: ["open-new-tab", "edit"],
  [SECTOR_PRIVILEGES.FINANCIAL]: ["open-new-tab", "edit"],
};
const DEFAULT_PRIMARY = ["open-new-tab", "edit"];

/** Legacy default ordering used as the basis for name-clustering: forecastDate, name, identificador. */
function defaultOrder(a: Task, b: Task): number {
  const af = a.forecastDate ? new Date(a.forecastDate).getTime() : Infinity;
  const bf = b.forecastDate ? new Date(b.forecastDate).getTime() : Infinity;
  if (af !== bf) return af - bf;
  const an = (a.name || "").localeCompare(b.name || "");
  if (an !== 0) return an;
  return (a.serialNumber || a.truck?.plate || "").localeCompare(b.serialNumber || b.truck?.plate || "");
}

/** One trimmed bucket query. The API caps `limit` at 1000, so each status-bucket gets its own query
 *  (legacy ran the same queries) — that keeps headroom while staying far lighter than the legacy
 *  deep includes. Pass `statuses: undefined` to omit the status filter entirely (FINANCIAL relies on
 *  the server's `shouldDisplayForFinancial` scope to select completed-awaiting-settlement tasks). */
function useTasksBucket(statuses: TASK_STATUS[] | undefined, enabled: boolean, scope: Record<string, boolean>) {
  const { data, isLoading, error } = useTasks({
    ...(statuses ? { status: statuses } : {}),
    include: LIST_INCLUDE as never,
    // The server's "belongs on the Agenda" display-scope flag — designer/financial get a different
    // server-side set than the generic preparation view (legacy branched this by sector).
    ...scope,
    limit: 1000,
    orderBy: { forecastDate: "asc" },
    enabled,
    // No refetch-on-every-focus storm (the legacy forced "always"); revalidates on demand instead.
    refetchOnWindowFocus: false,
    // `useTasks` is otherwise staleTime:0 — which would refetch both 1000-row buckets on every remount
    // (e.g. navigating away and back). Keep them fresh for 30s; explicit post-mutation invalidations
    // still refetch immediately, so on-page edits stay live.
    staleTime: 30_000,
  } as never);
  const tasks = (data as { data?: Task[] } | undefined)?.data ?? [];
  return { tasks, isLoading, error };
}

/** A rendered table: its persistence id, heading, and clustered rows. */
export interface PrepTable {
  id: string;
  title: string;
  clusters: ClusteredTask[];
}

function useSplitClusters(
  enabled: boolean,
  priv?: SECTOR_PRIVILEGES,
): { tables: PrepTable[]; tasks: Task[]; isLoading: boolean; error: unknown } {
  // FINANCIAL gets a SINGLE table of completed-awaiting-settlement tasks: no status filter — the
  // server's `shouldDisplayForFinancial` scope selects them (faithful to the legacy single financial
  // table). Status-bucketing them (as the generic split does) would AND-out every COMPLETED task and
  // leave financial with an empty Agenda. Everyone else keeps the production / preparation split.
  const isFinancial = priv === SECTOR_PRIVILEGES.FINANCIAL;
  const scope: Record<string, boolean> =
    priv === SECTOR_PRIVILEGES.DESIGNER
      ? { shouldDisplayForDesigner: true }
      : isFinancial
        ? { shouldDisplayForFinancial: true }
        : { shouldDisplayInPreparation: true };

  // Both hooks always run (rules-of-hooks); the unused one is just disabled.
  const prod = useTasksBucket([TASK_STATUS.IN_PRODUCTION], enabled && !isFinancial, scope);
  const prep = useTasksBucket(
    isFinancial ? undefined : [TASK_STATUS.PREPARATION, TASK_STATUS.WAITING_PRODUCTION],
    enabled,
    scope,
  );

  return useMemo(() => {
    if (isFinancial) {
      const clusters = clusterTasks(prep.tasks.slice().sort(defaultOrder));
      return {
        tables: [{ id: "financial", title: "Aguardando Faturamento", clusters }],
        tasks: prep.tasks,
        isLoading: prep.isLoading,
        error: prep.error,
      };
    }
    const production = clusterTasks(prod.tasks.slice().sort(defaultOrder));
    const preparation = clusterTasks(prep.tasks.slice().sort(defaultOrder));
    return {
      tables: [
        { id: "production", title: "Em Produção", clusters: production },
        { id: "preparation", title: "Em Preparação", clusters: preparation },
      ],
      tasks: [...prod.tasks, ...prep.tasks],
      isLoading: prod.isLoading || prep.isLoading,
      error: prod.error || prep.error,
    };
  }, [isFinancial, prod.tasks, prep.tasks, prod.isLoading, prep.isLoading, prod.error, prep.error]);
}

/** Page-level state for each context-menu action that opens a dialog (one slot per modal). */
type ModalState = { open: boolean; taskIds: string[] };
const CLOSED_MODAL: ModalState = { open: false, taskIds: [] };
// AdvancedBulkActionsHandler ignores `selectedTaskIds` (it acts on the ids passed to openModal) and we
// don't lift the DataTable selection, so a stable empty Set + no-op clear keep its props satisfied.
const EMPTY_TASK_IDS = new Set<string>();
const noop = () => {};
// Stable identities so the closed modals (the common case) and the DataTable props don't churn:
// rowsFor returns this when no modal is open (avoids filtering ~2000 rows 4× per render), and the
// DataTable getRowId/getSubRows/empty-rowActions are hoisted out of the per-render tableProps factory.
const EMPTY_TASKS: Task[] = [];
const EMPTY_ROW_ACTIONS: DataTableRowAction<ClusteredTask>[] = [];
const getRowId = (t: ClusteredTask) => t.id;
const getSubRows = (t: ClusteredTask) => t.__children;

// When a global search matches only SOME tasks inside a name-cluster, the DataTable narrows the
// cluster to those matches and calls this to rebuild the parent — otherwise it keeps the WHOLE
// cluster (all siblings show even though only one matched, e.g. searching a single serial number).
// The DataTable only calls this when the cluster PARENT's own row did NOT match, so `kept` is exactly
// the matching tasks: a single match collapses to a plain standalone row; multiple matches re-form a
// smaller cluster around the first match (so aggregates/expansion reflect only the matched tasks).
const pruneClusterToMatches = (_parent: ClusteredTask, kept: ClusteredTask[]): ClusteredTask => {
  const [first, ...rest] = kept;
  if (rest.length === 0) {
    const { __children, __group, ...task } = first;
    return task as ClusteredTask;
  }
  return { ...first, __children: rest, __group: kept };
};

export function TaskPreparationPage() {
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();
  const priv = (user as { sector?: { privileges?: SECTOR_PRIVILEGES } } | undefined)?.sector?.privileges;
  const { deleteAsync } = useTaskMutations();
  const { batchDeleteAsync } = useTaskBatchMutations();
  const { tables, tasks, isLoading, error } = useSplitClusters(true, priv);
  // Legacy gave WAREHOUSE no context menu and no export/share button (read-only view).
  const isWarehouse = priv === SECTOR_PRIVILEGES.WAREHOUSE;

  const currentUserId = (user as { id?: string } | undefined)?.id;
  const columns = useMemo(() => createTaskPreparationColumns({ currentUserId }), [currentUserId]);

  // Collapse the page header on scroll-down / reveal on scroll-up — driven by the page scroll
  // container (the same performant rAF/DOM-mutation approach the DataTablePage uses).
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  useScrollHideHeader({ scrollRef, headerRef, enabled: true });

  const queryClient = useQueryClient();

  // --- copy-from-task: pick fields → pick a SOURCE task from the list → confirm → copy to target(s).
  //     (Faithful port of the legacy right-click "Copiar de Outra Tarefa" flow.) ---
  type CopyFromState = {
    step: "idle" | "selecting_fields" | "selecting_source" | "confirming";
    targetTasks: Task[];
    selectedFields: CopyableTaskField[];
    sourceTask: Task | null;
  };
  const [copyFrom, setCopyFrom] = useState<CopyFromState>({ step: "idle", targetTasks: [], selectedFields: [], sourceTask: null });
  const resetCopyFrom = useCallback(() => setCopyFrom({ step: "idle", targetTasks: [], selectedFields: [], sourceTask: null }), []);
  const startCopyFrom = useCallback(
    (targetTasks: Task[]) => setCopyFrom({ step: "selecting_fields", targetTasks, selectedFields: [], sourceTask: null }),
    [],
  );
  const startSourceSelection = useCallback(
    (fields: CopyableTaskField[]) => setCopyFrom((p) => ({ ...p, step: "selecting_source", selectedFields: fields })),
    [],
  );
  const onSourceSelected = useCallback(
    async (source: Task) => {
      try {
        const full = await taskService.getTaskById(source.id, {
          include: {
            layouts: { include: { file: true } },
            budgets: true,
            invoices: true,
            receipts: true,
            quote: true,
            logoPaints: true,
            cuts: true,
            serviceOrders: true,
            truck: {
              include: {
                leftSideMeasure: { include: { sections: true, photo: true } },
                rightSideMeasure: { include: { sections: true, photo: true } },
                backSideMeasure: { include: { sections: true, photo: true } },
              },
            },
          },
        } as never);
        const data = (full as { data?: Task } | undefined)?.data;
        if (!data) throw new Error("no data");
        setCopyFrom((p) => ({ ...p, step: "confirming", sourceTask: data }));
      } catch {
        // The api client already surfaced the error notification.
        resetCopyFrom();
      }
    },
    [resetCopyFrom],
  );
  const confirmCopyFrom = useCallback(
    async (fields: CopyableTaskField[], source: Task) => {
      // Sequential — copying the quote risks budgetNumber unique-constraint races in parallel.
      // We suppress the api client's per-call toast and report ONE aggregate summary: a copy that
      // touched 0 fields (source empty / field not permitted for the sector) returns HTTP 200 and
      // would otherwise surface a misleading per-call "success" while nothing actually changed.
      let copied = 0;
      let unchanged = 0;
      let failed = 0;
      for (const t of copyFrom.targetTasks) {
        try {
          const res = await taskService.copyFromTask(
            t.id,
            { sourceTaskId: source.id, fields },
            undefined,
            { suppressToast: true },
          );
          const applied = (res as { data?: { copiedFields?: unknown[] } } | undefined)?.data?.copiedFields?.length ?? 0;
          if (applied > 0) copied += 1;
          else unchanged += 1;
        } catch {
          // The thrown call is a real failure (403 / validation / server error).
          failed += 1;
        }
      }
      if (copied > 0) await queryClient.invalidateQueries({ queryKey: ["tasks"] });

      const parts: string[] = [];
      if (copied > 0) parts.push(`${copied} tarefa(s) atualizada(s)`);
      if (unchanged > 0) parts.push(`${unchanged} sem alteração`);
      if (failed > 0) parts.push(`${failed} com falha`);
      const summary = parts.join(" · ");
      // Failed targets already surface their OWN per-call error toast (copy-from errors are not
      // interceptor-suppressed), so we never fire a second aggregate error — that would double up.
      // We DO own the success/no-op summary, since a successful copy-from shows no per-call toast;
      // on a mixed result we add a single aggregate warning so the succeeded rows aren't invisible.
      if (failed > 0) {
        if (copied > 0 || unchanged > 0) toast.warning(`Cópia parcial — ${summary}`);
      } else if (copied === 0) {
        toast.warning(summary || "Nenhum campo foi copiado (origem sem dados ou sem permissão)");
      } else {
        toast.success(`Cópia concluída — ${summary}`);
      }
      resetCopyFrom();
    },
    [copyFrom.targetTasks, queryClient, resetCopyFrom],
  );

  // Escape cancels source-selection (matches the legacy behaviour).
  useEffect(() => {
    if (copyFrom.step !== "selecting_source") return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && resetCopyFrom();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [copyFrom.step, resetCopyFrom]);

  const onRowClick = useCallback(
    (task: ClusteredTask, meta: DataTableRowClickMeta) => {
      // In source-selection mode a click PICKS the source instead of navigating to the detail.
      if (copyFrom.step === "selecting_source") {
        void onSourceSelected(task);
        return;
      }
      navigate(routes.production.preparation.details(task.id), { state: { ids: meta.orderedIds } });
    },
    [navigate, copyFrom.step, onSourceSelected],
  );

  const canCreate = canEditTasks(user as never);

  // --- workflow context-menu actions (direct mutations; faithful to the legacy right-click menu) ---
  const canEdit = canEditTasks(user as never);
  const canFinish = canFinishTask(user as never);
  // Status-advance (Disponibilizar / Iniciar) is gated by canManageTaskStatus = ADMIN || team-leader
  // (legacy `canManageStatus`), NOT the broad `canEditTasks` — otherwise COMMERCIAL/DESIGNER/FINANCIAL
  // could push tasks into production. A team-leader may only advance tasks in their OWN led sector
  // (or unassigned), enforced per-row by `leaderCanManage`.
  const canManageStatus = canManageTaskStatus(user as never);
  const leaderCanManage = useCallback(
    (t: Task) => canLeaderManageTask(user as never, t.sectorId),
    [user],
  );
  const canLiberar =
    priv === SECTOR_PRIVILEGES.PRODUCTION ||
    priv === SECTOR_PRIVILEGES.LOGISTIC ||
    priv === SECTOR_PRIVILEGES.PRODUCTION_MANAGER ||
    priv === SECTOR_PRIVILEGES.COMMERCIAL ||
    priv === SECTOR_PRIVILEGES.ADMIN;
  const canDarEntrada =
    priv === SECTOR_PRIVILEGES.ADMIN || priv === SECTOR_PRIVILEGES.LOGISTIC || priv === SECTOR_PRIVILEGES.PRODUCTION_MANAGER;
  const canCancel =
    priv === SECTOR_PRIVILEGES.ADMIN ||
    priv === SECTOR_PRIVILEGES.FINANCIAL ||
    priv === SECTOR_PRIVILEGES.LOGISTIC ||
    priv === SECTOR_PRIVILEGES.COMMERCIAL;

  // Direct field mutations. The api client surfaces success/error notifications itself — we never
  // toast here, that would double up. We call the raw client (not useTaskMutations.updateAsync) so we
  // can invalidate ONCE after the whole loop: the mutation hook invalidates ~8 query trees per success,
  // so an N-row bulk action would otherwise trigger N refetches of BOTH 1000-row buckets mid-loop.
  // This mirrors confirmCopyFrom's batched single refresh.
  const set = useCallback(
    async (rows: Task[], patch: (t: Task) => Record<string, unknown> | null) => {
      let mutated = false;
      for (const t of rows) {
        const data = patch(t);
        if (!data) continue;
        try {
          await taskService.updateTask(t.id, data as never);
          mutated = true;
        } catch {
          // The api client already surfaced the error notification. Keep going so one failing row
          // doesn't silently abort the remaining rows of a bulk operation.
        }
      }
      if (mutated) await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    [queryClient],
  );

  const inPrepOrWaiting = (t: Task) => t.status === TASK_STATUS.PREPARATION || t.status === TASK_STATUS.WAITING_PRODUCTION;

  // --- modal-backed context-menu actions (hosted at page level; faithful to the legacy right-click menu) ---
  // The generic menu hands each action ALL targeted rows (a single row, or the whole selection when the
  // right-clicked row is selected), so every modal operates on `rows.map(r => r.id)`.
  const advancedRef = useRef<{ openModal: (type: string, taskIds: string[]) => void } | null>(null);
  const [duplicateModal, setDuplicateModal] = useState<ModalState>(CLOSED_MODAL);
  const [sectorModal, setSectorModal] = useState<ModalState>(CLOSED_MODAL);
  const [termModal, setTermModal] = useState<ModalState>(CLOSED_MODAL);
  const [statusModal, setStatusModal] = useState<ModalState>(CLOSED_MODAL);
  const [quoteLayoutModal, setQuoteLayoutModal] = useState<ModalState>(CLOSED_MODAL);
  const [deleteModal, setDeleteModal] = useState<ModalState>(CLOSED_MODAL);

  // Resolve live Task objects for a set of ids: the schedule modals need `tasks` for their count and
  // initial-value computation, and TaskDuplicateModal needs the single source task.
  const rowsFor = useCallback(
    (ids: string[]) => {
      if (!ids.length) return EMPTY_TASKS; // closed modals: skip filtering the whole ~2000-row set
      const idSet = new Set(ids);
      return tasks.filter((t) => idSet.has(t.id));
    },
    [tasks],
  );

  const handleSectorConfirm = useCallback(
    (sectorId: string | null) => void set(rowsFor(sectorModal.taskIds), () => ({ sectorId })),
    [set, rowsFor, sectorModal.taskIds],
  );
  const handleTermConfirm = useCallback(
    (term: Date | null) => void set(rowsFor(termModal.taskIds), () => ({ term })),
    [set, rowsFor, termModal.taskIds],
  );
  const handleStatusConfirm = useCallback(
    (status: TASK_STATUS) => void set(rowsFor(statusModal.taskIds), () => ({ status })),
    [set, rowsFor, statusModal.taskIds],
  );
  const handleDeleteConfirm = useCallback(async () => {
    const ids = deleteModal.taskIds;
    try {
      if (ids.length === 1) await deleteAsync(ids[0]);
      else if (ids.length > 1) await batchDeleteAsync({ taskIds: ids });
    } catch {
      // The api client already surfaced the error notification.
    } finally {
      setDeleteModal(CLOSED_MODAL);
    }
  }, [deleteModal.taskIds, deleteAsync, batchDeleteAsync]);

  const rowActions = useMemo<DataTableRowAction<ClusteredTask>[]>(() => {
    const actions: DataTableRowAction<ClusteredTask>[] = [
      {
        key: "open-new-tab",
        label: "Abrir em nova guia",
        icon: <IconExternalLink className="h-4 w-4" />,
        onClick: (rows) => rows[0] && window.open(routes.production.preparation.details(rows[0].id), "_blank"),
      },
    ];
    if (canEdit) {
      const isCommercial = priv === SECTOR_PRIVILEGES.COMMERCIAL;
      actions.push({
        key: "edit",
        // Multi-select edits the whole batch (legacy "Editar em lote"); COMMERCIAL single-edit goes
        // straight to the quote, everyone else to the task edit form.
        label: "Editar",
        icon: <IconEdit className="h-4 w-4" />,
        onClick: (rows) => {
          if (!rows.length) return;
          if (rows.length > 1) {
            navigate(`${routes.production.schedule.batchEdit}?ids=${expandClusterTaskIds(rows).join(",")}`);
          } else if (isCommercial) {
            // COMMERCIAL always edits via the budget/invoice pages, never the task form.
            // getTaskQuoteEditRoute handles the no-quote case (falls back to the budget page).
            navigate(getTaskQuoteEditRoute(rows[0]));
          } else {
            navigate(routes.production.preparation.edit(rows[0].id));
          }
        },
      });
    }
    if (canLiberar) {
      actions.push({
        key: "liberar",
        label: "Liberar",
        icon: <IconCalendarCheck className="h-4 w-4" />,
        separatorBefore: true,
        hidden: (rows) => !rows.some(inPrepOrWaiting),
        // Legacy showed a disabled "Liberado" item once every targeted task was already cleared.
        disabled: (rows) => rows.filter(inPrepOrWaiting).every((t) => t.cleared),
        onClick: (rows) =>
          void set(
            expandClusterTasks(rows).filter(inPrepOrWaiting),
            (t) => ({ cleared: true, ...(t.forecastDate ? {} : { forecastDate: new Date() }) }),
          ),
      });
    }
    if (canDarEntrada) {
      actions.push({
        key: "dar-entrada",
        label: "Dar Entrada",
        icon: <IconDoorEnter className="h-4 w-4" />,
        hidden: (rows) => !rows.some(inPrepOrWaiting),
        onClick: (rows) =>
          void set(
            expandClusterTasks(rows).filter(inPrepOrWaiting),
            () => ({ entryDate: new Date(), cleared: true }),
          ),
      });
    }
    if (canManageStatus) {
      // A team-leader can only advance tasks in their own led sector; ADMIN passes every row.
      const canAdvance = (t: Task) => leaderCanManage(t);
      actions.push(
        {
          key: "disponibilizar",
          label: "Disponibilizar para Produção",
          icon: <IconPlayerPlay className="h-4 w-4" />,
          hidden: (rows) => !rows.some((t) => t.status === TASK_STATUS.PREPARATION && canAdvance(t)),
          onClick: (rows) =>
            void set(
              expandClusterTasks(rows).filter((t) => t.status === TASK_STATUS.PREPARATION && canAdvance(t)),
              () => ({ status: TASK_STATUS.WAITING_PRODUCTION }),
            ),
        },
        {
          key: "iniciar",
          label: "Iniciar Produção",
          icon: <IconPlayerPlay className="h-4 w-4" />,
          hidden: (rows) => !rows.some((t) => t.status === TASK_STATUS.WAITING_PRODUCTION && canAdvance(t)),
          onClick: (rows) =>
            void set(
              expandClusterTasks(rows).filter((t) => t.status === TASK_STATUS.WAITING_PRODUCTION && canAdvance(t)),
              () => ({ status: TASK_STATUS.IN_PRODUCTION, startedAt: new Date() }),
            ),
        },
      );
    }
    if (canFinish) {
      // Faithful to legacy: only finishable when IN_PRODUCTION *and* every service order is complete
      // (the API also blocks completion otherwise — this hides the dead action).
      const finishable = (t: Task) => t.status === TASK_STATUS.IN_PRODUCTION && areAllServiceOrdersComplete(t.serviceOrders);
      actions.push({
        key: "finalizar",
        label: "Finalizar",
        icon: <IconCheck className="h-4 w-4" />,
        hidden: (rows) => !rows.some(finishable),
        onClick: (rows) =>
          void set(
            expandClusterTasks(rows).filter(finishable),
            () => ({ status: TASK_STATUS.COMPLETED, finishedAt: new Date() }),
          ),
      });
    }

    // --- modals (gated via requiredPrivilege; ADMIN always passes, an array means OR) ---
    actions.push(
      {
        key: "criar-copias",
        label: "Criar Cópias",
        icon: <IconCopy className="h-4 w-4" />,
        separatorBefore: true,
        // Legacy: (ADMIN || COMMERCIAL) && single selection.
        requiredPrivilege: SECTOR_PRIVILEGES.COMMERCIAL,
        hidden: (rows) => rows.length !== 1,
        onClick: (rows) => rows[0] && setDuplicateModal({ open: true, taskIds: [rows[0].id] }),
      },
      {
        key: "definir-setor",
        label: "Definir/Alterar Setor",
        icon: <IconBuildingFactory2 className="h-4 w-4" />,
        requiredPrivilege: SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
        onClick: (rows) => setSectorModal({ open: true, taskIds: expandClusterTaskIds(rows) }),
      },
      {
        key: "definir-prazo",
        label: "Definir/Alterar Prazo",
        icon: <IconCalendarTime className="h-4 w-4" />,
        requiredPrivilege: [SECTOR_PRIVILEGES.PRODUCTION_MANAGER, SECTOR_PRIVILEGES.COMMERCIAL],
        onClick: (rows) => setTermModal({ open: true, taskIds: expandClusterTaskIds(rows) }),
      },
      {
        key: "alterar-status",
        label: "Alterar Status",
        icon: <IconFileInvoice className="h-4 w-4" />,
        // Legacy: ADMIN only, and only when a selected task is already COMPLETED.
        requiredPrivilege: SECTOR_PRIVILEGES.ADMIN,
        hidden: (rows) => !rows.some((t) => t.status === TASK_STATUS.COMPLETED),
        onClick: (rows) => setStatusModal({ open: true, taskIds: expandClusterTaskIds(rows) }),
      },
    );

    // --- "Avançados" flattened (each opens the shared AdvancedBulkActionsHandler modal) ---
    const ADVANCED = [
      SECTOR_PRIVILEGES.FINANCIAL,
      SECTOR_PRIVILEGES.LOGISTIC,
      SECTOR_PRIVILEGES.COMMERCIAL,
      SECTOR_PRIVILEGES.DESIGNER,
      SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
    ];
    const ARTS = [SECTOR_PRIVILEGES.DESIGNER, SECTOR_PRIVILEGES.PRODUCTION_MANAGER];
    actions.push(
      {
        key: "adv-arts",
        label: "Adicionar Layouts",
        icon: <IconPhoto className="h-4 w-4" />,
        separatorBefore: true,
        requiredPrivilege: ARTS,
        onClick: (rows) => advancedRef.current?.openModal("arts", expandClusterTaskIds(rows)),
      },
      {
        key: "adv-base-files",
        label: "Arquivos Base",
        icon: <IconFileText className="h-4 w-4" />,
        requiredPrivilege: ADVANCED,
        onClick: (rows) => advancedRef.current?.openModal("baseFiles", expandClusterTaskIds(rows)),
      },
      {
        key: "adv-paints",
        label: "Adicionar Tintas",
        icon: <IconPalette className="h-4 w-4" />,
        // Only sectors holding the `paint` field-domain (api task.permissions.ts) can persist
        // paints via PUT /tasks/batch; others silently 400. That domain = COMMERCIAL + DESIGNER.
        // (Fixes both the LOGISTIC/PM false-positive AND the DESIGNER capability gap.)
        requiredPrivilege: [SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.DESIGNER],
        onClick: (rows) => advancedRef.current?.openModal("paints", expandClusterTaskIds(rows)),
      },
      {
        key: "adv-cutting-plans",
        label: "Adicionar Plano de Corte",
        icon: <IconCut className="h-4 w-4" />,
        // `cuts` field-domain (api task.permissions.ts) is DESIGNER-only; PM would silently 400.
        requiredPrivilege: [SECTOR_PRIVILEGES.DESIGNER],
        onClick: (rows) => advancedRef.current?.openModal("cuttingPlans", expandClusterTaskIds(rows)),
      },
      {
        key: "adv-service-order",
        label: "Ordem de Serviço",
        icon: <IconFileInvoice className="h-4 w-4" />,
        requiredPrivilege: ADVANCED,
        onClick: (rows) => advancedRef.current?.openModal("serviceOrder", expandClusterTaskIds(rows)),
      },
      {
        key: "adv-layout",
        label: "Medidas do Implemento",
        icon: <IconLayout className="h-4 w-4" />,
        // `truck` field-domain (api task.permissions.ts) = FIN/COM/LOG/PM (NOT DESIGNER, who'd 400).
        requiredPrivilege: [
          SECTOR_PRIVILEGES.FINANCIAL,
          SECTOR_PRIVILEGES.LOGISTIC,
          SECTOR_PRIVILEGES.COMMERCIAL,
          SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
        ],
        onClick: (rows) => advancedRef.current?.openModal("layout", expandClusterTaskIds(rows)),
      },
      {
        // COMMERCIAL sets the quote's approved layout files (TaskQuote.layoutFiles) — distinct from the
        // truck "Medidas do Implemento" above. (Faithful port of the legacy COMMERCIAL-only menu item.)
        key: "adv-quote-layout",
        label: "Adicionar Layout",
        icon: <IconPhoto className="h-4 w-4" />,
        requiredPrivilege: SECTOR_PRIVILEGES.COMMERCIAL,
        // requiredPrivilege lets ADMIN through; the quote reference is a
        // COMMERCIAL-only tool (admins/designers use the task layout editor), so
        // hide it for any non-exact-COMMERCIAL privilege, ADMIN included.
        hidden: () => priv !== SECTOR_PRIVILEGES.COMMERCIAL,
        onClick: (rows) => setQuoteLayoutModal({ open: true, taskIds: expandClusterTaskIds(rows) }),
      },
    );

    actions.push({
      key: "copiar-de-outra",
      label: "Copiar de Outra Tarefa",
      icon: <IconClipboardCopy className="h-4 w-4" />,
      // Must match the copy-from @Roles (api task.controller.ts), which EXCLUDES FINANCIAL, so a
      // FINANCIAL user never sees an item that would 403 on every target. (ADMIN bypasses.)
      requiredPrivilege: [
        SECTOR_PRIVILEGES.COMMERCIAL,
        SECTOR_PRIVILEGES.LOGISTIC,
        SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
        SECTOR_PRIVILEGES.DESIGNER,
      ],
      onClick: (rows) => startCopyFrom(expandClusterTasks(rows)),
    });

    if (canCancel) {
      actions.push({
        key: "cancelar",
        label: "Cancelar",
        icon: <IconX className="h-4 w-4" />,
        variant: "destructive",
        separatorBefore: true,
        hidden: (rows) => !rows.some((t) => t.status !== TASK_STATUS.CANCELLED),
        onClick: (rows) =>
          void set(
            expandClusterTasks(rows).filter((t) => t.status !== TASK_STATUS.CANCELLED),
            () => ({ status: TASK_STATUS.CANCELLED }),
          ),
      });
    }
    actions.push({
      key: "excluir",
      label: "Excluir",
      icon: <IconTrash className="h-4 w-4" />,
      variant: "destructive",
      separatorBefore: true,
      requiredPrivilege: SECTOR_PRIVILEGES.ADMIN,
      onClick: (rows) => setDeleteModal({ open: true, taskIds: expandClusterTaskIds(rows) }),
    });

    // --- per-sector placement: primary actions stay top-level; everything else gated-allowed
    //     collapses into the "Avançados" submenu; destructive (cancelar/excluir) always sit at the
    //     bottom. The privilege gates still apply ON TOP — an action only appears if the sector can
    //     do it; this just decides WHERE (top-level vs submenu) for the actions it can. ---
    const primaryKeys = new Set(SECTOR_PRIMARY[priv as SECTOR_PRIVILEGES] ?? DEFAULT_PRIMARY);
    const isDestructive = (a: DataTableRowAction<ClusteredTask>) => a.key === "cancelar" || a.key === "excluir";
    const primary = actions.filter((a) => !isDestructive(a) && primaryKeys.has(a.key));
    const advanced = actions
      .filter((a) => !isDestructive(a) && !primaryKeys.has(a.key))
      .map((a, i) => ({ ...a, group: ADVANCED_GROUP, separatorBefore: i === 0 }));
    const destructive = actions.filter(isDestructive);
    return [...primary, ...advanced, ...destructive];
  }, [priv, canEdit, canFinish, canManageStatus, leaderCanManage, canLiberar, canDarEntrada, canCancel, navigate, set, startCopyFrom]);

  // --- declarative filters (client-mode; the whole active set is already loaded) ---
  const filterDefs = useMemo<DataTableFilterDef<ClusteredTask>[]>(() => {
    const custMap = new Map<string, string>();
    for (const t of tasks) {
      if (t.customer?.id) custMap.set(t.customer.id, t.customer.corporateName || t.customer.fantasyName || t.customer.id);
    }
    const customerOptions = Array.from(custMap, ([value, label]) => ({ value, label })).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
    return [
      { key: "forecastDate", label: "Previsão", type: "date-range", accessor: (r) => r.forecastDate },
      { key: "term", label: "Prazo", type: "date-range", accessor: (r) => r.term },
      { key: "createdAt", label: "Data de Criação", type: "date-range", accessor: (r) => r.createdAt },
      {
        key: "customerId",
        label: "Razão Social",
        type: "multiselect",
        options: customerOptions,
        accessor: (r) => r.customer?.id ?? "",
      },
      {
        key: "truckCategory",
        label: "Categoria",
        type: "multiselect",
        options: Object.entries(TRUCK_CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
        accessor: (r) => r.truck?.category ?? "",
      },
      {
        key: "implementType",
        label: "Tipo de Implemento",
        type: "multiselect",
        options: Object.entries(IMPLEMENT_TYPE_LABELS).map(([value, label]) => ({ value, label })),
        accessor: (r) => r.truck?.implementType ?? "",
      },
    ];
  }, [tasks]);

  const tableProps = (
    tableId: string,
    data: ClusteredTask[],
    title: string,
    titleCount: number,
  ) => ({
    tableId,
    data,
    columns,
    filterDefs,
    rowActions: isWarehouse ? EMPTY_ROW_ACTIONS : rowActions,
    enableShare: !isWarehouse,
    getRowId,
    onRowClick,
    isLoading,
    syncUrl: false,
    enablePagination: false,
    enableExpansion: true,
    persistExpansion: true,
    getSubRows,
    pruneSubRows: pruneClusterToMatches,
    estimateRowHeight: 44,
    // Every table flows at its natural height and windows against the ONE page scroll container below
    // (autoHeight + a shared scrollContainerRef): a single scrollbar for the whole page, yet each table
    // still renders only its visible rows.
    autoHeight: true,
    scrollContainerRef: scrollRef,
    // Per-sector starting column layout (applied only when the user has no saved config).
    sectorDefaults: TASK_PREP_SECTOR_DEFAULTS,
    title,
    titleCount,
    searchPlaceholder: "Buscar tarefa...",
    emptyMessage: "Nenhuma tarefa encontrada. Ajuste os filtros ou crie uma nova tarefa.",
  });

  return (
    <div className="flex h-full flex-col bg-background p-4">
      {/* Collapsible header: grid-rows 1fr→0fr is a smooth, measure-free collapse on scroll. */}
      <div
        ref={headerRef}
        data-hidden="false"
        className="grid shrink-0 grid-rows-[1fr] transition-[grid-template-rows] duration-200 ease-out will-change-[grid-template-rows] data-[hidden=true]:grid-rows-[0fr]"
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pb-3">
            <PageHeader
              variant="default"
              title="Agenda"
              icon={IconClipboardList}
              favoritePage={FAVORITE_PAGES.PRODUCAO_AGENDA_LISTAR}
              breadcrumbs={[
                { label: "Início", href: routes.home },
                { label: "Produção", href: routes.production.root },
                { label: "Agenda" },
              ]}
              actions={
                canCreate
                  ? [
                      {
                        key: "create-task",
                        label: "Criar Tarefa",
                        icon: IconPlus,
                        onClick: () => navigate(routes.production.preparation.create),
                        variant: "default" as const,
                      },
                    ]
                  : undefined
              }
            />
          </div>
        </div>
      </div>

      {error ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <IconAlertTriangle className="h-4 w-4 shrink-0" />
          Não foi possível carregar as tarefas. Tente novamente.
        </div>
      ) : null}

      {copyFrom.step === "selecting_source" && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-sm">
          <span className="flex items-center gap-2">
            <IconClipboardCopy className="h-4 w-4 shrink-0 text-primary" />
            Selecione a tarefa de <strong className="font-semibold">origem</strong> para copiar os campos para{" "}
            {copyFrom.targetTasks.length} tarefa{copyFrom.targetTasks.length > 1 ? "s" : ""}.
          </span>
          <Button variant="ghost" size="sm" onClick={resetCopyFrom}>
            Cancelar
          </Button>
        </div>
      )}

      {/* ONE scroll for the whole page. Every table (FINANCIAL: a single "Aguardando Faturamento";
          everyone else: "Em Produção" + "Em Preparação") flows at its natural, content-sized height and
          windows against THIS container — so there is a single scrollbar, yet each table still renders
          only its visible rows (no all-rows dump). The page header collapses on scroll-down via
          useScrollHideHeader watching this same container.

          The cards are cleanly SEPARATED (space-y gap). This is safe because each table's toolbar AND its
          column header are ONE sticky block that always covers that table's own rows — so as one table
          scrolls out, only the page background shows in the gap (never a strip of peeking rows) before
          the next table's block pins. */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-auto">
        {tables.map((t) => (
          <DataTable<ClusteredTask> key={t.id} {...tableProps(`task-prep-${t.id}`, t.clusters, t.title, t.clusters.length)} />
        ))}
      </div>

      {/* Context-menu modals — hosted once at page level; each operates on its captured taskIds. */}
      <AdvancedBulkActionsHandler ref={advancedRef} selectedTaskIds={EMPTY_TASK_IDS} onClearSelection={noop} />

      <CopyFromTaskModal
        open={copyFrom.step === "selecting_fields" || copyFrom.step === "confirming"}
        onOpenChange={(open) => !open && resetCopyFrom()}
        step={copyFrom.step === "confirming" ? "confirming" : "selecting_fields"}
        targetTasks={copyFrom.targetTasks}
        sourceTask={copyFrom.sourceTask}
        onStartSourceSelection={startSourceSelection}
        onConfirm={confirmCopyFrom}
        onCancel={resetCopyFrom}
        onChangeSource={() => setCopyFrom((p) => ({ ...p, step: "selecting_source", sourceTask: null }))}
        userPrivilege={priv}
      />

      <TaskDuplicateModal
        task={rowsFor(duplicateModal.taskIds)[0] ?? null}
        open={duplicateModal.open}
        onOpenChange={(open) => setDuplicateModal((s) => ({ ...s, open }))}
        onSuccess={() => setDuplicateModal(CLOSED_MODAL)}
      />

      <SetSectorModal
        open={sectorModal.open}
        onOpenChange={(open) => setSectorModal((s) => ({ ...s, open }))}
        tasks={rowsFor(sectorModal.taskIds)}
        onConfirm={handleSectorConfirm}
      />

      <SetTermModal
        open={termModal.open}
        onOpenChange={(open) => setTermModal((s) => ({ ...s, open }))}
        tasks={rowsFor(termModal.taskIds)}
        onConfirm={handleTermConfirm}
      />

      <SetStatusModal
        open={statusModal.open}
        onOpenChange={(open) => setStatusModal((s) => ({ ...s, open }))}
        tasks={rowsFor(statusModal.taskIds)}
        onConfirm={handleStatusConfirm}
        allowedStatuses={[
          TASK_STATUS.PREPARATION,
          TASK_STATUS.WAITING_PRODUCTION,
          TASK_STATUS.IN_PRODUCTION,
          TASK_STATUS.COMPLETED,
          TASK_STATUS.CANCELLED,
        ]}
      />

      <SetQuoteLayoutModal
        open={quoteLayoutModal.open}
        onOpenChange={(open) => setQuoteLayoutModal((s) => ({ ...s, open }))}
        tasks={rowsFor(quoteLayoutModal.taskIds)}
      />

      <AlertDialog open={deleteModal.open} onOpenChange={(open) => !open && setDeleteModal(CLOSED_MODAL)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteModal.taskIds.length > 1 ? "Excluir tarefas" : "Excluir tarefa"}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteModal.taskIds.length > 1
                ? `Tem certeza que deseja excluir ${deleteModal.taskIds.length} tarefas? Esta ação não pode ser desfeita.`
                : "Tem certeza que deseja excluir esta tarefa? Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
