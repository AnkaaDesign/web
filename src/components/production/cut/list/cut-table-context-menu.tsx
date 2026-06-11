import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
import { IconPlayerPlay, IconCheck, IconScissors, IconExternalLink, IconTrash } from "@tabler/icons-react";
import { CUT_STATUS } from "../../../../constants";
import type { Cut } from "../../../../types";
import { useAuth } from "../../../../hooks";
import { canDeleteCuts, canManageCutStatus, canRequestCut } from "@/utils/permissions/entity-permissions";

interface CutTableContextMenuProps {
  contextMenu: {
    x: number;
    y: number;
    items: Cut[];
    isBulk: boolean;
  } | null;
  onClose: () => void;
  onAction: (action: CutAction, items: Cut[]) => void;
}

export type CutAction = "start" | "finish" | "request" | "view" | "delete";

export function CutTableContextMenu({ contextMenu, onClose, onAction }: CutTableContextMenuProps) {
  if (!contextMenu) return null;

  const { user: currentUser } = useAuth();
  const { items } = contextMenu;
  const isMultiSelection = items.length > 1;

  // Permission checks aligned to the API roles (cut.controller.ts)
  const canRequestNewCut = canRequestCut(currentUser); // POST /cuts: DESIGNER, ADMIN
  const canChangeStatus = canManageCutStatus(currentUser); // PUT /cuts/:id: DESIGNER, PLOTTING, ADMIN
  const canDelete = canDeleteCuts(currentUser); // DELETE /cuts/:id: DESIGNER, ADMIN

  // Status checks
  const hasPendingCuts = items.some((c) => c.status === CUT_STATUS.PENDING);
  const hasCuttingCuts = items.some((c) => c.status === CUT_STATUS.CUTTING);
  const hasCompletedCuts = items.some((c) => c.status === CUT_STATUS.COMPLETED);

  const handleAction = (action: CutAction) => {
    onAction(action, items);
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
        {isMultiSelection && <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">{items.length} cortes selecionados</div>}

        {/* View action (single selection only) */}
        {!isMultiSelection && (
          <DropdownMenuItem onClick={() => handleAction("view")}>
            <IconExternalLink className="mr-2 h-4 w-4" />
            Abrir em nova guia
          </DropdownMenuItem>
        )}

        {/* Status actions */}
        {canChangeStatus && hasPendingCuts && (
          <DropdownMenuItem onClick={() => handleAction("start")} className="text-blue-600 hover:text-white">
            <IconPlayerPlay className="mr-2 h-4 w-4" />
            Iniciar corte
          </DropdownMenuItem>
        )}

        {canChangeStatus && hasCuttingCuts && (
          <DropdownMenuItem onClick={() => handleAction("finish")} className="text-green-700 hover:text-white">
            <IconCheck className="mr-2 h-4 w-4" />
            Finalizar corte
          </DropdownMenuItem>
        )}

        {/* Request new cut (single selection only, DESIGNER and ADMIN only) */}
        {!isMultiSelection && !hasCompletedCuts && canRequestNewCut && (
          <DropdownMenuItem onClick={() => handleAction("request")}>
            <IconScissors className="mr-2 h-4 w-4" />
            Solicitar novo corte
          </DropdownMenuItem>
        )}

        {/* Separator if we have status actions and a delete action below */}
        {canDelete && ((canChangeStatus && (hasPendingCuts || hasCuttingCuts)) || (!isMultiSelection && !hasCompletedCuts && canRequestNewCut)) && <DropdownMenuSeparator />}

        {/* Delete action (DESIGNER and ADMIN only) */}
        {canDelete && (
          <DropdownMenuItem onClick={() => handleAction("delete")} className="text-destructive">
            <IconTrash className="mr-2 h-4 w-4" />
            {isMultiSelection ? "Excluir selecionados" : "Excluir"}
          </DropdownMenuItem>
        )}
      </PositionedDropdownMenuContent>
    </DropdownMenu>
  );
}
