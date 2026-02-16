import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
import { IconPlayerPlay, IconCheck, IconCopy, IconBuildingFactory2, IconEdit, IconTrash, IconFileInvoice, IconSettings2, IconPhoto, IconFileText, IconPalette, IconCut, IconClipboardCopy, IconLayout } from "@tabler/icons-react";
import { TASK_STATUS, SECTOR_PRIVILEGES } from "../../../../constants";
import type { Task } from "../../../../types";
import { useAuth } from "@/contexts/auth-context";
import { canEditTasks, canDeleteTasks, canLeaderManageTask } from "@/utils/permissions/entity-permissions";
import { isTeamLeader } from "@/utils/user";

interface TaskTableContextMenuProps {
  contextMenu: {
    x: number;
    y: number;
    tasks: Task[];
  } | null;
  onClose: () => void;
  onAction: (action: TaskAction, tasks: Task[]) => void;
}

export type TaskAction = "start" | "finish" | "duplicate" | "setSector" | "setStatus" | "view" | "edit" | "delete" | "bulkArts" | "bulkBaseFiles" | "bulkPaints" | "bulkCuttingPlans" | "copyFromTask" | "bulkServiceOrder" | "bulkLayout" | "bulkDocuments";

export function TaskTableContextMenu({ contextMenu, onClose, onAction }: TaskTableContextMenuProps) {
  const { user } = useAuth();

  if (!contextMenu) return null;

  const { tasks } = contextMenu;
  const isMultiSelection = tasks.length > 1;
  const hasInProgressTasks = tasks.some((t) => t.status === TASK_STATUS.IN_PRODUCTION);
  const hasWaitingProductionTasks = tasks.some((t) => t.status === TASK_STATUS.WAITING_PRODUCTION);
  const hasPreparationTasks = tasks.some((t) => t.status === TASK_STATUS.PREPARATION);

  // Permission checks
  const isAdmin = user?.sector?.privileges === SECTOR_PRIVILEGES.ADMIN;
  const isCommercial = user?.sector?.privileges === SECTOR_PRIVILEGES.COMMERCIAL;
  const isTeamLeaderUser = user ? isTeamLeader(user) : false;
  const canEdit = canEditTasks(user); // ADMIN, DESIGNER, FINANCIAL, LOGISTIC
  const canDelete = canDeleteTasks(user); // ADMIN only

  // Team leaders can only manage tasks in their managed sector or tasks without sector
  // Team leadership is now determined by managedSector relationship
  const canLeaderManageTheseTasks = isTeamLeaderUser && tasks.every((t) => canLeaderManageTask(user, t.sectorId));
  const canManageStatus = isAdmin || canLeaderManageTheseTasks;

  // No context menu if user has no permissions at all
  if (!canEdit && !canManageStatus) {
    return null;
  }

  const handleAction = (action: TaskAction) => {
    onAction(action, tasks);
    onClose();
  };

  return (
    <DropdownMenu open={!!contextMenu} onOpenChange={(open) => !open && onClose()}>
      <PositionedDropdownMenuContent
        position={contextMenu}
        isOpen={!!contextMenu}
        className="w-56"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {isMultiSelection && <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">{tasks.length} tarefas selecionadas</div>}

        {/* Status actions - Team leaders (sector match) and ADMIN only */}
        {canManageStatus && (hasWaitingProductionTasks || hasPreparationTasks) && (
          <DropdownMenuItem onClick={() => handleAction("start")} className="text-green-700 hover:text-white">
            <IconPlayerPlay className="mr-2 h-4 w-4" />
            Iniciar
          </DropdownMenuItem>
        )}

        {canManageStatus && hasInProgressTasks && (
          <DropdownMenuItem onClick={() => handleAction("finish")} className="text-green-700 hover:text-white">
            <IconCheck className="mr-2 h-4 w-4" />
            Finalizar
          </DropdownMenuItem>
        )}

        {/* Separator if we have status actions */}
        {canManageStatus && (hasWaitingProductionTasks || hasPreparationTasks || hasInProgressTasks) && <DropdownMenuSeparator />}

        {/* Edit action - ADMIN, DESIGNER, FINANCIAL, LOGISTIC */}
        {canEdit && (
          <DropdownMenuItem onClick={() => handleAction("edit")}>
            <IconEdit className="mr-2 h-4 w-4" />
            {isMultiSelection ? "Editar em lote" : "Editar"}
          </DropdownMenuItem>
        )}

        {/* Duplicate - ADMIN and COMMERCIAL */}
        {(isAdmin || isCommercial) && !isMultiSelection && (
          <DropdownMenuItem onClick={() => handleAction("duplicate")}>
            <IconCopy className="mr-2 h-4 w-4" />
            Criar Cópias
          </DropdownMenuItem>
        )}

        {isAdmin && (
          <DropdownMenuItem onClick={() => handleAction("setSector")}>
            <IconBuildingFactory2 className="mr-2 h-4 w-4" />
            {tasks.some((t) => t.sectorId) ? "Alterar Setor" : "Definir Setor"}
          </DropdownMenuItem>
        )}

        {isAdmin && (
          <DropdownMenuItem onClick={() => handleAction("setStatus")}>
            <IconFileInvoice className="mr-2 h-4 w-4" />
            Alterar Status
          </DropdownMenuItem>
        )}

        {/* Advanced bulk operations - ADMIN only */}
        {isAdmin && <DropdownMenuSeparator />}

        {isAdmin && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="data-[state=open]:bg-accent data-[state=open]:text-accent-foreground">
              <IconSettings2 className="mr-2 h-4 w-4" />
              <span className="data-[state=open]:text-accent-foreground">Avançados</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => handleAction("bulkArts")}>
                <IconPhoto className="mr-2 h-4 w-4" />
                Adicionar Artes
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAction("bulkBaseFiles")}>
                <IconFileText className="mr-2 h-4 w-4" />
                Arquivos Base
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAction("bulkPaints")}>
                <IconPalette className="mr-2 h-4 w-4" />
                Adicionar Tintas
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAction("bulkCuttingPlans")}>
                <IconCut className="mr-2 h-4 w-4" />
                Adicionar Plano de Corte
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAction("bulkServiceOrder")}>
                <IconFileInvoice className="mr-2 h-4 w-4" />
                Ordem de Serviço
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAction("bulkLayout")}>
                <IconLayout className="mr-2 h-4 w-4" />
                Layout
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleAction("copyFromTask")}>
                <IconClipboardCopy className="mr-2 h-4 w-4" />
                Copiar de Outra Tarefa
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {/* Delete action - ADMIN only */}
        {canDelete && <DropdownMenuSeparator />}

        {canDelete && (
          <DropdownMenuItem onClick={() => handleAction("delete")} className="text-destructive">
            <IconTrash className="mr-2 h-4 w-4" />
            {isMultiSelection ? "Excluir selecionadas" : "Excluir"}
          </DropdownMenuItem>
        )}
      </PositionedDropdownMenuContent>
    </DropdownMenu>
  );
}
