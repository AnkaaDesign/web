import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
import { IconExternalLink, IconEdit, IconFileInvoice, IconTrash, IconBuildingFactory2, IconPlayerPlay, IconCheck, IconCopy, IconSettings2, IconPhoto, IconFileText, IconPalette, IconCut, IconClipboardCopy, IconCalendarCheck, IconLayout, IconX, IconDoorEnter, IconReceipt } from "@tabler/icons-react";
import { useTaskMutations, useTaskBatchMutations } from "../../../../hooks";
import { routes, TASK_STATUS, SECTOR_PRIVILEGES } from "../../../../constants";
import { getTaskQuoteDisplayLabel, isTaskQuoteBillingPhase } from "@/constants/enum-labels";
import type { Task } from "../../../../types";
import { toast } from "@/components/ui/sonner";
import { SetStatusModal } from "../schedule/set-status-modal";
import { SetSectorModal } from "../schedule/set-sector-modal";
import { TaskDuplicateModal } from "../modals/task-duplicate-modal";
import { useAuth } from "@/contexts/auth-context";
import { canDeleteTasks, canFinishTask } from "@/utils/permissions/entity-permissions";
import { canViewQuote } from "@/utils/permissions/quote-permissions";
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
  const { update, delete: deleteTask } = useTaskMutations();
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
  const hasNonCancelledTasks = tasks.some((t) => t.status !== TASK_STATUS.CANCELLED);

  // Permission checks
  const isAdmin = user?.sector?.privileges === SECTOR_PRIVILEGES.ADMIN;
  const isTeamLeaderUser = user ? isTeamLeader(user as any) : false;
  const canDelete = canDeleteTasks(user as any);

  // Team leaders can only manage tasks in their led sector or tasks without sector
  const canLeaderManageTheseTasks = isTeamLeaderUser && tasks.every((t) => canLeaderManageTask(user as any, t.sectorId));
  const canManageStatus = isAdmin || canLeaderManageTheseTasks;
  const canFinish = canFinishTask(user as any);

  // FINANCIAL users should only see View and Edit options
  const isFinancialUser = user?.sector?.privileges === SECTOR_PRIVILEGES.FINANCIAL;

  // Users who can use "Liberar" action: PRODUCTION, LOGISTIC, PRODUCTION_MANAGER, COMMERCIAL, and ADMIN
  const canLiberar = user?.sector?.privileges === SECTOR_PRIVILEGES.PRODUCTION ||
                     user?.sector?.privileges === SECTOR_PRIVILEGES.LOGISTIC ||
                     user?.sector?.privileges === SECTOR_PRIVILEGES.PRODUCTION_MANAGER ||
                     user?.sector?.privileges === SECTOR_PRIVILEGES.COMMERCIAL ||
                     user?.sector?.privileges === SECTOR_PRIVILEGES.ADMIN;

  // Users who can use "Dar Entrada" action: ADMIN, LOGISTIC, and PRODUCTION_MANAGER
  const canDarEntrada = user?.sector?.privileges === SECTOR_PRIVILEGES.ADMIN ||
                        user?.sector?.privileges === SECTOR_PRIVILEGES.LOGISTIC ||
                        user?.sector?.privileges === SECTOR_PRIVILEGES.PRODUCTION_MANAGER;

  // LOGISTIC and COMMERCIAL users can see limited context menu options (Visualizar, Editar, Liberar)
  const isLogisticOrCommercial = user?.sector?.privileges === SECTOR_PRIVILEGES.LOGISTIC ||
                                  user?.sector?.privileges === SECTOR_PRIVILEGES.COMMERCIAL;

  const isDesigner = user?.sector?.privileges === SECTOR_PRIVILEGES.DESIGNER;
  const isCommercial = user?.sector?.privileges === SECTOR_PRIVILEGES.COMMERCIAL;
  const isProductionManager = user?.sector?.privileges === SECTOR_PRIVILEGES.PRODUCTION_MANAGER;

  // Users who can access advanced menu options: ADMIN, COMMERCIAL, FINANCIAL, LOGISTIC, DESIGNER
  const canAccessAdvancedMenu = isAdmin || isFinancialUser || isLogisticOrCommercial || isDesigner;

  // Per-item advanced menu permissions
  const canAccessArtworks = isAdmin || isCommercial || isDesigner;
  const canAccessCutPlan = isAdmin || isDesigner;
  const canAccessPaints = canAccessAdvancedMenu && !isDesigner;

  // Users who can cancel tasks: ADMIN, LOGISTIC, FINANCIAL, COMMERCIAL
  const canCancel = isAdmin || isFinancialUser || isLogisticOrCommercial;

  if (process.env.NODE_ENV !== 'production') {
    console.log('[TaskHistoryContextMenu] Cancel permission check:', {
      userPrivilege: user?.sector?.privileges,
      isAdmin,
      isFinancialUser,
      isLogisticOrCommercial,
      canCancel,
      hasNonCancelledTasks,
    });
  }

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
      window.open(routes.production.schedule.details(task.id), '_blank');
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
        await batchUpdate({ tasks: updates });
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
        await batchUpdate({ tasks: updates });
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
      // Finish all IN_PRODUCTION tasks — the API auto-completes any remaining production SOs
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
      // Update PREPARATION and WAITING_PRODUCTION tasks to mark as cleared (released)
      for (const t of tasks) {
        if (t.status === TASK_STATUS.PREPARATION || t.status === TASK_STATUS.WAITING_PRODUCTION) {
          // If task has no forecast date yet, set it to now along with cleared
          const data: Record<string, any> = { cleared: true };
          if (!t.forecastDate) {
            data.forecastDate = new Date();
          }
          await update({
            id: t.id,
            data,
          });
        }
      }

      toast.success(
        isBulk ? "Tarefas liberadas" : "Tarefa liberada",
        {
          description: isBulk
            ? `${tasks.length} tarefa(s) liberada(s) com sucesso`
            : "Tarefa liberada com sucesso",
        }
      );
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error releasing task(s):", error);
      }
      toast.error("Erro ao liberar tarefa(s)", {
        description: "Não foi possível liberar a tarefa. Tente novamente.",
      });
    }
    setDropdownOpen(false);
  };

  const handleDarEntrada = async () => {
    try {
      // Update all PREPARATION or WAITING_PRODUCTION tasks to set entry date to now
      for (const t of tasks) {
        if (t.status === TASK_STATUS.PREPARATION || t.status === TASK_STATUS.WAITING_PRODUCTION) {
          await update({
            id: t.id,
            data: { entryDate: new Date(), cleared: true },
          });
        }
      }

      toast.success(
        isBulk ? "Entrada registrada" : "Entrada registrada",
        {
          description: isBulk
            ? `${tasks.length} tarefa(s) com data de entrada atualizada para agora`
            : "Data de entrada atualizada para agora",
        }
      );
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error setting entry date:", error);
      }
      toast.error("Erro ao dar entrada", {
        description: "Não foi possível atualizar a data de entrada. Tente novamente.",
      });
    }
    setDropdownOpen(false);
  };

  const handleCancel = async () => {
    try {
      // Update all non-cancelled tasks to CANCELLED status
      for (const t of tasks) {
        if (t.status !== TASK_STATUS.CANCELLED) {
          await update({
            id: t.id,
            data: { status: TASK_STATUS.CANCELLED },
          });
        }
      }

      toast.success(
        isBulk ? "Tarefas canceladas" : "Tarefa cancelada",
        {
          description: isBulk
            ? `${tasks.length} tarefa(s) foram canceladas`
            : "A tarefa foi cancelada com sucesso",
        }
      );
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error cancelling task(s):", error);
      }
      toast.error("Erro ao cancelar tarefa(s)", {
        description: "Não foi possível cancelar. Tente novamente.",
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
          className="w-72"
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

          {/* Liberado action - For PREPARATION/WAITING_PRODUCTION tasks and ADMIN/LOGISTIC/COMMERCIAL users */}
          {(hasPreparationTasks || hasWaitingProductionTasks) && canLiberar && (
            tasks.every((t) => t.cleared) ? (
              <DropdownMenuItem disabled className="text-blue-600 opacity-70">
                <IconCalendarCheck className="mr-2 h-4 w-4" />
                <span className="truncate">Liberado</span>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={handleLiberar} className="text-blue-600 hover:text-white">
                <IconCalendarCheck className="mr-2 h-4 w-4" />
                <span className="truncate">Liberado</span>
              </DropdownMenuItem>
            )
          )}

          {/* Dar Entrada action - Only for PREPARATION/WAITING_PRODUCTION tasks and ADMIN/LOGISTIC users */}
          {(hasPreparationTasks || hasWaitingProductionTasks) && canDarEntrada && (
            <DropdownMenuItem onClick={handleDarEntrada} className="text-emerald-600 hover:text-white">
              <IconDoorEnter className="mr-2 h-4 w-4" />
              <span className="truncate">Dar Entrada</span>
            </DropdownMenuItem>
          )}

          {/* Status actions - Team leaders (sector match) and ADMIN only */}
          {canManageStatus && (isPreparationRoute ? hasPreparationTasks : (hasPreparationTasks || hasWaitingProductionTasks)) && (
            <DropdownMenuItem onClick={handleStart} className="text-green-700 hover:text-white">
              <IconPlayerPlay className="mr-2 h-4 w-4" />
              <span className="truncate">{isPreparationRoute ? "Disponibilizar para produção" : "Iniciar"}</span>
            </DropdownMenuItem>
          )}

          {canFinish && hasInProgressTasks && (
            <DropdownMenuItem onClick={handleFinish} className="text-green-700 hover:text-white">
              <IconCheck className="mr-2 h-4 w-4" />
              <span className="truncate">Finalizar</span>
            </DropdownMenuItem>
          )}

          {/* Separator if we have status actions */}
          {(hasPreparationTasks || (canManageStatus && (hasPreparationTasks || hasWaitingProductionTasks)) || (canFinish && hasInProgressTasks)) && <DropdownMenuSeparator />}

          {/* View action - single selection only */}
          {!isBulk && task && (
            <DropdownMenuItem onClick={handleView}>
              <IconExternalLink className="mr-2 h-4 w-4" />
              <span className="truncate">Abrir em nova guia</span>
            </DropdownMenuItem>
          )}

          {/* Edit action */}
          <DropdownMenuItem onClick={handleEdit}>
            <IconEdit className="mr-2 h-4 w-4" />
            <span className="truncate">{isBulk ? "Editar em lote" : "Editar"}</span>
          </DropdownMenuItem>

          {/* Duplicate - ADMIN and COMMERCIAL */}
          {(isAdmin || isCommercial) && !isBulk && (
            <DropdownMenuItem onClick={handleDuplicate}>
              <IconCopy className="mr-2 h-4 w-4" />
              <span className="truncate">Criar Cópias</span>
            </DropdownMenuItem>
          )}

          {/* Quote - ADMIN, FINANCIAL, COMMERCIAL (single selection only) */}
          {canViewQuote(user?.sector?.privileges || "") && !isBulk && (
            <DropdownMenuItem onClick={() => {
              const route = isTaskQuoteBillingPhase(task.quote?.status)
                ? routes.financial.billing.details(task.id)
                : routes.financial.budget.details(task.id);
              navigate(route);
              setDropdownOpen(false);
            }}>
              <IconReceipt className="mr-2 h-4 w-4" />
              <span className="truncate">{getTaskQuoteDisplayLabel(task.quote?.status)}</span>
            </DropdownMenuItem>
          )}

          {/* Set Sector action - Admin and Production Manager */}
          {(isAdmin || isProductionManager) && (
            <DropdownMenuItem
              onClick={handleSetSector}
              onSelect={(e) => e.preventDefault()}
            >
              <IconBuildingFactory2 className="mr-2 h-4 w-4" />
              <span className="truncate">{tasks.some((t) => t.sectorId) ? "Alterar Setor" : "Definir Setor"}</span>
            </DropdownMenuItem>
          )}

          {/* Set Status for completed tasks */}
          {isAdmin && hasCompletedTasks && (
            <DropdownMenuItem
              onClick={handleSetStatus}
              onSelect={(e) => e.preventDefault()}
            >
              <IconFileInvoice className="mr-2 h-4 w-4" />
              <span className="truncate">Alterar Status</span>
            </DropdownMenuItem>
          )}

          {/* Advanced bulk operations - ADMIN, COMMERCIAL, FINANCIAL, LOGISTIC */}
          {canAccessAdvancedMenu && <DropdownMenuSeparator />}

          {canAccessAdvancedMenu && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="data-[state=open]:bg-accent data-[state=open]:text-accent-foreground">
                <IconSettings2 className="mr-2 h-4 w-4" />
                <span className="truncate data-[state=open]:text-accent-foreground">Avançados</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {canAccessArtworks && (
                  <DropdownMenuItem onClick={handleBulkArts}>
                    <IconPhoto className="mr-2 h-4 w-4" />
                    <span className="truncate">Adicionar Layouts</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleBulkBaseFiles}>
                  <IconFileText className="mr-2 h-4 w-4" />
                  <span className="truncate">Arquivos Base</span>
                </DropdownMenuItem>
                {canAccessPaints && (
                  <DropdownMenuItem onClick={handleBulkPaints}>
                    <IconPalette className="mr-2 h-4 w-4" />
                    <span className="truncate">Adicionar Tintas</span>
                  </DropdownMenuItem>
                )}
                {canAccessCutPlan && (
                  <DropdownMenuItem onClick={handleBulkCuttingPlans}>
                    <IconCut className="mr-2 h-4 w-4" />
                    <span className="truncate">Adicionar Plano de Corte</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleBulkServiceOrder}>
                  <IconFileInvoice className="mr-2 h-4 w-4" />
                  <span className="truncate">Ordem de Servico</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleBulkLayout}>
                  <IconLayout className="mr-2 h-4 w-4" />
                  <span className="truncate">Medidas do Caminhão</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleCopyFromTask}>
                  <IconClipboardCopy className="mr-2 h-4 w-4" />
                  <span className="truncate">Copiar de Outra Tarefa</span>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}

          {/* Cancel action - ADMIN, LOGISTIC, FINANCIAL, COMMERCIAL */}
          {canCancel && hasNonCancelledTasks && <DropdownMenuSeparator />}

          {canCancel && hasNonCancelledTasks && (
            <DropdownMenuItem onClick={handleCancel} className="text-orange-600 hover:text-white">
              <IconX className="mr-2 h-4 w-4" />
              <span className="truncate">{isBulk ? "Cancelar selecionadas" : "Cancelar"}</span>
            </DropdownMenuItem>
          )}

          {/* Delete action - ADMIN only */}
          {canDelete && <DropdownMenuSeparator />}

          {canDelete && (
            <DropdownMenuItem onClick={handleDelete} className="text-destructive">
              <IconTrash className="mr-2 h-4 w-4" />
              <span className="truncate">{isBulk ? "Excluir selecionadas" : "Excluir"}</span>
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
      <TaskDuplicateModal
        task={task}
        open={duplicateModalOpen}
        onOpenChange={(open) => {
          if (process.env.NODE_ENV !== 'production') {
            console.log('[TaskHistoryContextMenu] TaskDuplicateModal onOpenChange:', open);
          }
          setDuplicateModalOpen(open);
        }}
        onSuccess={() => {
          setDuplicateModalOpen(false);
        }}
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