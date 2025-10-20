import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { IconPlayerPlay, IconCheck, IconScissors, IconEye, IconTrash } from "@tabler/icons-react";
import { CUT_STATUS, SECTOR_PRIVILEGES } from "../../../../constants";
import type { Cut } from "../../../../types";
import { useAuth } from "../../../../hooks";
import { hasPrivilege } from "../../../../utils";

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

  const { data: currentUser } = useAuth();
  const { items } = contextMenu;
  const isMultiSelection = items.length > 1;

  // Check if user can request new cuts (Leader or Admin only)
  const canRequestNewCut = currentUser && (
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.LEADER) ||
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.ADMIN)
  );

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
      <DropdownMenuContent
        style={{
          position: "fixed",
          left: contextMenu.x,
          top: contextMenu.y,
        }}
        className="w-56"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {isMultiSelection && <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">{items.length} cortes selecionados</div>}

        {/* View action (single selection only) */}
        {!isMultiSelection && (
          <DropdownMenuItem onClick={() => handleAction("view")}>
            <IconEye className="mr-2 h-4 w-4" />
            Visualizar
          </DropdownMenuItem>
        )}

        {/* Status actions */}
        {hasPendingCuts && (
          <DropdownMenuItem onClick={() => handleAction("start")} className="text-blue-600 hover:text-white">
            <IconPlayerPlay className="mr-2 h-4 w-4" />
            Iniciar corte
          </DropdownMenuItem>
        )}

        {hasCuttingCuts && (
          <DropdownMenuItem onClick={() => handleAction("finish")} className="text-green-700 hover:text-white">
            <IconCheck className="mr-2 h-4 w-4" />
            Finalizar corte
          </DropdownMenuItem>
        )}

        {/* Request new cut (single selection only, Leader and Admin only) */}
        {!isMultiSelection && !hasCompletedCuts && canRequestNewCut && (
          <DropdownMenuItem onClick={() => handleAction("request")}>
            <IconScissors className="mr-2 h-4 w-4" />
            Solicitar novo corte
          </DropdownMenuItem>
        )}

        {/* Separator if we have status actions */}
        {(hasPendingCuts || hasCuttingCuts || (!isMultiSelection && !hasCompletedCuts && canRequestNewCut)) && <DropdownMenuSeparator />}

        {/* Delete action */}
        <DropdownMenuItem onClick={() => handleAction("delete")} className="text-destructive">
          <IconTrash className="mr-2 h-4 w-4" />
          {isMultiSelection ? "Excluir selecionados" : "Excluir"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
