import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
import { IconEye, IconEdit, IconFileInvoice, IconTrash, IconBuildingFactory2, IconArrowBackUp } from "@tabler/icons-react";
import { useTaskMutations, useTaskBatchMutations } from "../../../../hooks";
import { getChangeLogs } from "../../../../api-client";
import { routes, TASK_STATUS, SECTOR_PRIVILEGES } from "../../../../constants";
import type { Task } from "../../../../types";
import { SetStatusModal } from "../schedule/set-status-modal";
import { SetSectorModal } from "../schedule/set-sector-modal";
import { useAuth } from "@/contexts/auth-context";
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

interface TaskHistoryContextMenuProps {
  tasks: Task[];
  position: { x: number; y: number };
  onClose: () => void;
  selectedIds: string[];
  navigationRoute?: 'history' | 'preparation' | 'schedule';
}

export function TaskHistoryContextMenu({
  tasks,
  position,
  onClose,
  selectedIds,
  navigationRoute = 'schedule'
}: TaskHistoryContextMenuProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { update, remove } = useTaskMutations();
  const { batchUpdate, batchDelete } = useTaskBatchMutations();
  const [setStatusModalOpen, setSetStatusModalOpen] = useState(false);
  const [setSectorModalOpen, setSetSectorModalOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(true);
  const openingModalRef = React.useRef(false);
  const justOpenedRef = React.useRef(true);
  const [restoreDialog, setRestoreDialog] = useState<{ open: boolean; tasks: Task[] }>({
    open: false,
    tasks: [],
  });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; tasks: Task[] }>({
    open: false,
    tasks: [],
  });

  const isBulk = selectedIds.length > 1;
  const taskIds = tasks.map(t => t.id);
  const task = tasks[0];

  // Check if all tasks are ON_HOLD
  const allTasksOnHold = tasks.every(t => t.status === TASK_STATUS.ON_HOLD);

  // FINANCIAL users should only see View and Edit options
  const isFinancialUser = user?.sector?.privileges === SECTOR_PRIVILEGES.FINANCIAL;

  // Reset justOpened flag whenever position changes (new right-click)
  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[TaskHistoryContextMenu] Position changed, resetting justOpenedRef');
    }
    justOpenedRef.current = true;
    setDropdownOpen(true);

    const timer = setTimeout(() => {
      justOpenedRef.current = false;
    }, 100);
    return () => clearTimeout(timer);
  }, [position.x, position.y]);

  // When a modal or dialog opens, close the dropdown
  React.useEffect(() => {
    if (setStatusModalOpen || setSectorModalOpen || restoreDialog.open || deleteDialog.open) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[TaskHistoryContextMenu] Modal/Dialog opened, closing dropdown');
      }
      openingModalRef.current = false;
      setDropdownOpen(false);
    }
  }, [setStatusModalOpen, setSectorModalOpen, restoreDialog.open, deleteDialog.open]);

  // Close the entire component when dropdown closes and no modals/dialogs are open
  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[TaskHistoryContextMenu] Effect running:', {
        dropdownOpen,
        setStatusModalOpen,
        setSectorModalOpen,
        restoreDialogOpen: restoreDialog.open,
        deleteDialogOpen: deleteDialog.open,
        openingModal: openingModalRef.current,
        shouldClose: !dropdownOpen && !setStatusModalOpen && !setSectorModalOpen && !restoreDialog.open && !deleteDialog.open && !openingModalRef.current
      });
    }

    // Don't close if we're in the process of opening a modal or if any dialog is open
    if (!dropdownOpen && !setStatusModalOpen && !setSectorModalOpen && !restoreDialog.open && !deleteDialog.open && !openingModalRef.current) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[TaskHistoryContextMenu] Calling onClose()');
      }
      onClose();
    }
  }, [dropdownOpen, setStatusModalOpen, setSectorModalOpen, restoreDialog.open, deleteDialog.open, onClose]);

  const handleView = () => {
    if (task && !isBulk) {
      navigate(routes.production.schedule.details(task.id));
    }
    setDropdownOpen(false);
  };

  const handleEdit = () => {
    if (taskIds.length === 1) {
      const editRoute =
        navigationRoute === 'preparation' ? routes.production.preparation.edit(taskIds[0]) :
        navigationRoute === 'history' ? routes.production.history.edit(taskIds[0]) :
        routes.production.schedule.edit(taskIds[0]);
      navigate(editRoute);
    } else if (taskIds.length > 1) {
      // Navigate to batch edit page if available
      const ids = taskIds.join(",");
      navigate(`${routes.production.schedule.root}/editar-em-lote?ids=${ids}`);
    }
    setDropdownOpen(false);
  };

  const handleSetSector = () => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[TaskHistoryContextMenu] handleSetSector called');
    }
    openingModalRef.current = true;
    setSetSectorModalOpen(true);
  };

  const handleSetSectorConfirm = async (sectorId: string | null) => {
    try {
      if (taskIds.length === 1) {
        await update({
          id: taskIds[0],
          data: { sectorId }
        });
      } else {
        const updates = taskIds.map(id => ({
          id,
          data: { sectorId }
        }));
        await batchUpdate({ items: updates });
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error updating task sector:", error);
      }
    }
  };

  const handleSetStatus = () => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[TaskHistoryContextMenu] handleSetStatus called');
    }
    openingModalRef.current = true;
    setSetStatusModalOpen(true);
  };

  const handleSetStatusConfirm = async (status: typeof TASK_STATUS.IN_PRODUCTION | typeof TASK_STATUS.COMPLETED | typeof TASK_STATUS.INVOICED | typeof TASK_STATUS.SETTLED) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[TaskHistoryContextMenu] handleSetStatusConfirm called with status:', status);
    }
    try {
      if (taskIds.length === 1) {
        const updateData: any = { status };

        // Set startedAt when changing to IN_PRODUCTION
        if (status === TASK_STATUS.IN_PRODUCTION) {
          updateData.startedAt = task?.startedAt || new Date();
        }
        // Set finishedAt when changing to COMPLETED
        else if (status === TASK_STATUS.COMPLETED) {
          updateData.finishedAt = task?.finishedAt || new Date();
          updateData.startedAt = task?.startedAt || new Date();
        }

        await update({
          id: taskIds[0],
          data: updateData
        });
      } else {
        const updates = taskIds.map(id => {
          const updateData: any = { status };

          if (status === TASK_STATUS.IN_PRODUCTION) {
            updateData.startedAt = new Date();
          } else if (status === TASK_STATUS.COMPLETED) {
            updateData.finishedAt = new Date();
            updateData.startedAt = new Date();
          }

          return { id, data: updateData };
        });
        await batchUpdate({ items: updates });
      }
    } catch (error) {
      console.error("Error updating task status:", error);
    }
  };

  const handleRestore = () => {
    setRestoreDialog({ open: true, tasks });
    setDropdownOpen(false);
  };

  const handleRestoreConfirm = async () => {
    const tasksToRestore = restoreDialog.tasks;
    try {
      // Process each task
      const updates = await Promise.all(
        tasksToRestore.map(async (task) => {
          try {
            // Fetch changelogs for this task
            const changelogsResponse = await getChangeLogs({
              entityType: "Task",
              entityId: task.id,
              field: "status",
              orderBy: { createdAt: "desc" },
              limit: 100,
            });

            // Find the changelog entry where the task was put ON_HOLD
            const onHoldChange = changelogsResponse.data.find(
              (log: any) => log.field === "status" && log.newValue === TASK_STATUS.ON_HOLD
            );

            if (onHoldChange && onHoldChange.oldValue) {
              const previousStatus = onHoldChange.oldValue;
              if (process.env.NODE_ENV !== 'production') {
                console.log(`[TaskHistoryContextMenu] Restoring task ${task.id} to previous status:`, previousStatus);
              }

              const updateData: any = { status: previousStatus };

              // Set appropriate dates based on the status
              // Always include dates for statuses that require them
              if (previousStatus === TASK_STATUS.IN_PRODUCTION) {
                updateData.startedAt = task.startedAt || new Date();
              } else if (previousStatus === TASK_STATUS.COMPLETED) {
                updateData.finishedAt = task.finishedAt || new Date();
                updateData.startedAt = task.startedAt || new Date();
              }

              return { id: task.id, data: updateData };
            } else {
              if (process.env.NODE_ENV !== 'production') {
                console.warn(`[TaskHistoryContextMenu] No previous status found for task ${task.id}, defaulting to PENDING`);
              }
              return { id: task.id, data: { status: TASK_STATUS.PENDING } };
            }
          } catch (error) {
            if (process.env.NODE_ENV !== 'production') {
              console.error(`Error fetching changelog for task ${task.id}:`, error);
            }
            // Default to PENDING if we can't fetch the changelog
            return { id: task.id, data: { status: TASK_STATUS.PENDING } };
          }
        })
      );

      if (updates.length === 1) {
        await update(updates[0]);
      } else {
        await batchUpdate({ items: updates });
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error restoring task(s):", error);
      }
    } finally {
      setRestoreDialog({ open: false, tasks: [] });
    }
  };

  const handleDelete = () => {
    setDeleteDialog({ open: true, tasks });
    setDropdownOpen(false);
  };

  const handleDeleteConfirm = async () => {
    const tasksToDelete = deleteDialog.tasks;
    try {
      if (tasksToDelete.length === 1) {
        await remove(tasksToDelete[0].id);
      } else {
        await batchDelete({ taskIds: tasksToDelete.map(t => t.id) });
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error deleting task(s):", error);
      }
    } finally {
      setDeleteDialog({ open: false, tasks: [] });
    }
  };

  if (!position || taskIds.length === 0) return null;

  // WAREHOUSE users should not see any context menu
  if (user?.sector?.privileges === SECTOR_PRIVILEGES.WAREHOUSE) {
    return null;
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log('[TaskHistoryContextMenu] Rendering with states:', {
      dropdownOpen,
      setStatusModalOpen,
      setSectorModalOpen,
      taskIds: taskIds.length
    });
  }

  return (
    <>
      <DropdownMenu open={dropdownOpen} onOpenChange={(open) => !open && setDropdownOpen(false)}>
        <PositionedDropdownMenuContent
          position={position}
          isOpen={dropdownOpen}
          className="w-56"
          onCloseAutoFocus={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => {
            // Prevent menu from closing on the initial pointer event that opened it
            if (justOpenedRef.current) {
              if (process.env.NODE_ENV !== 'production') {
                console.log('[TaskHistoryContextMenu] Preventing close on initial pointer down');
              }
              e.preventDefault();
            }
          }}
          onInteractOutside={(e) => {
            // Prevent menu from closing on the initial interaction that opened it
            if (justOpenedRef.current) {
              if (process.env.NODE_ENV !== 'production') {
                console.log('[TaskHistoryContextMenu] Preventing close on initial interact');
              }
              e.preventDefault();
            }
          }}
        >
          {isBulk && (
            <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
              {taskIds.length} tarefas selecionadas
            </div>
          )}

          {/* View action - single selection only */}
          {!isBulk && task && (
            <DropdownMenuItem onClick={handleView}>
              <IconEye className="mr-2 h-4 w-4" />
              Visualizar
            </DropdownMenuItem>
          )}

          {/* Edit action */}
          <DropdownMenuItem onClick={handleEdit}>
            <IconEdit className="mr-2 h-4 w-4" />
            {isBulk ? "Editar selecionadas" : "Editar"}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Restore or Set Status action - Available for all users including FINANCIAL */}
          {allTasksOnHold ? (
            // Show "Restaurar" only for ON_HOLD tasks
            <DropdownMenuItem onClick={handleRestore}>
              <IconArrowBackUp className="mr-2 h-4 w-4" />
              Restaurar
            </DropdownMenuItem>
          ) : (
            // Show "Definir Status" for non-ON_HOLD tasks
            <DropdownMenuItem
              onClick={handleSetStatus}
              onSelect={(e) => e.preventDefault()}
            >
              <IconFileInvoice className="mr-2 h-4 w-4" />
              Definir Status
            </DropdownMenuItem>
          )}

          {/* Additional actions - not available for FINANCIAL users */}
          {!isFinancialUser && (
            <>
              {/* Set Sector action */}
              <DropdownMenuItem
                onClick={handleSetSector}
                onSelect={(e) => e.preventDefault()}
              >
                <IconBuildingFactory2 className="mr-2 h-4 w-4" />
                {tasks.some((t) => t.sectorId) ? "Alterar Setor" : "Definir Setor"}
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* Delete action */}
              <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                <IconTrash className="mr-2 h-4 w-4" />
                {isBulk ? "Deletar selecionadas" : "Deletar"}
              </DropdownMenuItem>
            </>
          )}
        </PositionedDropdownMenuContent>
      </DropdownMenu>

      {/* Set Sector Modal */}
      <SetSectorModal
        open={setSectorModalOpen}
        onOpenChange={(open) => {
          if (process.env.NODE_ENV !== 'production') {
            console.log('[TaskHistoryContextMenu] SetSectorModal onOpenChange:', open);
          }
          setSetSectorModalOpen(open);
        }}
        tasks={tasks}
        onConfirm={handleSetSectorConfirm}
      />

      {/* Set Status Modal */}
      <SetStatusModal
        open={setStatusModalOpen}
        onOpenChange={(open) => {
          if (process.env.NODE_ENV !== 'production') {
            console.log('[TaskHistoryContextMenu] SetStatusModal onOpenChange:', open);
          }
          setSetStatusModalOpen(open);
        }}
        tasks={tasks}
        onConfirm={handleSetStatusConfirm}
        allowedStatuses={[TASK_STATUS.IN_PRODUCTION, TASK_STATUS.COMPLETED, TASK_STATUS.INVOICED, TASK_STATUS.SETTLED]}
      />

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={restoreDialog.open} onOpenChange={(open) => setRestoreDialog({ open, tasks: [] })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {restoreDialog.tasks.length > 1 ? "Restaurar tarefas" : "Restaurar tarefa"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {restoreDialog.tasks.length > 1
                ? `Tem certeza que deseja restaurar ${restoreDialog.tasks.length} tarefas para o status anterior? As tarefas serão retornadas ao status que tinham antes de serem colocadas em espera.`
                : "Tem certeza que deseja restaurar esta tarefa para o status anterior? A tarefa será retornada ao status que tinha antes de ser colocada em espera."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreConfirm}>
              Restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, tasks: [] })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteDialog.tasks.length > 1 ? "Deletar tarefas" : "Deletar tarefa"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog.tasks.length > 1
                ? `Tem certeza que deseja deletar ${deleteDialog.tasks.length} tarefas? Esta ação não pode ser desfeita.`
                : "Tem certeza que deseja deletar esta tarefa? Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}