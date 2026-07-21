import React, { useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import type { Task } from "../../../../types";
import { routes, TASK_STATUS, SECTOR_PRIVILEGES } from "../../../../constants";
import { getTaskQuoteDisplayLabel } from "@/constants/enum-labels";
import { useAuth } from "@/contexts/auth-context";
import { canEditTasks, canDeleteTasks, canFinishTask, canLeaderManageTask } from "@/utils/permissions/entity-permissions";
import { canViewQuote } from "@/utils/permissions/quote-permissions";
import { isTeamLeader } from "@/utils/user";
import { areAllServiceOrdersComplete } from "@/utils/serviceOrder";
import { getTaskQuoteEditRoute } from "@/utils/task";
import { useReturnTo } from "@/hooks/common/use-return-to";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { IconChevronUp, IconChevronDown, IconSelector } from "@tabler/icons-react";
import {
  IconPlayerPlay,
  IconCheck,
  IconCopy,
  IconBuildingFactory2,
  IconEdit,
  IconTrash,
  IconFileInvoice,
  IconSettings2,
  IconPhoto,
  IconFileText,
  IconPalette,
  IconCut,
  IconClipboardCopy,
  IconLayout,
  IconCalendarTime,
  IconReceipt,
} from "@tabler/icons-react";
import { DataTableContextMenu, type DataTableContextMenuState, type DataTableRowAction } from "@/components/ui/datatable";
import { getRowColorClass } from "./task-table-utils";
import { createTaskScheduleColumns } from "./task-schedule-columns";
import { TaskDuplicateModal } from "../modals/task-duplicate-modal";
import { SetSectorModal } from "./set-sector-modal";
import { SetStatusModal } from "./set-status-modal";
import { SetTermModal } from "./set-term-modal";
import { SetQuoteLayoutModal } from "./set-quote-layout-modal";
import { AdvancedBulkActionsHandler } from "../bulk-operations/AdvancedBulkActionsHandler";
import { useTaskMutations, useTaskBatchMutations } from "../../../../hooks";
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

/** Internal action keys — mirror the previous bespoke context-menu (TaskAction). */
type TaskAction =
  | "start"
  | "finish"
  | "duplicate"
  | "setSector"
  | "setTerm"
  | "setStatus"
  | "edit"
  | "delete"
  | "bulkArts"
  | "bulkBaseFiles"
  | "bulkPaints"
  | "bulkCuttingPlans"
  | "copyFromTask"
  | "bulkServiceOrder"
  | "bulkLayout"
  | "quote"
  | "quoteLayout";

interface TaskScheduleTableProps {
  tasks: Task[];
  visibleColumns?: Set<string>;
  selectedTaskIds?: Set<string>;
  onSelectedTaskIdsChange?: (ids: Set<string>) => void;
  advancedActionsRef?: React.RefObject<{ openModal: (type: string, taskIds: string[]) => void } | null>;
  allSelectedTasks?: Task[]; // All selected tasks from all tables
  isSelectingSourceTask?: boolean; // True when in "copy from task" source selection mode
  onSourceTaskSelect?: (task: Task) => void; // Callback when source task is selected
  onStartCopyFromTask?: (targetTasks: Task[]) => void; // Callback to start copy from task flow
  // Props for cross-table shift+click selection
  onShiftClickSelect?: (taskId: string) => void; // Handler for shift+click selection across tables
  onSingleClickSelect?: (taskId: string) => void; // Handler to update last clicked task
}

export function TaskScheduleTable({
  tasks,
  visibleColumns,
  selectedTaskIds: externalSelectedTaskIds,
  onSelectedTaskIdsChange,
  advancedActionsRef: externalAdvancedActionsRef,
  allSelectedTasks,
  isSelectingSourceTask,
  onSourceTaskSelect,
  onStartCopyFromTask,
  onShiftClickSelect,
  onSingleClickSelect,
}: TaskScheduleTableProps) {
  const navigate = useNavigate();
  const returnTo = useReturnTo();
  const { user } = useAuth();
  const canEdit = canEditTasks(user);

  // Selection: shared across all sector tables when the parent provides it.
  const [internalSelectedTaskIds, setInternalSelectedTaskIds] = useState<Set<string>>(new Set());
  const selectedTaskIds = externalSelectedTaskIds ?? internalSelectedTaskIds;
  const setSelectedTaskIds = onSelectedTaskIdsChange ?? setInternalSelectedTaskIds;

  const [taskToDuplicate, setTaskToDuplicate] = useState<Task | null>(null);
  const [setSectorModalOpen, setSetSectorModalOpen] = useState(false);
  const [setStatusModalOpen, setSetStatusModalOpen] = useState(false);
  const [setTermModalOpen, setSetTermModalOpen] = useState(false);
  const [quoteLayoutModalOpen, setQuoteLayoutModalOpen] = useState(false);
  const [tasksToUpdate, setTasksToUpdate] = useState<Task[]>([]);

  const internalAdvancedActionsRef = React.useRef<{ openModal: (type: string, taskIds: string[]) => void } | null>(null);
  const advancedActionsRef = externalAdvancedActionsRef ?? internalAdvancedActionsRef;

  const [contextMenu, setContextMenu] = useState<DataTableContextMenuState<Task> | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ tasks: Task[] } | null>(null);

  const { updateAsync, deleteAsync: deleteTaskAsync } = useTaskMutations();
  const { batchUpdateAsync } = useTaskBatchMutations();

  // --- shared column model (DataTable base column defs) ---
  const columns = useMemo(() => createTaskScheduleColumns({ includeServiceOrders: false }), []);

  // Controlled visibility from the shared ColumnVisibilityManager (parent-owned Set). Empty/undefined
  // Set → show every column, mirroring the previous behavior.
  const columnVisibility = useMemo<VisibilityState>(() => {
    const v: VisibilityState = {};
    for (const c of columns) {
      v[c.id] = !visibleColumns || visibleColumns.size === 0 ? true : visibleColumns.has(c.id);
    }
    return v;
  }, [columns, visibleColumns]);

  // Per-group cumulative multi-sort (each sector table sorts independently, as before).
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable<Task>({
    data: tasks,
    columns,
    state: { columnVisibility, sorting },
    onSortingChange: setSorting,
    getRowId: (t) => t.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableSorting: true,
    enableMultiSort: true,
    isMultiSortEvent: () => true,
    enableSortingRemoval: true,
    maxMultiSortColCount: 5,
  });

  const rows = table.getRowModel().rows;
  const preparedTaskIds = useMemo(() => rows.map((r) => r.id), [rows]);

  // --- selection helpers (shared Set) ---
  const handleSelectAll = useCallback(
    (checked: boolean) => {
      const next = new Set(selectedTaskIds);
      if (checked) preparedTaskIds.forEach((id) => next.add(id));
      else preparedTaskIds.forEach((id) => next.delete(id));
      setSelectedTaskIds(next);
    },
    [preparedTaskIds, selectedTaskIds, setSelectedTaskIds],
  );

  const handleSelectTask = useCallback(
    (taskId: string, checked: boolean) => {
      const next = new Set(selectedTaskIds);
      if (checked) next.add(taskId);
      else next.delete(taskId);
      setSelectedTaskIds(next);
    },
    [selectedTaskIds, setSelectedTaskIds],
  );

  const handleRowClick = useCallback(
    (e: React.MouseEvent, taskId: string) => {
      if ((e.target as HTMLElement).closest("[data-checkbox]") || e.button === 2) return;

      // Source-pick mode (copy from task): click picks the source.
      if (isSelectingSourceTask && onSourceTaskSelect) {
        const task = tasks.find((t) => t.id === taskId);
        if (task) onSourceTaskSelect(task);
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        handleSelectTask(taskId, !selectedTaskIds.has(taskId));
        onSingleClickSelect?.(taskId);
      } else if (e.shiftKey) {
        if (onShiftClickSelect) onShiftClickSelect(taskId);
      } else {
        navigate(routes.production.schedule.details(taskId));
      }
    },
    [navigate, selectedTaskIds, tasks, handleSelectTask, isSelectingSourceTask, onSourceTaskSelect, onShiftClickSelect, onSingleClickSelect],
  );

  // --- bulk-action dispatch (opens modals / calls mutations / advanced handler) ---
  const handleAction = useCallback(
    async (action: TaskAction, actionTasks: Task[]) => {
      switch (action) {
        case "start":
          for (const task of actionTasks) {
            if (task.status === TASK_STATUS.WAITING_PRODUCTION || task.status === TASK_STATUS.PREPARATION) {
              await updateAsync({ id: task.id, data: { status: TASK_STATUS.IN_PRODUCTION } });
            }
          }
          break;
        case "finish":
          for (const task of actionTasks) {
            if (task.status === TASK_STATUS.IN_PRODUCTION) {
              await updateAsync({ id: task.id, data: { status: TASK_STATUS.COMPLETED } });
            }
          }
          break;
        case "duplicate":
          if (actionTasks.length === 1) setTaskToDuplicate(actionTasks[0]);
          break;
        case "setSector":
          setTasksToUpdate(actionTasks);
          setSetSectorModalOpen(true);
          break;
        case "setStatus":
          setTasksToUpdate(actionTasks);
          setSetStatusModalOpen(true);
          break;
        case "setTerm":
          setTasksToUpdate(actionTasks);
          setSetTermModalOpen(true);
          break;
        case "quoteLayout":
          setTasksToUpdate(actionTasks);
          setQuoteLayoutModalOpen(true);
          break;
        case "edit":
          if (actionTasks.length === 1) {
            if (user?.sector?.privileges === SECTOR_PRIVILEGES.COMMERCIAL) {
              navigate(getTaskQuoteEditRoute(actionTasks[0]), { state: { returnTo } });
            } else {
              navigate(routes.production.schedule.edit(actionTasks[0].id));
            }
          } else {
            const ids = actionTasks.map((t) => t.id).join(",");
            navigate(`${routes.production.schedule.batchEdit}?ids=${ids}`);
          }
          break;
        case "quote":
          if (actionTasks.length === 1) navigate(getTaskQuoteEditRoute(actionTasks[0]), { state: { returnTo } });
          break;
        case "delete":
          setDeleteDialog({ tasks: actionTasks });
          break;
        case "bulkArts":
          advancedActionsRef.current?.openModal("arts", actionTasks.map((t) => t.id));
          break;
        case "bulkBaseFiles":
          advancedActionsRef.current?.openModal("baseFiles", actionTasks.map((t) => t.id));
          break;
        case "bulkPaints":
          advancedActionsRef.current?.openModal("paints", actionTasks.map((t) => t.id));
          break;
        case "bulkCuttingPlans":
          advancedActionsRef.current?.openModal("cuttingPlans", actionTasks.map((t) => t.id));
          break;
        case "bulkServiceOrder":
          advancedActionsRef.current?.openModal("serviceOrder", actionTasks.map((t) => t.id));
          break;
        case "bulkLayout":
          advancedActionsRef.current?.openModal("layout", actionTasks.map((t) => t.id));
          break;
        case "copyFromTask":
          onStartCopyFromTask?.(actionTasks);
          break;
      }
    },
    [updateAsync, navigate, returnTo, user, advancedActionsRef, onStartCopyFromTask],
  );

  // --- right-click context menu: reuse the DataTable base menu (DataTableContextMenu +
  //     DataTableRowAction). Rows target the SHARED cross-table selection when the clicked row is
  //     part of it, else just the clicked row (matches the previous behavior). ---
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, task: Task) => {
      e.preventDefault();
      e.stopPropagation();
      const hasSelection = selectedTaskIds.size > 0;
      const targets =
        hasSelection && selectedTaskIds.has(task.id)
          ? allSelectedTasks && allSelectedTasks.length > 0
            ? allSelectedTasks
            : tasks.filter((t) => selectedTaskIds.has(t.id))
          : [task];
      setContextMenu({ x: e.clientX, y: e.clientY, rows: targets, isBulk: targets.length > 1 });
    },
    [selectedTaskIds, allSelectedTasks, tasks],
  );

  // User-level permission flags (row-independent).
  const isAdmin = user?.sector?.privileges === SECTOR_PRIVILEGES.ADMIN;
  const isProductionManager = user?.sector?.privileges === SECTOR_PRIVILEGES.PRODUCTION_MANAGER;
  const isCommercial = user?.sector?.privileges === SECTOR_PRIVILEGES.COMMERCIAL;
  const isTeamLeaderUser = user ? isTeamLeader(user) : false;
  const canDelete = canDeleteTasks(user);
  const canFinish = canFinishTask(user);
  const userCanViewQuote = canViewQuote(user?.sector?.privileges || "");

  const menuRows = contextMenu?.rows ?? [];
  const advancedGroup = useMemo(() => ({ id: "advanced", label: "Avançados", icon: <IconSettings2 className="mr-2 h-4 w-4" /> }), []);

  const rowActions = useMemo<DataTableRowAction<Task>[]>(() => {
    const canManageStatus = (rs: Task[]) => isAdmin || (isTeamLeaderUser && rs.every((t) => canLeaderManageTask(user, t.sectorId)));
    const hasFinishable = (rs: Task[]) => rs.some((t) => t.status === TASK_STATUS.IN_PRODUCTION && areAllServiceOrdersComplete(t.serviceOrders));
    const hasWaiting = (rs: Task[]) => rs.some((t) => t.status === TASK_STATUS.WAITING_PRODUCTION);
    const hasPreparation = (rs: Task[]) => rs.some((t) => t.status === TASK_STATUS.PREPARATION);

    return [
      {
        key: "start",
        label: "Iniciar",
        icon: <IconPlayerPlay className="mr-2 h-4 w-4 text-green-700" />,
        hidden: (rs) => !(canManageStatus(rs) && (hasWaiting(rs) || hasPreparation(rs))),
        onClick: (rs) => handleAction("start", rs),
      },
      {
        key: "finish",
        label: "Finalizar",
        icon: <IconCheck className="mr-2 h-4 w-4 text-green-700" />,
        hidden: (rs) => !(canFinish && hasFinishable(rs)),
        onClick: (rs) => handleAction("finish", rs),
      },
      {
        key: "edit",
        label: menuRows.length > 1 ? "Editar em lote" : "Editar",
        icon: <IconEdit className="mr-2 h-4 w-4" />,
        separatorBefore: true,
        hidden: () => !canEdit,
        onClick: (rs) => handleAction("edit", rs),
      },
      {
        key: "duplicate",
        label: "Criar Cópias",
        icon: <IconCopy className="mr-2 h-4 w-4" />,
        hidden: (rs) => !((isAdmin || isCommercial) && rs.length === 1),
        onClick: (rs) => handleAction("duplicate", rs),
      },
      {
        key: "quote",
        label: getTaskQuoteDisplayLabel(menuRows[0]?.quote?.status),
        icon: <IconReceipt className="mr-2 h-4 w-4" />,
        hidden: (rs) => !(userCanViewQuote && rs.length === 1 && !isCommercial),
        onClick: (rs) => handleAction("quote", rs),
      },
      {
        key: "setSector",
        label: menuRows.some((t) => t.sectorId) ? "Alterar Setor" : "Definir Setor",
        icon: <IconBuildingFactory2 className="mr-2 h-4 w-4" />,
        hidden: () => !(isAdmin || isProductionManager),
        onClick: (rs) => handleAction("setSector", rs),
      },
      {
        key: "setTerm",
        label: menuRows.some((t) => t.term) ? "Alterar Prazo" : "Definir Prazo",
        icon: <IconCalendarTime className="mr-2 h-4 w-4" />,
        hidden: () => !(isAdmin || isProductionManager || isCommercial),
        onClick: (rs) => handleAction("setTerm", rs),
      },
      {
        key: "quoteLayout",
        label: "Adicionar Layout",
        icon: <IconPhoto className="mr-2 h-4 w-4" />,
        hidden: () => !isCommercial,
        onClick: (rs) => handleAction("quoteLayout", rs),
      },
      {
        key: "setStatus",
        label: "Alterar Status",
        icon: <IconFileInvoice className="mr-2 h-4 w-4" />,
        hidden: () => !isAdmin,
        onClick: (rs) => handleAction("setStatus", rs),
      },
      // --- "Avançados" submenu (ADMIN only) ---
      {
        key: "bulkArts",
        label: "Adicionar Layouts",
        icon: <IconPhoto className="mr-2 h-4 w-4" />,
        separatorBefore: true,
        group: advancedGroup,
        hidden: () => !isAdmin,
        onClick: (rs) => handleAction("bulkArts", rs),
      },
      {
        key: "bulkBaseFiles",
        label: "Arquivos Base",
        icon: <IconFileText className="mr-2 h-4 w-4" />,
        group: advancedGroup,
        hidden: () => !isAdmin,
        onClick: (rs) => handleAction("bulkBaseFiles", rs),
      },
      {
        key: "bulkPaints",
        label: "Adicionar Tintas",
        icon: <IconPalette className="mr-2 h-4 w-4" />,
        group: advancedGroup,
        hidden: () => !isAdmin,
        onClick: (rs) => handleAction("bulkPaints", rs),
      },
      {
        key: "bulkCuttingPlans",
        label: "Adicionar Plano de Corte",
        icon: <IconCut className="mr-2 h-4 w-4" />,
        group: advancedGroup,
        hidden: () => !isAdmin,
        onClick: (rs) => handleAction("bulkCuttingPlans", rs),
      },
      {
        key: "bulkServiceOrder",
        label: "Ordem de Serviço",
        icon: <IconFileInvoice className="mr-2 h-4 w-4" />,
        group: advancedGroup,
        hidden: () => !isAdmin,
        onClick: (rs) => handleAction("bulkServiceOrder", rs),
      },
      {
        key: "bulkLayout",
        label: "Medidas do Implemento",
        icon: <IconLayout className="mr-2 h-4 w-4" />,
        group: advancedGroup,
        hidden: () => !isAdmin,
        onClick: (rs) => handleAction("bulkLayout", rs),
      },
      {
        key: "copyFromTask",
        label: "Copiar de Outra Tarefa",
        icon: <IconClipboardCopy className="mr-2 h-4 w-4" />,
        separatorBefore: true,
        group: advancedGroup,
        hidden: () => !isAdmin,
        onClick: (rs) => handleAction("copyFromTask", rs),
      },
      // --- delete (ADMIN only) ---
      {
        key: "delete",
        label: menuRows.length > 1 ? "Excluir selecionadas" : "Excluir",
        icon: <IconTrash className="mr-2 h-4 w-4" />,
        variant: "destructive",
        separatorBefore: true,
        hidden: () => !canDelete,
        onClick: (rs) => handleAction("delete", rs),
      },
    ];
  }, [menuRows, advancedGroup, isAdmin, isProductionManager, isCommercial, isTeamLeaderUser, canEdit, canDelete, canFinish, userCanViewQuote, user, handleAction]);

  // --- modal confirm handlers ---
  const confirmDelete = async () => {
    if (!deleteDialog) return;
    try {
      for (const task of deleteDialog.tasks) await deleteTaskAsync(task.id);
      setSelectedTaskIds(new Set());
    } catch {
      // api-client already surfaced the error toast
    } finally {
      setDeleteDialog(null);
    }
  };

  const handleSetSectorConfirm = async (sectorId: string | null) => {
    await batchUpdateAsync({ tasks: tasksToUpdate.map((task) => ({ id: task.id, data: { sectorId } })) });
    setTasksToUpdate([]);
  };

  const handleSetStatusConfirm = async (status: TASK_STATUS) => {
    try {
      await batchUpdateAsync({ tasks: tasksToUpdate.map((task) => ({ id: task.id, data: { status } })) });
      const count = tasksToUpdate.length;
      toast.success(`${count} tarefa${count > 1 ? "s" : ""} atualizada${count > 1 ? "s" : ""}`, {
        description: count === 1 ? tasksToUpdate[0].name : `${count} tarefas atualizadas`,
      });
      setTasksToUpdate([]);
      setSelectedTaskIds(new Set());
    } catch {
      toast.error("Erro ao atualizar status", { description: "Não foi possível atualizar o status das tarefas. Tente novamente." });
    }
  };

  const handleSetTermConfirm = async (term: Date | null) => {
    await batchUpdateAsync({ tasks: tasksToUpdate.map((task) => ({ id: task.id, data: { term } })) });
    setTasksToUpdate([]);
  };

  if (tasks.length === 0) {
    return <div className="rounded-md border p-8 text-center text-muted-foreground">Nenhuma tarefa neste setor</div>;
  }

  const headers = table.getHeaderGroups()[0]?.headers ?? [];
  const multiSort = sorting.length > 1;
  const allSelectedInGroup = preparedTaskIds.length > 0 && preparedTaskIds.every((id) => selectedTaskIds.has(id));
  const someSelectedInGroup = preparedTaskIds.some((id) => selectedTaskIds.has(id));

  return (
    <>
      <div className="task-schedule-table overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader className="[&_tr]:!border-b [&_tr]:border-border [&_tr]:hover:bg-muted">
            <TableRow className="bg-muted even:bg-muted hover:bg-muted">
              {canEdit && (
                <TableHead className="w-10 bg-muted p-0 !border-r-0">
                  <div className="flex h-full min-h-[2.5rem] w-full items-center justify-center px-2">
                    <Checkbox
                      checked={allSelectedInGroup}
                      indeterminate={someSelectedInGroup && !allSelectedInGroup}
                      onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                      data-checkbox
                    />
                  </div>
                </TableHead>
              )}
              {headers.map((header) => {
                const column = header.column;
                const canSort = column.getCanSort();
                const sorted = column.getIsSorted();
                const align = column.columnDef.meta?.align ?? "left";
                const width = column.getSize();
                return (
                  <TableHead
                    key={header.id}
                    style={{ width, minWidth: column.columnDef.minSize }}
                    className="whitespace-nowrap bg-muted p-0 text-xs font-bold uppercase text-foreground !border-r-0"
                  >
                    {canSort ? (
                      <button
                        onClick={column.getToggleSortingHandler()}
                        className={cn(
                          "flex h-full min-h-[2.5rem] w-full cursor-pointer items-center gap-1 border-0 bg-transparent px-4 py-2 transition-colors hover:bg-muted/80",
                          align === "right" && "justify-end",
                          align === "center" && "justify-center",
                        )}
                        title={sorted ? "Clique novamente para inverter/ remover a ordenação" : "Clique para ordenar"}
                      >
                        <span className="truncate">{flexRender(column.columnDef.header, header.getContext())}</span>
                        <span className="inline-flex items-center gap-0.5">
                          {!sorted && <IconSelector className="h-4 w-4 text-muted-foreground" />}
                          {sorted === "asc" && <IconChevronUp className="h-4 w-4 text-foreground" />}
                          {sorted === "desc" && <IconChevronDown className="h-4 w-4 text-foreground" />}
                          {sorted && multiSort && column.getSortIndex() >= 0 && (
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-foreground">
                              {column.getSortIndex() + 1}
                            </span>
                          )}
                        </span>
                      </button>
                    ) : (
                      <div className="flex h-full min-h-[2.5rem] items-center px-4 py-2">
                        <span className="truncate">{flexRender(column.columnDef.header, header.getContext())}</span>
                      </div>
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => {
              const task = row.original;
              return (
                <tr
                  key={row.id}
                  className={cn(
                    "cursor-pointer transition-colors",
                    index < rows.length - 1 && "border-b border-border/50",
                    getRowColorClass(task),
                    isSelectingSourceTask && "hover:outline hover:outline-2 hover:-outline-offset-2 hover:outline-primary",
                  )}
                  onClick={(e) => handleRowClick(e, task.id)}
                  onContextMenu={canEdit ? (e) => handleContextMenu(e, task) : undefined}
                >
                  {canEdit && (
                    <TableCell className="w-10 py-2">
                      <div
                        className="flex items-center justify-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          const isSelected = selectedTaskIds.has(task.id);
                          if (e.shiftKey && onShiftClickSelect) {
                            onShiftClickSelect(task.id);
                          } else {
                            handleSelectTask(task.id, !isSelected);
                            if (!isSelected) onSingleClickSelect?.(task.id);
                          }
                        }}
                      >
                        <Checkbox checked={selectedTaskIds.has(task.id)} onCheckedChange={() => {}} data-checkbox />
                      </div>
                    </TableCell>
                  )}
                  {row.getVisibleCells().map((cell) => {
                    const align = cell.column.columnDef.meta?.align ?? "left";
                    return (
                      <TableCell
                        key={cell.id}
                        style={{ width: cell.column.getSize() }}
                        className={cn(
                          "max-w-0 truncate whitespace-nowrap py-2",
                          align === "right" && "text-right",
                          align === "center" && "text-center",
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    );
                  })}
                </tr>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <TaskDuplicateModal
        task={taskToDuplicate}
        open={!!taskToDuplicate}
        onOpenChange={(open) => {
          if (!open) setTaskToDuplicate(null);
        }}
        onSuccess={() => setTaskToDuplicate(null)}
      />

      <SetSectorModal open={setSectorModalOpen} onOpenChange={setSetSectorModalOpen} tasks={tasksToUpdate} onConfirm={handleSetSectorConfirm} />
      <SetStatusModal open={setStatusModalOpen} onOpenChange={setSetStatusModalOpen} tasks={tasksToUpdate} onConfirm={handleSetStatusConfirm} />
      <SetTermModal open={setTermModalOpen} onOpenChange={setSetTermModalOpen} tasks={tasksToUpdate} onConfirm={handleSetTermConfirm} />
      <SetQuoteLayoutModal open={quoteLayoutModalOpen} onOpenChange={setQuoteLayoutModalOpen} tasks={tasksToUpdate} />

      {/* Only render AdvancedBulkActionsHandler if using internal ref (not shared with the content). */}
      {!externalAdvancedActionsRef && (
        <AdvancedBulkActionsHandler ref={advancedActionsRef} selectedTaskIds={selectedTaskIds} onClearSelection={() => setSelectedTaskIds(new Set())} />
      )}

      <DataTableContextMenu state={contextMenu} onClose={() => setContextMenu(null)} actions={rowActions} />

      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {deleteDialog?.tasks.length} tarefa{deleteDialog?.tasks.length !== 1 ? "s" : ""}? Esta ação não pode ser desfeita.
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
