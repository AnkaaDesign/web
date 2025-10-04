import React from "react";
import { useNavigate } from "react-router-dom";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { IconEye, IconEdit, IconPlayerPlay, IconTrash } from "@tabler/icons-react";
import { useTaskMutations, useTaskBatchMutations } from "../../../../hooks";
import { routes, TASK_STATUS } from "../../../../constants";
import type { Task } from "../../../../types";

interface TaskHistoryContextMenuProps {
  task?: Task;
  position: { x: number; y: number };
  onClose: () => void;
  selectedIds: string[];
}

export function TaskHistoryContextMenu({
  task,
  position,
  onClose,
  selectedIds
}: TaskHistoryContextMenuProps) {
  const navigate = useNavigate();
  const { update, remove } = useTaskMutations();
  const { batchUpdate, batchDelete } = useTaskBatchMutations();

  const isBulk = selectedIds.length > 1;
  const taskIds = isBulk ? selectedIds : task ? [task.id] : [];

  const handleView = () => {
    if (task && !isBulk) {
      navigate(routes.production.schedule.details(task.id));
    }
    onClose();
  };

  const handleEdit = () => {
    if (taskIds.length === 1) {
      navigate(routes.production.tasks.edit(taskIds[0]));
    } else if (taskIds.length > 1) {
      // Navigate to batch edit page if available
      const ids = taskIds.join(",");
      navigate(`${routes.production.tasks.root}/batch-edit?ids=${ids}`);
    }
    onClose();
  };

  const handleReactivate = async () => {
    try {
      if (taskIds.length === 1) {
        await update({
          id: taskIds[0],
          data: { status: TASK_STATUS.IN_PRODUCTION }
        });
      } else {
        const updates = taskIds.map(id => ({
          id,
          data: { status: TASK_STATUS.IN_PRODUCTION }
        }));
        await batchUpdate({ items: updates });
      }
    } catch (error) {
      console.error("Error reactivating task(s):", error);
    }
    onClose();
  };

  const handleDelete = async () => {
    const count = taskIds.length;
    const confirmed = window.confirm(
      `Tem certeza que deseja deletar ${count} tarefa${count > 1 ? "s" : ""}?`
    );

    if (!confirmed) {
      onClose();
      return;
    }

    try {
      if (taskIds.length === 1) {
        await remove(taskIds[0]);
      } else {
        await batchDelete({ taskIds });
      }
    } catch (error) {
      console.error("Error deleting task(s):", error);
    }
    onClose();
  };

  if (!position || taskIds.length === 0) return null;

  return (
    <DropdownMenu open={true} onOpenChange={(open) => !open && onClose()}>
      <DropdownMenuContent
        style={{
          position: "fixed",
          left: position.x,
          top: position.y,
        }}
        className="w-56"
        onCloseAutoFocus={(e) => e.preventDefault()}
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

        {/* Reactivate action - for completed tasks */}
        <DropdownMenuItem onClick={handleReactivate}>
          <IconPlayerPlay className="mr-2 h-4 w-4" />
          {isBulk ? "Reativar selecionadas" : "Reativar"}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Delete action */}
        <DropdownMenuItem onClick={handleDelete} className="text-destructive">
          <IconTrash className="mr-2 h-4 w-4" />
          {isBulk ? "Deletar selecionadas" : "Deletar"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}