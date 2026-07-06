import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  IconExternalLink,
  IconEdit,
  IconCopy,
  IconReceipt,
  IconBuildingFactory2,
  IconCalendarTime,
  IconFileInvoice,
  IconPlayerPlay,
  IconCheck,
  IconCalendarCheck,
  IconDoorEnter,
  IconSettings2,
  IconPhoto,
  IconFileText,
  IconPalette,
  IconCut,
  IconLayout,
  IconClipboardCopy,
  IconX,
  IconTrash,
  IconHandClick,
  IconClipboardList,
  IconCalendar,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { DataTable, type DataTableFilterDef, type DataTableRowAction, type DataTableRowClickMeta } from "@/components/ui/datatable";
import { PageHeader } from "@/components/ui/page-header";
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
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { useSectors, useTaskMutations, useTaskBatchMutations, taskKeys } from "@/hooks";
import { useAuth } from "@/contexts/auth-context";
import { useReturnTo } from "@/hooks/common/use-return-to";
import { getTaskById } from "@/api-client";
import { routes, FAVORITE_PAGES, SECTOR_PRIVILEGES, TASK_STATUS } from "@/constants";
import { getTaskQuoteDisplayLabel } from "@/constants/enum-labels";
import { isDateInPast } from "@/utils";
import type { Task } from "@/types";
import type { CopyableTaskField } from "@/types/task-copy";
import { canDeleteTasks, canFinishTask, canLeaderManageTask } from "@/utils/permissions/entity-permissions";
import { canViewQuote } from "@/utils/permissions/quote-permissions";
import { isTeamLeader } from "@/utils/user";
import { areAllServiceOrdersComplete } from "@/utils/serviceOrder";
import { getTaskQuoteEditRoute } from "@/utils/task";
import { SetStatusModal } from "./set-status-modal";
import { SetSectorModal } from "./set-sector-modal";
import { SetTermModal } from "./set-term-modal";
import { SetQuoteLayoutModal } from "./set-quote-layout-modal";
import { CopyFromTaskModal } from "./copy-from-task-modal";
import { TaskDuplicateModal } from "../modals/task-duplicate-modal";
import { AdvancedBulkActionsHandler } from "../bulk-operations/AdvancedBulkActionsHandler";
import { useTasks } from "@/hooks/production/use-task";
import { createTaskScheduleColumns } from "./task-schedule-columns";
import { getRowColorClass } from "./task-table-utils";

const ADVANCED_GROUP = { id: "advanced", label: "Avançados", icon: <IconSettings2 className="h-4 w-4" /> };
const getRowId = (t: Task) => t.id;

/** The Cronograma's fixed scope: production-bound statuses only. */
const SCHEDULE_STATUS: TASK_STATUS[] = [TASK_STATUS.WAITING_PRODUCTION, TASK_STATUS.IN_PRODUCTION];

/**
 * Trimmed server `include` — exactly what the Cronograma columns render. A TOP-LEVEL `include`
 * (not `select`) so the API repository's Decimal→number mapper runs and `quote.total` arrives
 * as a real number.
 */
const SCHEDULE_LIST_INCLUDE = {
  sector: true,
  customer: true,
  generalPainting: { include: { paintType: true, paintBrand: true } },
  truck: true,
  serviceOrders: true,
  quote: true,
  createdBy: true,
} as const;

/**
 * Cronograma column shaping. The column set is SHARED with Agenda/Histórico (via
 * `createTaskScheduleColumns`), so the page tweaks a local copy and never the source.
 *
 * - `CRONOGRAMA_HIDDEN_COLUMNS`: dropped entirely (not even a column-manager option). SETOR is
 *   redundant — every table already IS a sector; LOCAL / Nº CHASSI aren't useful on the schedule.
 * - `CRONOGRAMA_COLUMN_WIDTHS`: with so few columns left, the base (which grows only the LAST
 *   column) would leave a large gap before the right-aligned TEMPO RESTANTE. Widening the survivors
 *   lets them comfortably fill the row on a typical viewport.
 */
const CRONOGRAMA_HIDDEN_COLUMNS = new Set(["spot", "sectorName", "chassisNumber"]);
const CRONOGRAMA_COLUMN_WIDTHS: Record<string, number> = {
  name: 210,
  customerName: 185,
  measures: 120,
  generalPainting: 215,
  serialNumberOrPlate: 155,
  entryDate: 130,
  term: 130,
  remainingTime: 150,
};

interface CopyFromTaskState {
  step: "idle" | "selecting_fields" | "selecting_source" | "confirming";
  targetTasks: Task[];
  selectedFields: CopyableTaskField[];
  sourceTask: Task | null;
}
const INITIAL_COPY_STATE: CopyFromTaskState = { step: "idle", targetTasks: [], selectedFields: [], sourceTask: null };

type TaskModalState = { open: boolean; tasks: Task[] };
const CLOSED: TaskModalState = { open: false, tasks: [] };

/** One rendered sector group: a stable id (sectorId / "undefined"), a title, and its tasks. */
interface SectorGroup {
  id: string;
  title: string;
  tasks: Task[];
}

export function TaskScheduleTablePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const returnTo = useReturnTo();
  const { user } = useAuth();

  const { update, updateAsync, delete: deleteTask } = useTaskMutations();
  const { batchUpdate, batchDeleteAsync } = useTaskBatchMutations();

  // --- user privilege flags (mirror the legacy context menu) ---
  const priv = user?.sector?.privileges as SECTOR_PRIVILEGES | undefined;
  const isAdmin = priv === SECTOR_PRIVILEGES.ADMIN;
  const isWarehouse = priv === SECTOR_PRIVILEGES.WAREHOUSE;
  const isFinancial = priv === SECTOR_PRIVILEGES.FINANCIAL;
  const isCommercial = priv === SECTOR_PRIVILEGES.COMMERCIAL;
  const isDesigner = priv === SECTOR_PRIVILEGES.DESIGNER;
  const isProductionManager = priv === SECTOR_PRIVILEGES.PRODUCTION_MANAGER;
  const isLogisticOrCommercial = priv === SECTOR_PRIVILEGES.LOGISTIC || priv === SECTOR_PRIVILEGES.COMMERCIAL;
  const isTeamLeaderUser = user ? isTeamLeader(user as never) : false;
  const canDelete = canDeleteTasks(user as never);
  const canFinish = canFinishTask(user as never);
  const canLiberar =
    priv === SECTOR_PRIVILEGES.PRODUCTION ||
    priv === SECTOR_PRIVILEGES.LOGISTIC ||
    priv === SECTOR_PRIVILEGES.PRODUCTION_MANAGER ||
    priv === SECTOR_PRIVILEGES.COMMERCIAL ||
    priv === SECTOR_PRIVILEGES.ADMIN;
  const canDarEntrada = isAdmin || priv === SECTOR_PRIVILEGES.LOGISTIC || isProductionManager;
  const canAccessAdvancedMenu = isAdmin || isFinancial || isLogisticOrCommercial || isDesigner || isProductionManager;
  const canAccessLayouts = isAdmin || isDesigner || isProductionManager;
  const canAccessCutPlan = isAdmin || isDesigner || isProductionManager;
  const canAccessPaints = canAccessAdvancedMenu && !isDesigner;
  const canCancel = isAdmin || isFinancial || isLogisticOrCommercial;
  const canViewQuoteMenu = canViewQuote(priv || "");
  const canManageStatus = useCallback(
    (rows: Task[]) => isAdmin || (isTeamLeaderUser && rows.every((t) => canLeaderManageTask(user as never, t.sectorId))),
    [isAdmin, isTeamLeaderUser, user],
  );

  // --- ONE page scroll container shared by every sector table (task-prep pattern): each table flows
  //     at its natural height and windows against this container, so there's a single scrollbar. ---
  const scrollRef = useRef<HTMLDivElement>(null);

  // Production sectors drive the swimlane ORDER; grouping itself is keyed off each task's own sector.
  const { data: sectorsData } = useSectors({
    where: { privileges: { in: [SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.ADMIN] } },
    orderBy: { name: "asc" },
    limit: 100,
  } as never);
  const productionSectors = useMemo(() => (sectorsData?.data ?? []) as { id: string; name: string }[], [sectorsData]);

  // All production-bound tasks, loaded once (client-mode). Grouping/sort/search happen per table.
  const { data: response, isLoading } = useTasks({
    status: SCHEDULE_STATUS,
    limit: 1000,
    include: SCHEDULE_LIST_INCLUDE,
    orderBy: { term: "asc" },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  } as never);
  const tasks = useMemo(() => (response?.data ?? []) as Task[], [response]);

  // Partition into one group per sector (+ "Setor Indefinido" last); production sectors ordered first.
  const groups = useMemo<SectorGroup[]>(() => {
    const map = new Map<string, SectorGroup>();
    for (const t of tasks) {
      const id = t.sectorId || "undefined";
      const title = t.sector?.name || "Setor Indefinido";
      let g = map.get(id);
      if (!g) {
        g = { id, title, tasks: [] };
        map.set(id, g);
      }
      g.tasks.push(t);
    }
    const order = productionSectors.map((s) => s.id);
    return [...map.values()].sort((a, b) => {
      if (a.id === "undefined") return 1;
      if (b.id === "undefined") return -1;
      const ia = order.indexOf(a.id);
      const ib = order.indexOf(b.id);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.title.localeCompare(b.title);
    });
  }, [tasks, productionSectors]);

  const columns = useMemo(
    () =>
      createTaskScheduleColumns({ includeServiceOrders: false })
        .filter((c) => !CRONOGRAMA_HIDDEN_COLUMNS.has(c.id as string))
        .map((c) => {
          const width = CRONOGRAMA_COLUMN_WIDTHS[c.id as string];
          return width != null ? { ...c, size: width } : c;
        }),
    [],
  );

  // Client-mode filters (each table filters its own sector's rows). Status/sector are intentionally
  // omitted — status is the Cronograma's fixed scope and sector IS the grouping.
  const filterDefs = useMemo<DataTableFilterDef<Task>[]>(
    () => [
      { key: "term", label: "Prazo", type: "date-range", icon: <IconCalendar className="h-4 w-4" />, accessor: (t) => t.term ?? undefined },
      {
        key: "isOverdue",
        label: "Tarefas Atrasadas",
        type: "boolean",
        icon: <IconAlertTriangle className="h-4 w-4" />,
        placeholder: "Todas",
        accessor: (t) => (t.term ? isDateInPast(t.term) : false),
      },
    ],
    [],
  );

  // --- page-hosted modals + advanced/copy flows ---
  const [sectorModal, setSectorModal] = useState<TaskModalState>(CLOSED);
  const [termModal, setTermModal] = useState<TaskModalState>(CLOSED);
  const [statusModal, setStatusModal] = useState<TaskModalState>(CLOSED);
  const [quoteLayoutModal, setQuoteLayoutModal] = useState<TaskModalState>(CLOSED);
  const [duplicateModal, setDuplicateModal] = useState<TaskModalState>(CLOSED);
  const [deleteDialog, setDeleteDialog] = useState<TaskModalState>(CLOSED);
  const advancedActionsRef = useRef<{ openModal: (type: string, taskIds: string[]) => void } | null>(null);
  const [advancedTaskIds, setAdvancedTaskIds] = useState<string[]>([]);
  const [copyState, setCopyState] = useState<CopyFromTaskState>(INITIAL_COPY_STATE);

  const openAdvanced = useCallback((type: string, rows: Task[]) => {
    const ids = rows.map((r) => r.id);
    setAdvancedTaskIds(ids);
    advancedActionsRef.current?.openModal(type, ids);
  }, []);

  // --- status / lifecycle action handlers ---
  const handleLiberar = useCallback(
    async (targets: Task[]) => {
      try {
        for (const t of targets) {
          if (t.status === TASK_STATUS.PREPARATION || t.status === TASK_STATUS.WAITING_PRODUCTION) {
            const data: Record<string, unknown> = { cleared: true };
            if (!t.forecastDate) data.forecastDate = new Date();
            await update({ id: t.id, data });
          }
        }
        toast.success(targets.length > 1 ? "Tarefas liberadas" : "Tarefa liberada");
      } catch {
        toast.error("Erro ao liberar tarefa(s)");
      }
    },
    [update],
  );

  const handleDarEntrada = useCallback(
    async (targets: Task[]) => {
      try {
        for (const t of targets) {
          if (t.status === TASK_STATUS.PREPARATION || t.status === TASK_STATUS.WAITING_PRODUCTION) {
            await update({ id: t.id, data: { entryDate: new Date(), cleared: true } });
          }
        }
        toast.success("Entrada registrada");
      } catch {
        toast.error("Erro ao dar entrada");
      }
    },
    [update],
  );

  const handleStart = useCallback(
    async (targets: Task[]) => {
      try {
        for (const t of targets) {
          if (t.status === TASK_STATUS.PREPARATION) {
            await update({ id: t.id, data: { status: TASK_STATUS.WAITING_PRODUCTION } });
          } else if (t.status === TASK_STATUS.WAITING_PRODUCTION) {
            await update({ id: t.id, data: { status: TASK_STATUS.IN_PRODUCTION, startedAt: new Date() } });
          }
        }
      } catch {
        toast.error("Erro ao iniciar tarefa(s)");
      }
    },
    [update],
  );

  const handleFinish = useCallback(
    async (targets: Task[]) => {
      try {
        for (const t of targets) {
          if (t.status === TASK_STATUS.IN_PRODUCTION) {
            await updateAsync({ id: t.id, data: { status: TASK_STATUS.COMPLETED, finishedAt: new Date() } });
          }
        }
      } catch (error) {
        const description =
          (error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
          (error as { message?: string })?.message ||
          "Não foi possível finalizar a tarefa. Tente novamente.";
        toast.error("Erro ao finalizar tarefa(s)", { description });
      }
    },
    [updateAsync],
  );

  const handleCancel = useCallback(
    async (targets: Task[]) => {
      try {
        for (const t of targets) {
          if (t.status !== TASK_STATUS.CANCELLED) {
            await update({ id: t.id, data: { status: TASK_STATUS.CANCELLED } });
          }
        }
        toast.success(targets.length > 1 ? "Tarefas canceladas" : "Tarefa cancelada");
      } catch {
        toast.error("Erro ao cancelar tarefa(s)");
      }
    },
    [update],
  );

  const handleEdit = useCallback(
    (targets: Task[]) => {
      if (targets.length === 1) {
        if (isCommercial) navigate(getTaskQuoteEditRoute(targets[0]), { state: { returnTo } });
        else navigate(routes.production.schedule.edit(targets[0].id));
      } else if (targets.length > 1) {
        navigate(`${routes.production.schedule.batchEdit}?ids=${targets.map((t) => t.id).join(",")}`);
      }
    },
    [navigate, isCommercial, returnTo],
  );

  // --- modal confirm handlers ---
  const confirmSetSector = useCallback(
    async (sectorId: string | null) => {
      const ids = sectorModal.tasks.map((t) => t.id);
      try {
        if (ids.length === 1) await update({ id: ids[0], data: { sectorId } });
        else await batchUpdate({ tasks: ids.map((id) => ({ id, data: { sectorId } })) });
      } catch {
        /* api client surfaced the error */
      }
    },
    [sectorModal.tasks, update, batchUpdate],
  );

  const confirmSetTerm = useCallback(
    async (term: Date | null) => {
      const ids = termModal.tasks.map((t) => t.id);
      try {
        if (ids.length === 1) await update({ id: ids[0], data: { term } });
        else await batchUpdate({ tasks: ids.map((id) => ({ id, data: { term } })) });
        toast.success(ids.length > 1 ? "Prazos atualizados" : "Prazo atualizado");
      } catch {
        toast.error("Erro ao atualizar prazo");
      }
    },
    [termModal.tasks, update, batchUpdate],
  );

  const confirmSetStatus = useCallback(
    async (status: TASK_STATUS) => {
      const ids = statusModal.tasks.map((t) => t.id);
      try {
        if (ids.length === 1) await update({ id: ids[0], data: { status } });
        else await batchUpdate({ tasks: ids.map((id) => ({ id, data: { status } })) });
      } catch {
        /* api client surfaced the error */
      }
    },
    [statusModal.tasks, update, batchUpdate],
  );

  const confirmDelete = useCallback(async () => {
    const targets = deleteDialog.tasks;
    try {
      if (targets.length === 1) await deleteTask(targets[0].id);
      else await batchDeleteAsync({ taskIds: targets.map((t) => t.id) });
    } catch {
      /* api client surfaced the error */
    } finally {
      setDeleteDialog(CLOSED);
    }
  }, [deleteDialog.tasks, deleteTask, batchDeleteAsync]);

  // --- copy-from-task flow ---
  const handleStartCopyFromTask = useCallback((targetTasks: Task[]) => {
    setCopyState({ step: "selecting_fields", targetTasks, selectedFields: [], sourceTask: null });
  }, []);

  const handleStartSourceSelection = useCallback((selectedFields: CopyableTaskField[]) => {
    setCopyState((prev) => ({ ...prev, step: "selecting_source", selectedFields }));
  }, []);

  const handleSourceTaskSelected = useCallback(async (sourceTask: Task) => {
    try {
      const full = await getTaskById(sourceTask.id, {
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
      });
      if (!full?.success || !full.data) throw new Error("Falha ao carregar tarefa de origem");
      setCopyState((prev) => ({ ...prev, step: "confirming", sourceTask: full.data ?? null }));
    } catch {
      toast.error("Falha ao carregar detalhes da tarefa de origem");
      setCopyState(INITIAL_COPY_STATE);
    }
  }, []);

  const handleCopyConfirm = useCallback(
    async (selectedFields: CopyableTaskField[], sourceTask: Task) => {
      const { targetTasks } = copyState;
      try {
        let success = 0;
        for (const target of targetTasks) {
          try {
            const { taskService } = await import("@/api-client/task");
            await taskService.copyFromTask(target.id, { sourceTaskId: sourceTask.id, fields: selectedFields });
            success++;
          } catch {
            /* counted as failure below */
          }
        }
        const failure = targetTasks.length - success;
        if (success > 0) {
          toast.success("Campos copiados com sucesso", {
            description:
              failure === 0
                ? `${selectedFields.length} campo(s) copiado(s) de "${sourceTask.name}" para ${success} tarefa(s)`
                : `${success} tarefa(s) atualizada(s), ${failure} falhou(ram)`,
          });
          queryClient.invalidateQueries({ queryKey: taskKeys.all });
        } else if (failure > 0) {
          toast.error("Erro ao copiar campos", { description: `Falha ao copiar para ${failure} tarefa(s).` });
        }
      } catch {
        toast.error("Erro ao copiar campos");
      } finally {
        setCopyState(INITIAL_COPY_STATE);
      }
    },
    [copyState, queryClient],
  );

  const handleCopyCancel = useCallback(() => setCopyState(INITIAL_COPY_STATE), []);
  const handleChangeSource = useCallback(() => setCopyState((prev) => ({ ...prev, step: "selecting_source", sourceTask: null })), []);

  // Escape cancels source-selection mode.
  useEffect(() => {
    if (copyState.step !== "selecting_source") return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && handleCopyCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [copyState.step, handleCopyCancel]);

  // --- row actions (port of the legacy context menu) ---
  const rowActions = useMemo<DataTableRowAction<Task>[]>(() => {
    if (isWarehouse) return [];
    return [
      {
        key: "liberar",
        label: "Liberado",
        icon: <IconCalendarCheck className="h-4 w-4" />,
        hidden: (r) => !canLiberar || !r.some((t) => t.status === TASK_STATUS.PREPARATION || t.status === TASK_STATUS.WAITING_PRODUCTION),
        disabled: (r) => r.every((t) => t.cleared),
        onClick: (r) => void handleLiberar(r),
      },
      {
        key: "dar-entrada",
        label: "Dar Entrada",
        icon: <IconDoorEnter className="h-4 w-4" />,
        hidden: (r) => !canDarEntrada || !r.some((t) => t.status === TASK_STATUS.PREPARATION || t.status === TASK_STATUS.WAITING_PRODUCTION),
        onClick: (r) => void handleDarEntrada(r),
      },
      {
        key: "iniciar",
        label: "Iniciar",
        icon: <IconPlayerPlay className="h-4 w-4" />,
        hidden: (r) => !canManageStatus(r) || !r.some((t) => t.status === TASK_STATUS.PREPARATION || t.status === TASK_STATUS.WAITING_PRODUCTION),
        onClick: (r) => void handleStart(r),
      },
      {
        key: "finalizar",
        label: "Finalizar",
        icon: <IconCheck className="h-4 w-4" />,
        hidden: (r) => !canFinish || !r.some((t) => t.status === TASK_STATUS.IN_PRODUCTION && areAllServiceOrdersComplete(t.serviceOrders)),
        onClick: (r) => void handleFinish(r),
      },
      {
        key: "view",
        label: "Abrir em nova guia",
        icon: <IconExternalLink className="h-4 w-4" />,
        separatorBefore: true,
        hidden: (r) => r.length !== 1,
        onClick: (r) => window.open(routes.production.schedule.details(r[0].id), "_blank"),
      },
      {
        key: "edit",
        label: "Editar",
        icon: <IconEdit className="h-4 w-4" />,
        onClick: (r) => handleEdit(r),
      },
      {
        key: "duplicate",
        label: "Criar Cópias",
        icon: <IconCopy className="h-4 w-4" />,
        hidden: (r) => r.length !== 1 || !(isAdmin || isCommercial),
        onClick: (r) => setDuplicateModal({ open: true, tasks: r }),
      },
      {
        key: "quote",
        label: getTaskQuoteDisplayLabel(undefined),
        icon: <IconReceipt className="h-4 w-4" />,
        hidden: (r) => r.length !== 1 || !canViewQuoteMenu || isCommercial,
        onClick: (r) => navigate(getTaskQuoteEditRoute(r[0]), { state: { returnTo } }),
      },
      {
        key: "set-sector",
        label: "Definir Setor",
        icon: <IconBuildingFactory2 className="h-4 w-4" />,
        hidden: () => !(isAdmin || isProductionManager),
        onClick: (r) => setSectorModal({ open: true, tasks: r }),
      },
      {
        key: "set-term",
        label: "Definir Prazo",
        icon: <IconCalendarTime className="h-4 w-4" />,
        hidden: () => !(isAdmin || isProductionManager || isCommercial),
        onClick: (r) => setTermModal({ open: true, tasks: r }),
      },
      {
        key: "set-status",
        label: "Alterar Status",
        icon: <IconFileInvoice className="h-4 w-4" />,
        hidden: (r) => !isAdmin || !r.some((t) => t.status === TASK_STATUS.COMPLETED),
        onClick: (r) => setStatusModal({ open: true, tasks: r }),
      },
      // --- Avançados submenu ---
      {
        key: "adv-arts",
        label: "Adicionar Layouts",
        icon: <IconPhoto className="h-4 w-4" />,
        group: ADVANCED_GROUP,
        hidden: () => !canAccessAdvancedMenu || !canAccessLayouts,
        onClick: (r) => openAdvanced("arts", r),
      },
      {
        key: "adv-quote-layout",
        label: "Layout (Orçamento)",
        icon: <IconPhoto className="h-4 w-4" />,
        group: ADVANCED_GROUP,
        hidden: () => !canAccessAdvancedMenu || !isCommercial,
        onClick: (r) => setQuoteLayoutModal({ open: true, tasks: r }),
      },
      {
        key: "adv-base-files",
        label: "Arquivos Base",
        icon: <IconFileText className="h-4 w-4" />,
        group: ADVANCED_GROUP,
        hidden: () => !canAccessAdvancedMenu,
        onClick: (r) => openAdvanced("baseFiles", r),
      },
      {
        key: "adv-paints",
        label: "Adicionar Tintas",
        icon: <IconPalette className="h-4 w-4" />,
        group: ADVANCED_GROUP,
        hidden: () => !canAccessAdvancedMenu || !canAccessPaints,
        onClick: (r) => openAdvanced("paints", r),
      },
      {
        key: "adv-cut-plan",
        label: "Adicionar Plano de Corte",
        icon: <IconCut className="h-4 w-4" />,
        group: ADVANCED_GROUP,
        hidden: () => !canAccessAdvancedMenu || !canAccessCutPlan,
        onClick: (r) => openAdvanced("cuttingPlans", r),
      },
      {
        key: "adv-service-order",
        label: "Ordem de Serviço",
        icon: <IconFileInvoice className="h-4 w-4" />,
        group: ADVANCED_GROUP,
        hidden: () => !canAccessAdvancedMenu,
        onClick: (r) => openAdvanced("serviceOrder", r),
      },
      {
        key: "adv-truck-layout",
        label: "Medidas do Implemento",
        icon: <IconLayout className="h-4 w-4" />,
        group: ADVANCED_GROUP,
        hidden: () => !canAccessAdvancedMenu,
        onClick: (r) => openAdvanced("layout", r),
      },
      {
        key: "adv-copy-from",
        label: "Copiar de Outra Tarefa",
        icon: <IconClipboardCopy className="h-4 w-4" />,
        group: ADVANCED_GROUP,
        separatorBefore: true,
        hidden: () => !canAccessAdvancedMenu,
        onClick: (r) => handleStartCopyFromTask(r),
      },
      // --- destructive ---
      {
        key: "cancel",
        label: "Cancelar",
        icon: <IconX className="h-4 w-4" />,
        separatorBefore: true,
        hidden: (r) => !canCancel || !r.some((t) => t.status !== TASK_STATUS.CANCELLED),
        onClick: (r) => void handleCancel(r),
      },
      {
        key: "delete",
        label: "Excluir",
        icon: <IconTrash className="h-4 w-4" />,
        variant: "destructive",
        separatorBefore: true,
        hidden: () => !canDelete,
        onClick: (r) => setDeleteDialog({ open: true, tasks: r }),
      },
    ];
  }, [
    isWarehouse,
    isAdmin,
    isCommercial,
    isProductionManager,
    canLiberar,
    canDarEntrada,
    canManageStatus,
    canFinish,
    canViewQuoteMenu,
    canAccessAdvancedMenu,
    canAccessLayouts,
    canAccessPaints,
    canAccessCutPlan,
    canCancel,
    canDelete,
    handleLiberar,
    handleDarEntrada,
    handleStart,
    handleFinish,
    handleCancel,
    handleEdit,
    handleStartCopyFromTask,
    openAdvanced,
    navigate,
    returnTo,
  ]);

  const isSelectingSource = copyState.step === "selecting_source";

  const onRowClick = useCallback(
    (task: Task, meta: DataTableRowClickMeta) => {
      if (isSelectingSource) {
        void handleSourceTaskSelected(task);
        return;
      }
      navigate(routes.production.schedule.details(task.id), { state: { ids: meta.orderedIds } });
    },
    [isSelectingSource, handleSourceTaskSelected, navigate],
  );

  // Shared per-table config — one base <DataTable> per sector, all windowing against `scrollRef`.
  const tableProps = useCallback(
    (group: SectorGroup) => ({
      tableId: `task-schedule-${group.id}`,
      data: group.tasks,
      columns,
      getRowId,
      getRowClassName: (t: Task) => getRowColorClass(t),
      filterDefs,
      rowActions,
      onRowClick,
      enableShare: !isWarehouse,
      enablePagination: false,
      syncUrl: false,
      autoHeight: true,
      scrollContainerRef: scrollRef,
      estimateRowHeight: 44,
      title: group.title,
      searchPlaceholder: "Buscar tarefa...",
      emptyMessage: "Nenhuma tarefa neste setor.",
    }),
    [columns, filterDefs, rowActions, onRowClick, isWarehouse],
  );

  return (
    <div className="flex h-full flex-col bg-background p-4">
      <div className="shrink-0 pb-3">
        <PageHeader
          variant="default"
          title="Cronograma"
          icon={IconClipboardList}
          favoritePage={FAVORITE_PAGES.PRODUCAO_CRONOGRAMA_LISTAR}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Produção", href: routes.production.root },
            { label: "Cronograma" },
          ]}
        />
      </div>

      {isSelectingSource && (
        <div className="mb-4 flex items-center justify-between rounded-md border border-primary/20 bg-primary/10 p-3">
          <div className="flex items-center gap-2">
            <IconHandClick className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">Clique em uma tarefa para selecionar como origem dos dados</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleCopyCancel}>
            <IconX className="mr-1 h-4 w-4" />
            Cancelar
          </Button>
        </div>
      )}

      {/* ONE scroll for the whole page; every sector table flows at natural height and windows here. */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-auto">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Carregando cronograma…</div>
        ) : groups.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Nenhuma tarefa em produção. Ajuste os filtros.</div>
        ) : (
          groups.map((group) => <DataTable<Task> key={group.id} {...tableProps(group)} />)
        )}
      </div>

      <SetSectorModal open={sectorModal.open} onOpenChange={(open) => setSectorModal((s) => ({ ...s, open }))} tasks={sectorModal.tasks} onConfirm={confirmSetSector} />
      <SetTermModal open={termModal.open} onOpenChange={(open) => setTermModal((s) => ({ ...s, open }))} tasks={termModal.tasks} onConfirm={confirmSetTerm} />
      <SetQuoteLayoutModal open={quoteLayoutModal.open} onOpenChange={(open) => setQuoteLayoutModal((s) => ({ ...s, open }))} tasks={quoteLayoutModal.tasks} />
      <SetStatusModal
        open={statusModal.open}
        onOpenChange={(open) => setStatusModal((s) => ({ ...s, open }))}
        tasks={statusModal.tasks}
        onConfirm={confirmSetStatus}
        allowedStatuses={[TASK_STATUS.PREPARATION, TASK_STATUS.WAITING_PRODUCTION, TASK_STATUS.IN_PRODUCTION, TASK_STATUS.COMPLETED, TASK_STATUS.CANCELLED]}
      />
      <TaskDuplicateModal
        task={duplicateModal.tasks[0]}
        open={duplicateModal.open}
        onOpenChange={(open) => setDuplicateModal((s) => ({ ...s, open }))}
        onSuccess={() => setDuplicateModal(CLOSED)}
      />

      <AdvancedBulkActionsHandler ref={advancedActionsRef} selectedTaskIds={new Set(advancedTaskIds)} onClearSelection={() => setAdvancedTaskIds([])} />

      <CopyFromTaskModal
        open={copyState.step === "selecting_fields" || copyState.step === "confirming"}
        onOpenChange={(open) => !open && handleCopyCancel()}
        step={copyState.step === "confirming" ? "confirming" : "selecting_fields"}
        targetTasks={copyState.targetTasks}
        sourceTask={copyState.sourceTask}
        onStartSourceSelection={handleStartSourceSelection}
        onConfirm={handleCopyConfirm}
        onCancel={handleCopyCancel}
        onChangeSource={handleChangeSource}
        userPrivilege={priv}
      />

      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog(CLOSED)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteDialog.tasks.length > 1 ? "Deletar tarefas" : "Deletar tarefa"}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog.tasks.length > 1
                ? `Tem certeza que deseja deletar ${deleteDialog.tasks.length} tarefas? Esta ação não pode ser desfeita.`
                : "Tem certeza que deseja deletar esta tarefa? Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
