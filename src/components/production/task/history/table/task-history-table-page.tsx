import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  IconHistory,
} from "@tabler/icons-react";
import {
  DataTablePage,
  type DataTableRowAction,
  type DataTableRowClickMeta,
  type DataTableFilterValues,
} from "@/components/ui/datatable";
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
import { useSectors, useCustomers, useTaskMutations, useTaskBatchMutations, taskKeys } from "@/hooks";
import { useAuth } from "@/contexts/auth-context";
import { useReturnTo } from "@/hooks/common/use-return-to";
import { getTasks, getTaskById } from "@/api-client";
import { routes, FAVORITE_PAGES, SECTOR_PRIVILEGES, TASK_STATUS } from "@/constants";
import { getTaskQuoteDisplayLabel } from "@/constants/enum-labels";
import type { Task } from "@/types";
import type { CopyableTaskField } from "@/types/task-copy";
import { canDeleteTasks, canFinishTask, canLeaderManageTask } from "@/utils/permissions/entity-permissions";
import { canViewQuote } from "@/utils/permissions/quote-permissions";
import { isTeamLeader } from "@/utils/user";
import { areAllServiceOrdersComplete } from "@/utils/serviceOrder";
import { getTaskQuoteEditRoute } from "@/utils/task";
import { SetStatusModal } from "../../schedule/set-status-modal";
import { SetSectorModal } from "../../schedule/set-sector-modal";
import { SetTermModal } from "../../schedule/set-term-modal";
import { SetQuoteLayoutModal } from "../../schedule/set-quote-layout-modal";
import { CopyFromTaskModal } from "../../schedule/copy-from-task-modal";
import { TaskDuplicateModal } from "../../modals/task-duplicate-modal";
import { AdvancedBulkActionsHandler } from "../../bulk-operations/AdvancedBulkActionsHandler";
import { useTasks } from "@/hooks/production/use-task";
import { createTaskHistoryColumns, TASK_HISTORY_SECTOR_DEFAULTS } from "./task-history-table-columns";
import {
  createTaskHistoryFilterDefs,
  buildTaskHistoryQuery,
  buildTaskHistoryOrderBy,
  TASK_HISTORY_LIST_INCLUDE,
  TASK_HISTORY_DEFAULT_PAGE_SIZE,
} from "./task-history-table-filters";

const EMPTY_PARAMS: { search: string; filters: DataTableFilterValues } = { search: "", filters: {} };
const ADVANCED_GROUP = { id: "advanced", label: "Avançados", icon: <IconSettings2 className="h-4 w-4" /> };
const getRowId = (t: Task) => t.id;

interface CopyFromTaskState {
  step: "idle" | "selecting_fields" | "selecting_source" | "confirming";
  targetTasks: Task[];
  selectedFields: CopyableTaskField[];
  sourceTask: Task | null;
}
const INITIAL_COPY_STATE: CopyFromTaskState = { step: "idle", targetTasks: [], selectedFields: [], sourceTask: null };

type TaskModalState = { open: boolean; tasks: Task[] };
const CLOSED: TaskModalState = { open: false, tasks: [] };

export function TaskHistoryTablePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const returnTo = useReturnTo();
  const [searchParams] = useSearchParams();
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
  const canAccessArtworks = isAdmin || isDesigner || isProductionManager;
  const canAccessCutPlan = isAdmin || isDesigner || isProductionManager;
  const canAccessPaints = canAccessAdvancedMenu && !isDesigner;
  const canCancel = isAdmin || isFinancial || isLogisticOrCommercial;
  const canViewQuoteMenu = canViewQuote(priv || "");
  const canManageStatus = useCallback(
    (rows: Task[]) => isAdmin || (isTeamLeaderUser && rows.every((t) => canLeaderManageTask(user as never, t.sectorId))),
    [isAdmin, isTeamLeaderUser, user],
  );

  // --- search + filters come from the table; page/pageSize/sort ride the URL (server mode) ---
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
  const pageSizeRaw = Number(searchParams.get("pageSize") ?? String(TASK_HISTORY_DEFAULT_PAGE_SIZE));
  const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : TASK_HISTORY_DEFAULT_PAGE_SIZE;
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
      ...buildTaskHistoryQuery(params.filters, params.search),
      page,
      limit: pageSize,
      orderBy: buildTaskHistoryOrderBy(sorting),
      include: TASK_HISTORY_LIST_INCLUDE,
      // staleTime + no focus-refetch: avoids the legacy refetch-on-focus storm on this heavy list.
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    }),
    [params, page, pageSize, sorting],
  );

  const { data: response, isLoading } = useTasks(query as never);
  const rows = (response?.data ?? []) as Task[];
  const totalRecords = response?.meta?.totalRecords ?? 0;

  // Export "all": page through the full filtered set with the same include (so Decimals stay numbers).
  const fetchAllForExport = useCallback(async (): Promise<Task[]> => {
    const PAGE_SIZE = 200;
    const baseQuery = {
      ...buildTaskHistoryQuery(params.filters, params.search),
      orderBy: buildTaskHistoryOrderBy(sorting),
      include: TASK_HISTORY_LIST_INCLUDE,
    };
    const all: Task[] = [];
    for (let p = 1; ; p++) {
      const res = (await getTasks({ ...baseQuery, page: p, limit: PAGE_SIZE } as never)) as
        | { data?: Task[]; meta?: { hasNextPage?: boolean } }
        | undefined;
      const batch = (res?.data ?? []) as Task[];
      all.push(...batch);
      if (res?.meta?.hasNextPage === false || batch.length < PAGE_SIZE) break;
      if (totalRecords > 0 && all.length >= totalRecords) break;
    }
    return all;
  }, [params, sorting, totalRecords]);

  // --- filter option sources ---
  const { data: sectorsData } = useSectors({ orderBy: { name: "asc" }, limit: 100 } as never);
  const { data: customersData } = useCustomers({ orderBy: { fantasyName: "asc" }, limit: 100 } as never);

  const filterDefs = useMemo(
    () =>
      createTaskHistoryFilterDefs({
        sectors: (sectorsData?.data ?? []).map((s) => ({ value: s.id, label: s.name })),
        customers: (customersData?.data ?? []).map((c) => ({ value: c.id, label: c.fantasyName || c.corporateName || "" })),
      }),
    [sectorsData?.data, customersData?.data],
  );

  const columns = useMemo(() => createTaskHistoryColumns(), []);

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
        else navigate(routes.production.history.edit(targets[0].id));
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
          artworks: { include: { file: true } },
          budgets: true,
          invoices: true,
          receipts: true,
          quote: true,
          logoPaints: true,
          cuts: true,
          serviceOrders: true,
          truck: {
            include: {
              leftSideLayout: { include: { layoutSections: true, photo: true } },
              rightSideLayout: { include: { layoutSections: true, photo: true } },
              backSideLayout: { include: { layoutSections: true, photo: true } },
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
        onClick: (r) => window.open(routes.production.history.details(r[0].id), "_blank"),
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
        hidden: () => !canAccessAdvancedMenu || !canAccessArtworks,
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
        label: "Layout do Caminhão",
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
    canAccessArtworks,
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
      navigate(routes.production.history.details(task.id), { state: { ids: meta.orderedIds } });
    },
    [isSelectingSource, handleSourceTaskSelected, navigate],
  );

  return (
    <>
      <DataTablePage<Task>
        title="Histórico de Tarefas"
        icon={IconHistory}
        favoritePage={FAVORITE_PAGES.PRODUCAO_HISTORICO_LISTAR}
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Produção", href: routes.production.root },
          { label: "Histórico" },
        ]}
        headerExtra={
          isSelectingSource ? (
            <div className="flex items-center justify-between rounded-md border border-primary/20 bg-primary/10 p-3">
              <div className="flex items-center gap-2">
                <IconHandClick className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">Clique em uma tarefa para selecionar como origem dos dados</span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleCopyCancel}>
                <IconX className="mr-1 h-4 w-4" />
                Cancelar
              </Button>
            </div>
          ) : undefined
        }
        table={{
          tableId: "task-history-list",
          data: rows,
          columns,
          getRowId,
          mode: "server",
          rowCount: totalRecords,
          filterDefs,
          rowActions,
          onRowClick,
          isLoading,
          onParamsChange,
          onExportFetchAll: fetchAllForExport,
          enableShare: !isWarehouse,
          sectorDefaults: TASK_HISTORY_SECTOR_DEFAULTS,
          defaultPageSize: TASK_HISTORY_DEFAULT_PAGE_SIZE,
          defaultSorting: [{ id: "finishedAt", desc: true }],
          searchPlaceholder: "Buscar por nome, cliente, setor...",
          exportTitle: "Histórico de Tarefas",
          exportFilename: "historico-tarefas",
          emptyMessage: "Nenhuma tarefa encontrada. Ajuste os filtros.",
        }}
      />

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
    </>
  );
}
