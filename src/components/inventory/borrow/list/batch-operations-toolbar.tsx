import { Button } from "@/components/ui/button";
import { IconEdit, IconTrash, IconArrowBack, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { BORROW_STATUS } from "../../../../constants";
import type { Borrow } from "../../../../types";

interface BatchOperationsToolbarProps {
  selectedCount: number;
  selectedItems: Borrow[];
  onBatchEdit: () => void;
  onBatchReturn: () => void;
  onBatchDelete: () => void;
  onClearSelection: () => void;
  isLoading?: boolean;
  className?: string;
}

export function BatchOperationsToolbar({
  selectedCount,
  selectedItems,
  onBatchEdit,
  onBatchReturn,
  onBatchDelete,
  onClearSelection,
  isLoading = false,
  className,
}: BatchOperationsToolbarProps) {
  // Check if all selected items are active (can be returned)
  const canReturn = selectedItems.length > 0 && selectedItems.every((item) => item.status === BORROW_STATUS.ACTIVE);

  // Check if any items can be edited
  const canEdit = selectedItems.length > 0;

  // Check if items can be deleted
  const canDelete = selectedItems.length > 0;

  return (
    <div
      className={cn(
        "flex items-center justify-between bg-muted/50 dark:bg-muted/20 border border-border rounded-lg px-4 py-3 gap-4",
        "animate-in slide-in-from-top-2 duration-200",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onClearSelection} disabled={isLoading} className="h-8 px-2">
          <IconX className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">
          {selectedCount} {selectedCount === 1 ? "item" : "itens"} selecionado{selectedCount === 1 ? "" : "s"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onBatchEdit} disabled={!canEdit || isLoading} className="h-8">
          <IconEdit className="h-4 w-4 mr-2" />
          Editar
        </Button>

        <Button variant="outline" size="sm" onClick={onBatchReturn} disabled={!canReturn || isLoading} className="h-8 text-green-700 hover:text-white hover:bg-green-700 border-green-700">
          <IconArrowBack className="h-4 w-4 mr-2" />
          Devolver
        </Button>

        <div className="w-px h-5 bg-border" />

        <Button
          variant="outline"
          size="sm"
          onClick={onBatchDelete}
          disabled={!canDelete || isLoading}
          className="h-8 text-destructive hover:bg-destructive hover:text-destructive-foreground"
        >
          <IconTrash className="h-4 w-4 mr-2" />
          Deletar
        </Button>
      </div>
    </div>
  );
}
