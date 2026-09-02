import React from "react";
import { useNavigate } from "react-router-dom";
import { IconEdit, IconTrash, IconCheck, IconX, IconGitMerge, IconEye, IconPrinter } from "@tabler/icons-react";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
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
import { usePrinter } from "@/components/common/printer";
import type { Paint } from "../../../../types";
import { routes, SECTOR_PRIVILEGES } from "../../../../constants";
import { usePaintMutations } from "../../../../hooks";
import { useAuth } from "../../../../contexts/auth-context";
import { canEditPaints, canDeletePaints } from "../../../../utils/permissions/entity-permissions";
import { usePaintSelection } from "./paint-selection-context";

export interface PaintContextMenuPosition {
  x: number;
  y: number;
}

/**
 * Owns the position state of a right-click menu plus the outside-click
 * dismissal, so every paint representation (the full card in the maximized
 * view, the 64px swatch in the minimized one) opens the same menu the same way.
 */
export function usePaintContextMenu() {
  const [position, setPosition] = React.useState<PaintContextMenuPosition | null>(null);

  const openAt = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPosition({ x: e.clientX, y: e.clientY });
  }, []);

  const close = React.useCallback(() => setPosition(null), []);

  React.useEffect(() => {
    const handleClick = () => setPosition(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return { position, openAt, close };
}

/** Whether this user may open a paint's detail page — mirrors the route guard. */
export function useCanViewPaintDetails(): boolean {
  const { user } = useAuth();
  const isTeamLeader = Boolean(user?.ledSector?.id);
  const userPrivilege = user?.sector?.privileges;
  return (
    userPrivilege === SECTOR_PRIVILEGES.ADMIN ||
    userPrivilege === SECTOR_PRIVILEGES.LOGISTIC ||
    userPrivilege === SECTOR_PRIVILEGES.COMMERCIAL ||
    userPrivilege === SECTOR_PRIVILEGES.FINANCIAL ||
    userPrivilege === SECTOR_PRIVILEGES.WAREHOUSE ||
    userPrivilege === SECTOR_PRIVILEGES.DESIGNER ||
    (userPrivilege === SECTOR_PRIVILEGES.PRODUCTION && isTeamLeader)
  );
}

interface PaintContextMenuProps {
  paint: Paint;
  position: PaintContextMenuPosition | null;
  onClose: () => void;
  onMerge?: () => void;
}

/** The right-click menu for a single paint, together with its delete confirmation. */
export function PaintContextMenu({ paint, position, onClose, onMerge }: PaintContextMenuProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { delete: deletePaint } = usePaintMutations();
  const { isSelected, toggleSelection, selectedCount } = usePaintSelection();
  const { openPrintDialog } = usePrinter();
  const canViewPaintDetails = useCanViewPaintDetails();

  const selected = isSelected(paint.id);
  const canEdit = canEditPaints(user);
  const canDelete = canDeletePaints(user);

  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigate(routes.painting.catalog.edit(paint.id));
    onClose();
  };

  const handleDeleteClick = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onClose();
    setShowDeleteDialog(true);
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await deletePaint(paint.id);
    } catch (error) {
      // Error is handled by the API client
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleSelect = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    toggleSelection(paint.id);
    onClose();
  };

  const handleViewDetails = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (canViewPaintDetails) {
      navigate(routes.painting.catalog.details(paint.id));
    }
    onClose();
  };

  const handleMerge = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onMerge?.();
    onClose();
  };

  const handlePrintLabel = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    openPrintDialog(paint);
    onClose();
  };

  return (
    <>
      <DropdownMenu open={!!position} onOpenChange={(open) => !open && onClose()}>
        <PositionedDropdownMenuContent position={position} isOpen={!!position} className="w-56 ![position:fixed]" onClick={(e) => e.stopPropagation()}>
          {selectedCount >= 2 && selected && onMerge && (
            <DropdownMenuItem onClick={handleMerge}>
              <IconGitMerge className="mr-2 h-4 w-4" />
              Mesclar Tintas
            </DropdownMenuItem>
          )}

          <DropdownMenuItem onClick={handleSelect}>
            {selected ? <IconX className="mr-2 h-4 w-4" /> : <IconCheck className="mr-2 h-4 w-4" />}
            {selected ? "Desselecionar" : "Selecionar"}
          </DropdownMenuItem>

          {canViewPaintDetails && (
            <DropdownMenuItem onClick={handleViewDetails}>
              <IconEye className="mr-2 h-4 w-4" />
              Detalhes
            </DropdownMenuItem>
          )}

          {canEdit && (
            <DropdownMenuItem onClick={handleEdit}>
              <IconEdit className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
          )}

          <DropdownMenuItem onClick={handlePrintLabel}>
            <IconPrinter className="mr-2 h-4 w-4" />
            Imprimir Etiqueta
          </DropdownMenuItem>

          {canDelete && (
            <>
              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={handleDeleteClick} className="text-destructive">
                <IconTrash className="mr-2 h-4 w-4" />
                Excluir
              </DropdownMenuItem>
            </>
          )}
        </PositionedDropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Tinta</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir a tinta "{paint.name}"? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
