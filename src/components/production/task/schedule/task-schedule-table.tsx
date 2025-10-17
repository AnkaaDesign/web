import React, { useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { Task } from "../../../../types";
import { routes, TASK_STATUS } from "../../../../constants";
import { formatDate, getHoursBetween, isDateInPast } from "../../../../utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { DeadlineCountdown } from "./deadline-countdown";
import { getRowColorClass } from "./task-table-utils";
import { IconChevronUp, IconChevronDown, IconSelector } from "@tabler/icons-react";
import { PAINT_FINISH, PAINT_FINISH_LABELS, PAINT_BRAND_LABELS, TRUCK_MANUFACTURER_LABELS } from "../../../../constants";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CanvasNormalMapRenderer } from "@/components/paint/effects/canvas-normal-map-renderer";
import { TaskTableContextMenu, type TaskAction } from "./task-table-context-menu";
import { DuplicateTaskModal } from "./duplicate-task-modal";
import { SetSectorModal } from "./set-sector-modal";
import { SetStatusModal } from "./set-status-modal";
import { useTaskMutations } from "../../../../hooks";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { TableSortUtils, createColumnConfigMap, type SortableColumnConfig, type SortConfig, type SortDirection } from "@/utils/table-sort-utils";

interface TaskScheduleTableProps {
  tasks: Task[];
  visibleColumns?: Set<string>;
}

interface TaskRow extends Task {
  isOverdue: boolean;
  hoursRemaining: number | null;
}

export function TaskScheduleTable({ tasks, visibleColumns }: TaskScheduleTableProps) {
  const navigate = useNavigate();
  const [sortConfigs, setSortConfigs] = useState<SortConfig[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [setSectorModalOpen, setSetSectorModalOpen] = useState(false);
  const [setStatusModalOpen, setSetStatusModalOpen] = useState(false);
  const [taskToDuplicate, setTaskToDuplicate] = useState<Task | null>(null);
  const [tasksToUpdate, setTasksToUpdate] = useState<Task[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tasks: Task[];
  } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    tasks: Task[];
    isBulk: boolean;
  } | null>(null);

  const { updateAsync, createAsync, deleteAsync: deleteTaskAsync, batchUpdateAsync } = useTaskMutations();

  // Custom sort function for serialNumberOrPlate (multi-field)
  const sortSerialNumberOrPlate = useCallback((a: TaskRow, b: TaskRow, direction: SortDirection): number => {
    const aValue = a.serialNumber || a.plate || "";
    const bValue = b.serialNumber || b.plate || "";
    return TableSortUtils.compareValues(aValue, bValue, direction);
  }, []);

  // Define all columns with enhanced sort configuration
  const sortableColumns = useMemo<SortableColumnConfig[]>(
    () => [
      {
        key: "name",
        header: "LOGOMARCA",
        sortable: true,
        accessor: "name",
        dataType: "string",
      },
      {
        key: "customer.fantasyName",
        header: "CLIENTE",
        sortable: true,
        accessor: "customer.fantasyName",
        dataType: "string",
      },
      {
        key: "generalPainting",
        header: "PINTURA",
        sortable: true,
        accessor: (task: TaskRow) => task.generalPainting?.name || "",
        dataType: "string",
      },
      {
        key: "serialNumberOrPlate",
        header: "Nº SÉRIE",
        sortable: true,
        accessor: (task: TaskRow) => task.serialNumber || task.plate || "",
        customSortFunction: sortSerialNumberOrPlate,
        dataType: "custom",
      },
      {
        key: "chassisNumber",
        header: "Nº CHASSI",
        sortable: true,
        accessor: "chassisNumber",
        dataType: "string",
      },
      {
        key: "sector.name",
        header: "SETOR",
        sortable: true,
        accessor: "sector.name",
        dataType: "string",
      },
      {
        key: "entryDate",
        header: "ENTRADA",
        sortable: true,
        accessor: "entryDate",
        dataType: "date",
      },
      {
        key: "startedAt",
        header: "INICIADO EM",
        sortable: true,
        accessor: "startedAt",
        dataType: "date",
      },
      {
        key: "finishedAt",
        header: "FINALIZADO EM",
        sortable: true,
        accessor: "finishedAt",
        dataType: "date",
      },
      {
        key: "term",
        header: "PRAZO",
        sortable: true,
        accessor: "term",
        dataType: "date",
      },
    ],
    [sortSerialNumberOrPlate],
  );

  // Create column config map for sorting
  const columnConfigMap = useMemo(() => createColumnConfigMap(sortableColumns), [sortableColumns]);

  // Define display columns (includes select and non-sortable columns)
  const allColumns = useMemo(
    () => [
      { id: "select", header: "", width: TABLE_LAYOUT.checkbox.className, sortable: false },
      { id: "name", header: "LOGOMARCA", width: "w-[180px]", sortable: true },
      { id: "customer.fantasyName", header: "CLIENTE", width: "w-[150px]", sortable: true },
      { id: "generalPainting", header: "PINTURA", width: "w-[100px]", sortable: true },
      { id: "serialNumberOrPlate", header: "Nº SÉRIE", width: "w-[120px]", sortable: true },
      { id: "chassisNumber", header: "Nº CHASSI", width: "w-[140px]", sortable: true },
      { id: "sector.name", header: "SETOR", width: "w-[120px]", sortable: true },
      { id: "entryDate", header: "ENTRADA", width: "w-[110px]", sortable: true },
      { id: "startedAt", header: "INICIADO EM", width: "w-[110px]", sortable: true },
      { id: "finishedAt", header: "FINALIZADO EM", width: "w-[110px]", sortable: true },
      { id: "term", header: "PRAZO", width: "w-[110px]", sortable: true },
      { id: "remainingTime", header: "TEMPO RESTANTE", width: "w-[130px]", sortable: false },
    ],
    [],
  );

  // All columns are visible by default
  const columns = useMemo(() => {
    const baseColumns = allColumns.filter((col) => col.id === "select");
    const visibleDataColumns = allColumns.filter((col) => {
      if (col.id === "select") return false;
      if (!visibleColumns || visibleColumns.size === 0) return true;
      return visibleColumns.has(col.id);
    });
    return [...baseColumns, ...visibleDataColumns];
  }, [allColumns, visibleColumns]);

  // Prepare tasks with deadline info and apply cumulative sorting
  const preparedTasks = useMemo<TaskRow[]>(() => {
    const tasksWithInfo = tasks.map((task) => {
      const isOverdue = task.term ? isDateInPast(task.term) : false;
      const hoursRemaining = task.term && !isOverdue ? getHoursBetween(new Date(), task.term) : null;

      return {
        ...task,
        isOverdue,
        hoursRemaining,
      };
    });

    // Apply multi-column cumulative sorting
    if (sortConfigs.length > 0) {
      return TableSortUtils.sortItems(tasksWithInfo, sortConfigs, columnConfigMap);
    }

    return tasksWithInfo;
  }, [tasks, sortConfigs, columnConfigMap]);

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedTaskIds(new Set(preparedTasks.map((t) => t.id)));
      } else {
        setSelectedTaskIds(new Set());
      }
    },
    [preparedTasks],
  );

  const handleSelectTask = useCallback(
    (taskId: string, checked: boolean) => {
      const newSelected = new Set(selectedTaskIds);
      if (checked) {
        newSelected.add(taskId);
      } else {
        newSelected.delete(taskId);
      }
      setSelectedTaskIds(newSelected);
    },
    [selectedTaskIds],
  );

  const handleRowClick = useCallback(
    (e: React.MouseEvent, taskId: string) => {
      // Don't navigate if clicking checkbox or if it's a context menu click
      if ((e.target as HTMLElement).closest("[data-checkbox]") || e.button === 2) {
        return;
      }

      // Handle selection with Ctrl/Cmd or Shift
      if (e.ctrlKey || e.metaKey) {
        handleSelectTask(taskId, !selectedTaskIds.has(taskId));
      } else if (e.shiftKey && selectedTaskIds.size > 0) {
        // Implement shift-click range selection
        const lastSelectedId = Array.from(selectedTaskIds).pop();
        const lastSelectedIndex = preparedTasks.findIndex((t) => t.id === lastSelectedId);
        const currentIndex = preparedTasks.findIndex((t) => t.id === taskId);

        if (lastSelectedIndex !== -1 && currentIndex !== -1) {
          const start = Math.min(lastSelectedIndex, currentIndex);
          const end = Math.max(lastSelectedIndex, currentIndex);
          const rangeIds = preparedTasks.slice(start, end + 1).map((t) => t.id);
          setSelectedTaskIds(new Set([...selectedTaskIds, ...rangeIds]));
        }
      } else {
        // Normal click - navigate
        navigate(routes.production.schedule.details(taskId));
      }
    },
    [navigate, selectedTaskIds, preparedTasks, handleSelectTask],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, task: Task) => {
      e.preventDefault();
      e.stopPropagation();

      // Check if clicked task is part of selection
      const isTaskSelected = selectedTaskIds.has(task.id);
      const hasSelection = selectedTaskIds.size > 0;

      if (hasSelection && isTaskSelected) {
        // Show context menu for all selected tasks
        const selectedTasksList = preparedTasks.filter((t) => selectedTaskIds.has(t.id));
        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          tasks: selectedTasksList,
        });
      } else {
        // Show context menu for just the clicked task
        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          tasks: [task],
        });
      }
    },
    [selectedTaskIds, preparedTasks],
  );

  const handleSort = useCallback(
    (column: string, event?: React.MouseEvent) => {
      if (!allColumns.find((col) => col.id === column)?.sortable) return;

      // Always use cumulative multi-sort mode
      const multiSort = true;

      setSortConfigs((currentConfigs) => {
        return TableSortUtils.toggleColumnSort(currentConfigs, column, { multiSort });
      });
    },
    [allColumns],
  );

  const handleAction = useCallback(
    async (action: TaskAction, tasks: Task[]) => {
      switch (action) {
        case "start":
          for (const task of tasks) {
            if (task.status === TASK_STATUS.PENDING || task.status === TASK_STATUS.ON_HOLD) {
              await updateAsync({
                id: task.id,
                data: { status: TASK_STATUS.IN_PRODUCTION, startedAt: new Date() },
              });
            }
          }
          break;

        case "finish":
          for (const task of tasks) {
            if (task.status === TASK_STATUS.IN_PRODUCTION) {
              await updateAsync({
                id: task.id,
                data: { status: TASK_STATUS.COMPLETED, finishedAt: new Date() },
              });
            }
          }
          break;

        case "pause":
          for (const task of tasks) {
            if (task.status === TASK_STATUS.IN_PRODUCTION || task.status === TASK_STATUS.PENDING) {
              await updateAsync({
                id: task.id,
                data: { status: TASK_STATUS.ON_HOLD },
              });
            }
          }
          break;

        case "duplicate":
          if (tasks.length === 1) {
            setTaskToDuplicate(tasks[0]);
            setDuplicateModalOpen(true);
          }
          break;

        case "setSector":
          setTasksToUpdate(tasks);
          setSetSectorModalOpen(true);
          break;

        case "setStatus":
          setTasksToUpdate(tasks);
          setSetStatusModalOpen(true);
          break;

        case "view":
          if (tasks.length === 1) {
            navigate(routes.production.schedule.details(tasks[0].id));
          }
          break;

        case "edit":
          if (tasks.length === 1) {
            navigate(routes.production.schedule.edit(tasks[0].id));
          } else {
            // Batch edit
            const ids = tasks.map((t) => t.id).join(",");
            const batchUrl = `${routes.production.schedule.batchEdit}?ids=${ids}`;
            navigate(batchUrl);
          }
          break;

        case "delete":
          setDeleteDialog({
            tasks,
            isBulk: tasks.length > 1,
          });
          break;
      }
    },
    [updateAsync, createAsync, deleteTaskAsync, navigate],
  );

  const confirmDelete = async () => {
    if (!deleteDialog) return;

    try {
      for (const task of deleteDialog.tasks) {
        await deleteTaskAsync(task.id);
      }
      setSelectedTaskIds(new Set());
    } catch (error) {
      console.error("Error deleting task(s):", error);
    } finally {
      setDeleteDialog(null);
    }
  };

  const handleDuplicateConfirm = async (data: { serialNumber?: string; plate?: string }) => {
    if (!taskToDuplicate) return;

    // Create new task with only the fields expected by taskCreateSchema
    const newTask = {
      // Basic fields
      name: taskToDuplicate.name,
      status: TASK_STATUS.PENDING,
      serialNumber: data.serialNumber || null,
      plate: data.plate || null,
      details: taskToDuplicate.details,
      entryDate: taskToDuplicate.entryDate,
      term: taskToDuplicate.term,
      startedAt: null, // Reset
      finishedAt: null, // Reset

      // ID fields only (no relation objects)
      paintId: taskToDuplicate.paintId,
      customerId: taskToDuplicate.customerId,
      sectorId: taskToDuplicate.sectorId,
      budgetId: taskToDuplicate.budgetId,
      nfeId: taskToDuplicate.nfeId,
      receiptId: taskToDuplicate.receiptId,
      commission: taskToDuplicate.commission, // Required field

      // Relations - only IDs
      artworkIds: taskToDuplicate.artworks?.map((file) => file.id) || [],
      paintIds: taskToDuplicate.logoPaints?.map((paint) => paint.id) || [],

      // Services - ensure it's an array with only required fields
      services: Array.isArray(taskToDuplicate.services)
        ? taskToDuplicate.services.map((service) => ({
            status: service.status,
            statusOrder: service.statusOrder,
            description: service.description,
            startedAt: null, // Reset service dates
            finishedAt: null,
          }))
        : [],

      // Truck (if exists)
      truck: taskToDuplicate.truck
        ? {
            xPosition: taskToDuplicate.truck.xPosition,
            yPosition: taskToDuplicate.truck.yPosition,
            garageId: taskToDuplicate.truck.garageId,
          }
        : null,

      // Observation (if exists)
      observation: taskToDuplicate.observation
        ? {
            description: taskToDuplicate.observation.description,
            artworkIds: taskToDuplicate.observation.artworks?.map((file) => file.id) || [],
          }
        : null,
    };

    await createAsync(newTask);
    setTaskToDuplicate(null);
  };

  const handleSetSectorConfirm = async (sectorId: string | null) => {
    await batchUpdateAsync({
      tasks: tasksToUpdate.map((task) => ({
        id: task.id,
        data: { sectorId },
      })),
    });
    setTasksToUpdate([]);
  };

  const handleSetStatusConfirm = async (status: typeof TASK_STATUS.INVOICED | typeof TASK_STATUS.SETTLED) => {
    try {
      await batchUpdateAsync({
        tasks: tasksToUpdate.map((task) => ({
          id: task.id,
          data: { status },
        })),
      });

      const statusLabel = status === TASK_STATUS.INVOICED ? "Faturado" : "Liquidado";
      const taskCount = tasksToUpdate.length;

      toast.success(
        `${taskCount} tarefa${taskCount > 1 ? "s" : ""} marcada${taskCount > 1 ? "s" : ""} como ${statusLabel}`,
        {
          description: taskCount === 1 ? tasksToUpdate[0].name : `${taskCount} tarefas atualizadas`,
        }
      );

      setTasksToUpdate([]);
      setSelectedTaskIds(new Set());
    } catch (error) {
      toast.error("Erro ao atualizar status", {
        description: "Não foi possível atualizar o status das tarefas. Tente novamente.",
      });
    }
  };

  // Close context menu when clicking outside
  React.useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const getRowClassName = (task: TaskRow) => {
    return cn("cursor-pointer transition-colors", getRowColorClass(task));
  };

  if (tasks.length === 0) {
    return <div className="border rounded-md p-8 text-center text-muted-foreground">Nenhuma tarefa neste setor</div>;
  }

  return (
    <>
      <div className="border border-neutral-400 dark:border-neutral-600 rounded-md overflow-hidden">
        <Table>
          <TableHeader className="[&_tr]:!border-b [&_tr]:border-neutral-400 dark:[&_tr]:border-neutral-600 [&_tr]:hover:bg-muted">
            <TableRow className="bg-muted hover:bg-muted even:bg-muted">
              {columns.map((column) => {
                const isSortable = column.sortable !== false;
                const sortConfig = sortConfigs.find((config) => config.column === column.id);
                const isSorted = !!sortConfig;
                const sortOrder = sortConfig?.order;
                const sortDirection = sortConfig?.direction;

                return (
                  <TableHead key={column.id} className={cn("whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0", column.width)}>
                    {column.id === "select" ? (
                      <div className="flex items-center justify-center h-full w-full px-2 min-h-[2.5rem]">
                        <Checkbox
                          checked={selectedTaskIds.size === preparedTasks.length && preparedTasks.length > 0}
                          indeterminate={selectedTaskIds.size > 0 && selectedTaskIds.size < preparedTasks.length}
                          onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                          data-checkbox
                        />
                      </div>
                    ) : isSortable ? (
                      <button
                        onClick={(e) => handleSort(column.id, e)}
                        className="flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent"
                        title={isSorted ? `Ordenado: ${sortOrder! + 1}º (${sortDirection === "asc" ? "crescente" : "decrescente"}). Clique novamente para inverter direção` : "Clique para adicionar à ordenação"}
                      >
                        <span className="truncate">{column.header}</span>
                        <div className="inline-flex items-center ml-1 gap-0.5">
                          {!isSorted && <IconSelector className="h-4 w-4 text-muted-foreground" />}
                          {isSorted && (
                            <>
                              {sortDirection === "asc" ? (
                                <IconChevronUp className="h-4 w-4 text-foreground" />
                              ) : (
                                <IconChevronDown className="h-4 w-4 text-foreground" />
                              )}
                              {sortConfigs.length > 1 && (
                                <span className="text-[10px] font-bold text-foreground bg-primary/20 rounded-full w-4 h-4 flex items-center justify-center">
                                  {sortOrder! + 1}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </button>
                    ) : (
                      <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                        <span className="truncate">{column.header}</span>
                      </div>
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {preparedTasks.map((task, index) => (
              <tr
                key={task.id}
                className={cn("cursor-pointer transition-colors", index < preparedTasks.length - 1 && "border-b border-neutral-400 dark:border-neutral-600", getRowClassName(task))}
                onClick={(e) => handleRowClick(e, task.id)}
                onContextMenu={(e) => handleContextMenu(e, task)}
              >
                {columns.map((column) => (
                  <TableCell key={column.id} className="py-2 truncate max-w-0 whitespace-nowrap">
                    {column.id === "select" && (
                      <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selectedTaskIds.has(task.id)} onCheckedChange={(checked) => handleSelectTask(task.id, checked as boolean)} data-checkbox />
                      </div>
                    )}
                    {column.id === "name" && <span className="font-medium truncate block">{task.name}</span>}
                    {column.id === "customer.fantasyName" && <span className="truncate block">{task.customer?.fantasyName || "-"}</span>}
                    {column.id === "generalPainting" &&
                      (task.generalPainting
                        ? (() => {
                            const paintFinish = task.generalPainting.finish as PAINT_FINISH;

                            return (
                              <div className="-my-2 flex items-center">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="w-16 h-8">
                                        <CanvasNormalMapRenderer
                                          baseColor={task.generalPainting.hex || "#888888"}
                                          finish={paintFinish || PAINT_FINISH.SOLID}
                                          width={64}
                                          height={32}
                                          quality="medium"
                                          className="w-full h-full rounded-md"
                                        />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs">
                                      <div className="space-y-1">
                                        <div className="font-semibold">{task.generalPainting.name}</div>
                                        <div className="text-xs text-muted-foreground space-y-0.5">
                                          {task.generalPainting.paintType?.name && <div>{task.generalPainting.paintType.name}</div>}
                                          {task.generalPainting.finish && <div>{PAINT_FINISH_LABELS[task.generalPainting.finish as PAINT_FINISH]}</div>}
                                          {task.generalPainting.manufacturer && <div>{TRUCK_MANUFACTURER_LABELS[task.generalPainting.manufacturer]}</div>}
                                          {task.generalPainting.paintBrand?.name && !task.generalPainting.manufacturer && <div>{task.generalPainting.paintBrand?.name}</div>}
                                        </div>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            );
                          })()
                        : "-")}
                    {column.id === "serialNumberOrPlate" && <span className="truncate block font-mono">{task.serialNumber || task.plate || "-"}</span>}
                    {column.id === "chassisNumber" && <span className="truncate block font-mono">{task.chassisNumber || "-"}</span>}
                    {column.id === "sector.name" && <span className="truncate block">{task.sector?.name || "-"}</span>}
                    {column.id === "entryDate" && <span className="truncate block">{task.entryDate ? formatDate(task.entryDate) : "-"}</span>}
                    {column.id === "startedAt" && <span className="truncate block">{task.startedAt ? formatDate(task.startedAt) : "-"}</span>}
                    {column.id === "finishedAt" && <span className="truncate block">{task.finishedAt ? formatDate(task.finishedAt) : "-"}</span>}
                    {column.id === "term" && (task.term ? <span className="truncate block">{formatDate(task.term)}</span> : "-")}
                    {column.id === "remainingTime" &&
                      (task.term && task.status !== TASK_STATUS.COMPLETED && task.status !== TASK_STATUS.CANCELLED ? (
                        <DeadlineCountdown deadline={task.term} isOverdue={task.isOverdue} />
                      ) : (
                        "-"
                      ))}
                  </TableCell>
                ))}
              </tr>
            ))}
          </TableBody>
        </Table>
      </div>

      <DuplicateTaskModal open={duplicateModalOpen} onOpenChange={setDuplicateModalOpen} task={taskToDuplicate} onConfirm={handleDuplicateConfirm} />

      <SetSectorModal open={setSectorModalOpen} onOpenChange={setSetSectorModalOpen} tasks={tasksToUpdate} onConfirm={handleSetSectorConfirm} />

      <SetStatusModal open={setStatusModalOpen} onOpenChange={setSetStatusModalOpen} tasks={tasksToUpdate} onConfirm={handleSetStatusConfirm} />

      <TaskTableContextMenu contextMenu={contextMenu} onClose={() => setContextMenu(null)} onAction={handleAction} />

      {/* Delete Confirmation Dialog */}
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
