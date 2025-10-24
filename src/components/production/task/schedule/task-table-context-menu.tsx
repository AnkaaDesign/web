import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
import { IconPlayerPlay, IconPlayerPause, IconCheck, IconCopy, IconBuildingFactory2, IconEdit, IconEye, IconTrash, IconEditCircle, IconFileInvoice } from "@tabler/icons-react";
import { TASK_STATUS, SECTOR_PRIVILEGES } from "../../../../constants";
import type { Task } from "../../../../types";
import { useAuth } from "@/contexts/auth-context";

interface TaskTableContextMenuProps {
  contextMenu: {
    x: number;
    y: number;
    tasks: Task[];
  } | null;
  onClose: () => void;
  onAction: (action: TaskAction, tasks: Task[]) => void;
}

export type TaskAction = "start" | "finish" | "pause" | "duplicate" | "setSector" | "setStatus" | "view" | "edit" | "delete";

export function TaskTableContextMenu({ contextMenu, onClose, onAction }: TaskTableContextMenuProps) {
  const { user } = useAuth();

  if (!contextMenu) return null;

  // WAREHOUSE users should not see any context menu
  if (user?.sector?.privileges === SECTOR_PRIVILEGES.WAREHOUSE) {
    return null;
  }

  const { tasks } = contextMenu;
  const isMultiSelection = tasks.length > 1;
  const hasInProgressTasks = tasks.some((t) => t.status === TASK_STATUS.IN_PRODUCTION);
  const hasPendingTasks = tasks.some((t) => t.status === TASK_STATUS.PENDING);
  const hasOnHoldTasks = tasks.some((t) => t.status === TASK_STATUS.ON_HOLD);
  const hasCompletedTasks = tasks.some((t) => t.status === TASK_STATUS.COMPLETED);

  // FINANCIAL users should only see View and Edit options
  const isFinancialUser = user?.sector?.privileges === SECTOR_PRIVILEGES.FINANCIAL;

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

        {/* View action (single selection only) */}
        {!isMultiSelection && (
          <DropdownMenuItem onClick={() => handleAction("view")}>
            <IconEye className="mr-2 h-4 w-4" />
            Visualizar
          </DropdownMenuItem>
        )}

        {/* Status actions - not available for FINANCIAL users */}
        {!isFinancialUser && (hasPendingTasks || hasOnHoldTasks) && (
          <DropdownMenuItem onClick={() => handleAction("start")} className="text-green-700 hover:text-white">
            <IconPlayerPlay className="mr-2 h-4 w-4" />
            Iniciar
          </DropdownMenuItem>
        )}

        {!isFinancialUser && (hasInProgressTasks || hasOnHoldTasks || hasPendingTasks) && (
          <DropdownMenuItem onClick={() => handleAction("pause")} className="text-blue-600 hover:text-white">
            <IconPlayerPause className="mr-2 h-4 w-4" />
            {hasPendingTasks && !hasInProgressTasks ? "Colocar em Espera" : "Pausar"}
          </DropdownMenuItem>
        )}

        {!isFinancialUser && hasInProgressTasks && (
          <DropdownMenuItem onClick={() => handleAction("finish")} className="text-green-700 hover:text-white">
            <IconCheck className="mr-2 h-4 w-4" />
            Finalizar
          </DropdownMenuItem>
        )}

        {/* Separator if we have status actions - not for FINANCIAL users */}
        {!isFinancialUser && (hasPendingTasks || hasOnHoldTasks || hasInProgressTasks) && <DropdownMenuSeparator />}

        {/* Edit actions */}
        <DropdownMenuItem onClick={() => handleAction("edit")}>
          <IconEdit className="mr-2 h-4 w-4" />
          {isMultiSelection ? "Editar em lote" : "Editar"}
        </DropdownMenuItem>

        {/* Additional actions - not available for FINANCIAL users */}
        {!isFinancialUser && !isMultiSelection && (
          <DropdownMenuItem onClick={() => handleAction("duplicate")}>
            <IconCopy className="mr-2 h-4 w-4" />
            Duplicar
          </DropdownMenuItem>
        )}

        {!isFinancialUser && (
          <DropdownMenuItem onClick={() => handleAction("setSector")}>
            <IconBuildingFactory2 className="mr-2 h-4 w-4" />
            {tasks.some((t) => t.sectorId) ? "Alterar Setor" : "Definir Setor"}
          </DropdownMenuItem>
        )}

        {!isFinancialUser && hasCompletedTasks && (
          <DropdownMenuItem onClick={() => handleAction("setStatus")}>
            <IconFileInvoice className="mr-2 h-4 w-4" />
            Alterar Status
          </DropdownMenuItem>
        )}

        {!isFinancialUser && <DropdownMenuSeparator />}

        {/* Delete action - not available for FINANCIAL users */}
        {!isFinancialUser && (
          <DropdownMenuItem onClick={() => handleAction("delete")} className="text-destructive">
            <IconTrash className="mr-2 h-4 w-4" />
            {isMultiSelection ? "Excluir selecionadas" : "Excluir"}
          </DropdownMenuItem>
        )}
      </PositionedDropdownMenuContent>
    </DropdownMenu>
  );
}
