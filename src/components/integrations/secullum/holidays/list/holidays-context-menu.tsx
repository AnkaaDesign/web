import { useState } from "react";
import { IconEdit, IconTrash } from "@tabler/icons-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
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
import { useSecullumDeleteHoliday } from "../../../../../hooks";
import { toast } from "sonner";

import type { SecullumHolidayData } from "../../../../../schemas";

// Use the proper type from schemas
type SecullumHoliday = SecullumHolidayData;

interface HolidaysContextMenuProps {
  contextMenu: {
    x: number;
    y: number;
    holiday: SecullumHoliday;
  } | null;
  onClose: () => void;
  onEdit?: (holiday: SecullumHoliday) => void;
}

export function HolidaysContextMenu({ contextMenu, onClose, onEdit }: HolidaysContextMenuProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [holidayToDelete, setHolidayToDelete] = useState<SecullumHoliday | null>(null);
  const { mutate: deleteHoliday, isPending } = useSecullumDeleteHoliday();

  const handleEdit = () => {
    if (contextMenu && onEdit) {
      onEdit(contextMenu.holiday);
    }
    onClose();
  };

  const handleDelete = () => {
    if (contextMenu) {
      setHolidayToDelete(contextMenu.holiday);
      setShowDeleteDialog(true);
      onClose(); // Close context menu immediately when delete dialog opens
    }
  };

  const confirmDelete = async () => {
    if (!holidayToDelete) return;

    try {
      deleteHoliday(holidayToDelete.Id, {
        onSuccess: () => {
          toast.success("Feriado excluído com sucesso");
          setShowDeleteDialog(false);
          setHolidayToDelete(null);
        },
      });
    } catch (error) {
      console.error("Error deleting holiday:", error);
      setShowDeleteDialog(false);
      setHolidayToDelete(null);
    }
  };

  return (
    <>
      {contextMenu && (
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
            <DropdownMenuItem onClick={handleEdit}>
              <IconEdit className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive" disabled={isPending}>
              <IconTrash className="mr-2 h-4 w-4" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Feriado</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza de que deseja excluir o feriado "{holidayToDelete?.Descricao}"? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
