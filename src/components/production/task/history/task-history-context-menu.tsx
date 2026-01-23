import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
import { IconEye, IconEdit, IconFileInvoice, IconTrash, IconBuildingFactory2, IconPlayerPlay, IconCheck, IconCopy, IconSettings2, IconPhoto, IconFileText, IconPalette, IconCut, IconClipboardCopy, IconCalendarCheck, IconLayout } from "@tabler/icons-react";
import { useTaskMutations, useTaskBatchMutations } from "../../../../hooks";
import { routes, TASK_STATUS, SECTOR_PRIVILEGES, SERVICE_ORDER_TYPE, SERVICE_ORDER_STATUS } from "../../../../constants";
import type { Task } from "../../../../types";
import { toast } from "sonner";
import { SetStatusModal } from "../schedule/set-status-modal";
import { SetSectorModal } from "../schedule/set-sector-modal";
import { DuplicateTaskModal, type DuplicateTaskCopyData } from "../schedule/duplicate-task-modal";
import { useAuth } from "@/contexts/auth-context";
import { canDeleteTasks } from "@/utils/permissions/entity-permissions";
import { isTeamLeader } from "@/utils/user";
import { canLeaderManageTask } from "@/utils/permissions/entity-permissions";
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
  advancedActionsRef?: React.RefObject<{ openModal: (type: string, taskIds: string[]) => void } | null>;
  onStartCopyFromTask?: (targetTasks: Task[]) => void;
}

export function TaskHistoryContextMenu({
  tasks,
  position,
  onClose,
  selectedIds,
  navigationRoute = 'schedule',
  advancedActionsRef,
  onStartCopyFromTask,
}: TaskHistoryContextMenuProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { update, delete: deleteTask, createAsync } = useTaskMutations();
  const { batchUpdate, batchDeleteAsync } = useTaskBatchMutations();
  const [setStatusModalOpen, setSetStatusModalOpen] = useState(false);
  const [setSectorModalOpen, setSetSectorModalOpen] = useState(false);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(true);
  const openingModalRef = React.useRef(false);
  const justOpenedRef = React.useRef(true);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; tasks: Task[] }>({
    open: false,
    tasks: [],
  });

  const isBulk = selectedIds.length > 1;
  const taskIds = tasks.map(t => t.id);
  const task = tasks[0];

  // Check task statuses for status actions
  const hasInProgressTasks = tasks.some((t) => t.status === TASK_STATUS.IN_PRODUCTION);
  const hasPreparationTasks = tasks.some((t) => t.status === TASK_STATUS.PREPARATION);
  const hasWaitingProductionTasks = tasks.some((t) => t.status === TASK_STATUS.WAITING_PRODUCTION);
  const hasCompletedTasks = tasks.some((t) => t.status === TASK_STATUS.COMPLETED);

  // Permission checks
  const isAdmin = user?.sector?.privileges === SECTOR_PRIVILEGES.ADMIN;
  const isTeamLeaderUser = user ? isTeamLeader(user) : false;
  const canDelete = canDeleteTasks(user);

  // Team leaders can only manage tasks in their managed sector or tasks without sector
  const canLeaderManageTheseTasks = isTeamLeaderUser && tasks.every((t) => canLeaderManageTask(user, t.sectorId));
  const canManageStatus = isAdmin || canLeaderManageTheseTasks;

  // FINANCIAL users should only see View and Edit options
  const isFinancialUser = user?.sector?.privileges === SECTOR_PRIVILEGES.FINANCIAL;

  // Users who can use "Liberar" action: ADMIN, LOGISTIC, and COMMERCIAL only
  const canLiberar = user?.sector?.privileges === SECTOR_PRIVILEGES.ADMIN ||
                     user?.sector?.privileges === SECTOR_PRIVILEGES.LOGISTIC ||
                     user?.sector?.privileges === SECTOR_PRIVILEGES.COMMERCIAL;

  // LOGISTIC and COMMERCIAL users can see limited context menu options (Visualizar, Editar, Liberar)
  const isLogisticOrCommercial = user?.sector?.privileges === SECTOR_PRIVILEGES.LOGISTIC ||
                                  user?.sector?.privileges === SECTOR_PRIVILEGES.COMMERCIAL;

  // Users who can access advanced menu options: ADMIN, COMMERCIAL, FINANCIAL, LOGISTIC
  const canAccessAdvancedMenu = isAdmin || isFinancialUser || isLogisticOrCommercial;

  // Check if we're on the preparation/agenda route (to hide Definir Setor)
  const isPreparationRoute = navigationRoute === 'preparation';

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
    if (setStatusModalOpen || setSectorModalOpen || duplicateModalOpen || deleteDialog.open) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[TaskHistoryContextMenu] Modal/Dialog opened, closing dropdown');
      }
      openingModalRef.current = false;
      setDropdownOpen(false);
    }
  }, [setStatusModalOpen, setSectorModalOpen, duplicateModalOpen, deleteDialog.open]);

  // Close the entire component when dropdown closes and no modals/dialogs are open
  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[TaskHistoryContextMenu] Effect running:', {
        dropdownOpen,
        setStatusModalOpen,
        setSectorModalOpen,
        duplicateModalOpen,
        deleteDialogOpen: deleteDialog.open,
        openingModal: openingModalRef.current,
        shouldClose: !dropdownOpen && !setStatusModalOpen && !setSectorModalOpen && !duplicateModalOpen && !deleteDialog.open && !openingModalRef.current
      });
    }

    // Don't close if we're in the process of opening a modal or if any dialog is open
    if (!dropdownOpen && !setStatusModalOpen && !setSectorModalOpen && !duplicateModalOpen && !deleteDialog.open && !openingModalRef.current) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[TaskHistoryContextMenu] Calling onClose()');
      }
      onClose();
    }
  }, [dropdownOpen, setStatusModalOpen, setSectorModalOpen, duplicateModalOpen, deleteDialog.open, onClose]);

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

  const handleSetStatusConfirm = async (status: TASK_STATUS) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[TaskHistoryContextMenu] handleSetStatusConfirm called with status:', status);
    }
    try {
      if (taskIds.length === 1) {
        // Note: startedAt and finishedAt are auto-filled by the backend when status changes
        const updateData: any = { status };

        await update({
          id: taskIds[0],
          data: updateData
        });
      } else {
        // Note: startedAt and finishedAt are auto-filled by the backend when status changes
        const updates = taskIds.map(id => ({ id, data: { status } }));
        await batchUpdate({ items: updates });
      }
    } catch (error) {
      console.error("Error updating task status:", error);
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
        await deleteTask(tasksToDelete[0].id);
      } else {
        await batchDeleteAsync({ taskIds: tasksToDelete.map(t => t.id) });
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error deleting task(s):", error);
      }
    } finally {
      setDeleteDialog({ open: false, tasks: [] });
    }
  };

  // Status action handlers
  // Note: Artwork validation removed for manual status changes
  // Automatic sync still works - when artwork SO becomes COMPLETED, task auto-transitions
  const handleStart = async () => {
    try {
      // Proceed with updates for all tasks (no artwork validation for manual changes)
      for (const t of tasks) {
        // PREPARATION tasks go to WAITING_PRODUCTION (cronograma)
        if (t.status === TASK_STATUS.PREPARATION) {
          // Note: Only update status, preserve all other fields including sector
          await update({
            id: t.id,
            data: {
              status: TASK_STATUS.WAITING_PRODUCTION,
            },
          });
        }
        // WAITING_PRODUCTION tasks go to IN_PRODUCTION
        else if (t.status === TASK_STATUS.WAITING_PRODUCTION) {
          await update({
            id: t.id,
            data: {
              status: TASK_STATUS.IN_PRODUCTION,
              startedAt: new Date(),
            },
          });
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error starting task(s):", error);
      }
    }
    setDropdownOpen(false);
  };

  const handleFinish = async () => {
    try {
      // First, validate ALL tasks before making any updates
      for (const t of tasks) {
        if (t.status === TASK_STATUS.IN_PRODUCTION) {
          const taskName = t.name || t.serialNumber || t.plate || 'Tarefa';

          // Get all PRODUCTION service orders for this task
          const productionServiceOrders = t.serviceOrders?.filter(
            (service) => service && service.type === SERVICE_ORDER_TYPE.PRODUCTION
          ) || [];

          // REQUIREMENT 1: Task MUST have at least one production service order
          if (productionServiceOrders.length === 0) {
            toast.error("Não é possível finalizar", {
              description: `${taskName}: A tarefa deve ter pelo menos uma ordem de serviço de produção antes de finalizar.`,
            });
            setDropdownOpen(false);
            return;
          }

          // REQUIREMENT 2: ALL production service orders must be COMPLETED
          const hasIncompleteProduction = productionServiceOrders.some(
            (service) => !service.status || service.status !== SERVICE_ORDER_STATUS.COMPLETED
          );

          if (hasIncompleteProduction) {
            toast.error("Não é possível finalizar", {
              description: `${taskName}: Todas as ordens de serviço de produção devem estar concluídas antes de finalizar a tarefa.`,
            });
            setDropdownOpen(false);
            return;
          }
        }
      }

      // If validation passed for all tasks, proceed with updates
      for (const t of tasks) {
        if (t.status === TASK_STATUS.IN_PRODUCTION) {
          await update({
            id: t.id,
            data: { status: TASK_STATUS.COMPLETED, finishedAt: new Date() },
          });
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error finishing task(s):", error);
      }
    }
    setDropdownOpen(false);
  };

  const handleLiberar = async () => {
    try {
      // Update all PREPARATION tasks to set forecast date to today
      for (const t of tasks) {
        if (t.status === TASK_STATUS.PREPARATION) {
          await update({
            id: t.id,
            data: { forecastDate: new Date() },
          });
        }
      }

      toast.success(
        isBulk ? "Tarefas liberadas" : "Tarefa liberada",
        {
          description: isBulk
            ? `${tasks.length} tarefa(s) com previsão atualizada para hoje`
            : "Previsão atualizada para hoje",
        }
      );
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error releasing task(s):", error);
      }
      toast.error("Erro ao liberar tarefa(s)", {
        description: "Não foi possível atualizar a previsão. Tente novamente.",
      });
    }
    setDropdownOpen(false);
  };

  const handleDuplicate = () => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[TaskHistoryContextMenu] handleDuplicate called');
    }
    openingModalRef.current = true;
    setDuplicateModalOpen(true);
  };

  const handleDuplicateConfirm = async (copies: DuplicateTaskCopyData) => {
    if (!task || copies.length === 0) return;

    try {
      // Build task data for each copy
      // NOTE: task.artworks are now Artwork entities with { id, fileId, status, file?: File }
      // We need to extract File IDs (artwork.fileId or artwork.file.id), not Artwork entity IDs
      const buildTaskData = (copyData: { serialNumber?: string; plate?: string }) => ({
        // Basic fields
        name: task.name,
        status: TASK_STATUS.PREPARATION,
        serialNumber: copyData.serialNumber || null,
        plate: copyData.plate || null,
        details: task.details,
        entryDate: task.entryDate,
        term: task.term,
        startedAt: null,
        finishedAt: null,

        // ID fields only (no relation objects)
        paintId: task.paintId,
        customerId: task.customerId,
        sectorId: task.sectorId,
        budgetIds: task.budgets?.map((b: any) => b.id) || [],
        invoiceIds: task.invoices?.map((i: any) => i.id) || [],
        receiptIds: task.receipts?.map((r: any) => r.id) || [],
        commission: task.commission,

        // Relations - only IDs
        // artworkIds must be File IDs, not Artwork entity IDs
        artworkIds: task.artworks?.map((artwork: any) => artwork.fileId || artwork.file?.id || artwork.id) || [],
        paintIds: task.logoPaints?.map((paint) => paint.id) || [],

        // Services
        services: Array.isArray(task.serviceOrders)
          ? task.serviceOrders.map((service) => ({
              status: service.status,
              statusOrder: service.statusOrder,
              description: service.description,
              startedAt: null,
              finishedAt: null,
            }))
          : [],

        // Truck
        truck: task.truck || copyData.plate
          ? {
              plate: copyData.plate || task.truck?.plate || null,
              chassisNumber: task.truck?.chassisNumber || null,
              spot: task.truck?.spot || null,
            }
          : null,

        // Observation - artworkIds must also be File IDs
        observation: task.observation
          ? {
              description: task.observation.description,
              artworkIds: task.observation.artworks?.map((artwork: any) => artwork.fileId || artwork.file?.id || artwork.id) || [],
            }
          : null,
      });

      const tasksToCreate = copies.map(buildTaskData);
      await Promise.all(tasksToCreate.map(taskData => createAsync(taskData)));
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error duplicating task:", error);
      }
    }
  };

  // Advanced bulk operations handlers
  const handleBulkArts = () => {
    if (advancedActionsRef?.current) {
      advancedActionsRef.current.openModal("arts", taskIds);
    }
    setDropdownOpen(false);
  };

  const handleBulkBaseFiles = () => {
    if (advancedActionsRef?.current) {
      advancedActionsRef.current.openModal("baseFiles", taskIds);
    }
    setDropdownOpen(false);
  };

  const handleBulkServiceOrder = () => {
    if (advancedActionsRef?.current) {
      advancedActionsRef.current.openModal("serviceOrder", taskIds);
    }
    setDropdownOpen(false);
  };

  const handleBulkLayout = () => {
    if (advancedActionsRef?.current) {
      advancedActionsRef.current.openModal("layout", taskIds);
    }
    setDropdownOpen(false);
  };

  const handleBulkPaints = () => {
    if (advancedActionsRef?.current) {
      advancedActionsRef.current.openModal("paints", taskIds);
    }
    setDropdownOpen(false);
  };

  const handleBulkCuttingPlans = () => {
    if (advancedActionsRef?.current) {
      advancedActionsRef.current.openModal("cuttingPlans", taskIds);
    }
    setDropdownOpen(false);
  };

  const handleCopyFromTask = () => {
    if (onStartCopyFromTask) {
      onStartCopyFromTask(tasks);
    }
    setDropdownOpen(false);
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

          {/* Liberar action - Only for PREPARATION status tasks and ADMIN/LOGISTIC/COMMERCIAL users */}
          {hasPreparationTasks && canLiberar && (
            <DropdownMenuItem onClick={handleLiberar} className="text-blue-600 hover:text-white">
              <IconCalendarCheck className="mr-2 h-4 w-4" />
              Liberar
            </DropdownMenuItem>
          )}

          {/* Status actions - Team leaders (sector match) and ADMIN only */}
          {canManageStatus && (hasPreparationTasks || hasWaitingProductionTasks) && (
            <DropdownMenuItem onClick={handleStart} className="text-green-700 hover:text-white">
              <IconPlayerPlay className="mr-2 h-4 w-4" />
              {isPreparationRoute ? "Disponibilizar para produção" : "Iniciar"}
            </DropdownMenuItem>
          )}

          {canManageStatus && hasInProgressTasks && (
            <DropdownMenuItem onClick={handleFinish} className="text-green-700 hover:text-white">
              <IconCheck className="mr-2 h-4 w-4" />
              Finalizar
            </DropdownMenuItem>
          )}

          {/* Separator if we have status actions */}
          {(hasPreparationTasks || (canManageStatus && (hasInProgressTasks || hasPreparationTasks || hasWaitingProductionTasks))) && <DropdownMenuSeparator />}

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
            {isBulk ? "Editar em lote" : "Editar"}
          </DropdownMenuItem>

          {/* Admin-only actions: duplicate, setSector (conditionally), setStatus */}
          {isAdmin && !isBulk && (
            <DropdownMenuItem onClick={handleDuplicate}>
              <IconCopy className="mr-2 h-4 w-4" />
              Criar Cópias
            </DropdownMenuItem>
          )}

          {/* Set Sector action - Admin only, hidden for preparation route */}
          {isAdmin && !isPreparationRoute && (
            <DropdownMenuItem
              onClick={handleSetSector}
              onSelect={(e) => e.preventDefault()}
            >
              <IconBuildingFactory2 className="mr-2 h-4 w-4" />
              {tasks.some((t) => t.sectorId) ? "Alterar Setor" : "Definir Setor"}
            </DropdownMenuItem>
          )}

          {/* Set Status for completed tasks */}
          {isAdmin && hasCompletedTasks && (
            <DropdownMenuItem
              onClick={handleSetStatus}
              onSelect={(e) => e.preventDefault()}
            >
              <IconFileInvoice className="mr-2 h-4 w-4" />
              Alterar Status
            </DropdownMenuItem>
          )}

          {/* Advanced bulk operations - ADMIN, COMMERCIAL, FINANCIAL, LOGISTIC */}
          {canAccessAdvancedMenu && <DropdownMenuSeparator />}

          {canAccessAdvancedMenu && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="data-[state=open]:bg-accent data-[state=open]:text-accent-foreground">
                <IconSettings2 className="mr-2 h-4 w-4" />
                <span className="data-[state=open]:text-accent-foreground">Avançados</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={handleBulkArts}>
                  <IconPhoto className="mr-2 h-4 w-4" />
                  Adicionar Artes
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleBulkBaseFiles}>
                  <IconFileText className="mr-2 h-4 w-4" />
                  Arquivos Base
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleBulkPaints}>
                  <IconPalette className="mr-2 h-4 w-4" />
                  Adicionar Tintas
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleBulkCuttingPlans}>
                  <IconCut className="mr-2 h-4 w-4" />
                  Adicionar Plano de Corte
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleBulkServiceOrder}>
                  <IconFileInvoice className="mr-2 h-4 w-4" />
                  Ordem de Servico
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleBulkLayout}>
                  <IconLayout className="mr-2 h-4 w-4" />
                  Layout
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleCopyFromTask}>
                  <IconClipboardCopy className="mr-2 h-4 w-4" />
                  Copiar de Outra Tarefa
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}

          {/* Delete action - ADMIN only */}
          {canDelete && <DropdownMenuSeparator />}

          {canDelete && (
            <DropdownMenuItem onClick={handleDelete} className="text-destructive">
              <IconTrash className="mr-2 h-4 w-4" />
              {isBulk ? "Excluir selecionadas" : "Excluir"}
            </DropdownMenuItem>
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
        allowedStatuses={[TASK_STATUS.PREPARATION, TASK_STATUS.WAITING_PRODUCTION, TASK_STATUS.IN_PRODUCTION, TASK_STATUS.COMPLETED, TASK_STATUS.CANCELLED]}
      />

      {/* Duplicate Task Modal */}
      <DuplicateTaskModal
        open={duplicateModalOpen}
        onOpenChange={(open) => {
          if (process.env.NODE_ENV !== 'production') {
            console.log('[TaskHistoryContextMenu] DuplicateTaskModal onOpenChange:', open);
          }
          setDuplicateModalOpen(open);
        }}
        task={task}
        onConfirm={handleDuplicateConfirm}
      />

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