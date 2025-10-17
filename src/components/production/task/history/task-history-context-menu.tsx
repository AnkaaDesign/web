import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { IconEye, IconEdit, IconFileInvoice, IconTrash, IconBuildingFactory2 } from "@tabler/icons-react";
import { useTaskMutations, useTaskBatchMutations } from "../../../../hooks";
import { routes, TASK_STATUS } from "../../../../constants";
import type { Task } from "../../../../types";
import { SetStatusModal } from "../schedule/set-status-modal";
import { SetSectorModal } from "../schedule/set-sector-modal";

interface TaskHistoryContextMenuProps {
  tasks: Task[];
  position: { x: number; y: number };
  onClose: () => void;
  selectedIds: string[];
}

export function TaskHistoryContextMenu({
  tasks,
  position,
  onClose,
  selectedIds
}: TaskHistoryContextMenuProps) {
  const navigate = useNavigate();
  const { update, remove } = useTaskMutations();
  const { batchUpdate, batchDelete } = useTaskBatchMutations();
  const [setStatusModalOpen, setSetStatusModalOpen] = useState(false);
  const [setSectorModalOpen, setSetSectorModalOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(true);
  const openingModalRef = React.useRef(false);

  const isBulk = selectedIds.length > 1;
  const taskIds = tasks.map(t => t.id);
  const task = tasks[0];

  // When a modal opens, close the dropdown
  React.useEffect(() => {
    if (setStatusModalOpen || setSectorModalOpen) {
      console.log('[TaskHistoryContextMenu] Modal opened, closing dropdown');
      openingModalRef.current = false;
      setDropdownOpen(false);
    }
  }, [setStatusModalOpen, setSectorModalOpen]);

  // Close the entire component when dropdown closes and no modals are open
  React.useEffect(() => {
    console.log('[TaskHistoryContextMenu] Effect running:', {
      dropdownOpen,
      setStatusModalOpen,
      setSectorModalOpen,
      openingModal: openingModalRef.current,
      shouldClose: !dropdownOpen && !setStatusModalOpen && !setSectorModalOpen && !openingModalRef.current
    });

    // Don't close if we're in the process of opening a modal
    if (!dropdownOpen && !setStatusModalOpen && !setSectorModalOpen && !openingModalRef.current) {
      console.log('[TaskHistoryContextMenu] Calling onClose()');
      onClose();
    }
  }, [dropdownOpen, setStatusModalOpen, setSectorModalOpen, onClose]);

  const handleView = () => {
    if (task && !isBulk) {
      navigate(routes.production.schedule.details(task.id));
    }
    setDropdownOpen(false);
  };

  const handleEdit = () => {
    if (taskIds.length === 1) {
      navigate(routes.production.schedule.edit(taskIds[0]));
    } else if (taskIds.length > 1) {
      // Navigate to batch edit page if available
      const ids = taskIds.join(",");
      navigate(`${routes.production.schedule.root}/editar-em-lote?ids=${ids}`);
    }
    setDropdownOpen(false);
  };

  const handleSetSector = () => {
    console.log('[TaskHistoryContextMenu] handleSetSector called');
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
      console.error("Error updating task sector:", error);
    }
  };

  const handleSetStatus = () => {
    console.log('[TaskHistoryContextMenu] handleSetStatus called');
    openingModalRef.current = true;
    setSetStatusModalOpen(true);
  };

  const handleSetStatusConfirm = async (status: typeof TASK_STATUS.IN_PRODUCTION | typeof TASK_STATUS.COMPLETED | typeof TASK_STATUS.INVOICED | typeof TASK_STATUS.SETTLED) => {
    console.log('[TaskHistoryContextMenu] handleSetStatusConfirm called with status:', status);
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
          }

          return { id, data: updateData };
        });
        await batchUpdate({ items: updates });
      }
    } catch (error) {
      console.error("Error updating task status:", error);
    }
  };

  const handleDelete = async () => {
    const count = taskIds.length;
    const confirmed = window.confirm(
      `Tem certeza que deseja deletar ${count} tarefa${count > 1 ? "s" : ""}?`
    );

    if (!confirmed) {
      setDropdownOpen(false);
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
    setDropdownOpen(false);
  };

  if (!position || taskIds.length === 0) return null;

  console.log('[TaskHistoryContextMenu] Rendering with states:', {
    dropdownOpen,
    setStatusModalOpen,
    setSectorModalOpen,
    taskIds: taskIds.length
  });

  return (
    <>
      <DropdownMenu open={dropdownOpen} onOpenChange={(open) => !open && setDropdownOpen(false)}>
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

          <DropdownMenuSeparator />

          {/* Set Sector action */}
          <DropdownMenuItem
            onClick={handleSetSector}
            onSelect={(e) => e.preventDefault()}
          >
            <IconBuildingFactory2 className="mr-2 h-4 w-4" />
            {tasks.some((t) => t.sectorId) ? "Alterar Setor" : "Definir Setor"}
          </DropdownMenuItem>

          {/* Set Status action - includes option to put back in production */}
          <DropdownMenuItem
            onClick={handleSetStatus}
            onSelect={(e) => e.preventDefault()}
          >
            <IconFileInvoice className="mr-2 h-4 w-4" />
            Definir Status
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Delete action */}
          <DropdownMenuItem onClick={handleDelete} className="text-destructive">
            <IconTrash className="mr-2 h-4 w-4" />
            {isBulk ? "Deletar selecionadas" : "Deletar"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Set Sector Modal */}
      <SetSectorModal
        open={setSectorModalOpen}
        onOpenChange={(open) => {
          console.log('[TaskHistoryContextMenu] SetSectorModal onOpenChange:', open);
          setSetSectorModalOpen(open);
        }}
        tasks={tasks}
        onConfirm={handleSetSectorConfirm}
      />

      {/* Set Status Modal */}
      <SetStatusModal
        open={setStatusModalOpen}
        onOpenChange={(open) => {
          console.log('[TaskHistoryContextMenu] SetStatusModal onOpenChange:', open);
          setSetStatusModalOpen(open);
        }}
        tasks={tasks}
        onConfirm={handleSetStatusConfirm}
        allowedStatuses={[TASK_STATUS.IN_PRODUCTION, TASK_STATUS.COMPLETED, TASK_STATUS.INVOICED, TASK_STATUS.SETTLED]}
      />
    </>
  );
}