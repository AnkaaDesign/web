import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { IconPlayerPlay, IconPlayerPause, IconCheck, IconCopy, IconBuildingFactory2, IconEdit, IconEye, IconTrash, IconEditCircle } from "@tabler/icons-react";
import { TASK_STATUS } from "../../../../constants";
import type { Task } from "../../../../types";

interface TaskTableContextMenuProps {
  contextMenu: {
    x: number;
    y: number;
    tasks: Task[];
  } | null;
  onClose: () => void;
  onAction: (action: TaskAction, tasks: Task[]) => void;
}

export type TaskAction = "start" | "finish" | "pause" | "duplicate" | "setSector" | "view" | "edit" | "delete";

export function TaskTableContextMenu({ contextMenu, onClose, onAction }: TaskTableContextMenuProps) {
  if (!contextMenu) return null;

  const { tasks } = contextMenu;
  const isMultiSelection = tasks.length > 1;
  const hasInProgressTasks = tasks.some((t) => t.status === TASK_STATUS.IN_PRODUCTION);
  const hasPendingTasks = tasks.some((t) => t.status === TASK_STATUS.PENDING);
  const hasOnHoldTasks = tasks.some((t) => t.status === TASK_STATUS.ON_HOLD);

  const handleAction = (action: TaskAction) => {
    onAction(action, tasks);
    onClose();
  };

  return (
    <DropdownMenu open={!!contextMenu} onOpenChange={(open) => !open && onClose()}>
      <DropdownMenuContent
        style={{
          position: "fixed",
          left: contextMenu.x,
          top: contextMenu.y,
        }}
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

        {/* Status actions */}
        {(hasPendingTasks || hasOnHoldTasks) && (
          <DropdownMenuItem onClick={() => handleAction("start")}>
            <IconPlayerPlay className="mr-2 h-4 w-4" />
            Iniciar
          </DropdownMenuItem>
        )}

        {(hasInProgressTasks || hasOnHoldTasks || hasPendingTasks) && (
          <DropdownMenuItem onClick={() => handleAction("pause")}>
            <IconPlayerPause className="mr-2 h-4 w-4" />
            {hasPendingTasks && !hasInProgressTasks ? "Colocar em Espera" : "Pausar"}
          </DropdownMenuItem>
        )}

        {hasInProgressTasks && (
          <DropdownMenuItem onClick={() => handleAction("finish")}>
            <IconCheck className="mr-2 h-4 w-4" />
            Finalizar
          </DropdownMenuItem>
        )}

        {/* Separator if we have status actions */}
        {(hasPendingTasks || hasOnHoldTasks || hasInProgressTasks) && <DropdownMenuSeparator />}

        {/* Edit actions */}
        <DropdownMenuItem onClick={() => handleAction("edit")}>
          <IconEdit className="mr-2 h-4 w-4" />
          {isMultiSelection ? "Editar em lote" : "Editar"}
        </DropdownMenuItem>

        {!isMultiSelection && (
          <DropdownMenuItem onClick={() => handleAction("duplicate")}>
            <IconCopy className="mr-2 h-4 w-4" />
            Duplicar
          </DropdownMenuItem>
        )}

        <DropdownMenuItem onClick={() => handleAction("setSector")}>
          <IconBuildingFactory2 className="mr-2 h-4 w-4" />
          {tasks.some((t) => t.sectorId) ? "Alterar Setor" : "Definir Setor"}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Delete action */}
        <DropdownMenuItem onClick={() => handleAction("delete")} className="text-destructive">
          <IconTrash className="mr-2 h-4 w-4" />
          {isMultiSelection ? "Excluir selecionadas" : "Excluir"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
