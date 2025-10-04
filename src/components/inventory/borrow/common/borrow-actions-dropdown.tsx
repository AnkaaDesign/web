import { IconDots, IconEye, IconPackage, IconTrash } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { canAccessSector } from "../../../../utils";
import { SECTOR_PRIVILEGES, BORROW_STATUS, routes } from "../../../../constants";
import { useBorrowMutations } from "../../../../hooks";
import type { Borrow } from "../../../../types";

interface BorrowActionsDropdownProps {
  borrow: Borrow;
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
}

export function BorrowActionsDropdown({ borrow, onEdit, onDelete, className }: BorrowActionsDropdownProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { deleteMutation } = useBorrowMutations();

  // Check permissions
  const userPrivilege = (user?.sector?.privileges as SECTOR_PRIVILEGES) || SECTOR_PRIVILEGES.BASIC;
  const canEdit = canAccessSector(userPrivilege, SECTOR_PRIVILEGES.WAREHOUSE);
  const canDelete = canAccessSector(userPrivilege, SECTOR_PRIVILEGES.ADMIN);

  // Check if borrow can be returned (only if active)
  const isReturnable = borrow.status === BORROW_STATUS.ACTIVE;

  const handleView = () => {
    navigate(routes.inventory.loans.details(borrow.id));
  };

  const handleEdit = () => {
    if (onEdit) {
      onEdit();
    } else {
      // Since single edit page is removed, this should trigger batch edit
      // The parent component should handle this by opening the batch edit modal
      console.warn("Single edit clicked but no onEdit callback provided. Consider implementing batch edit.");
    }
  };

  const handleDelete = async () => {
    if (onDelete) {
      onDelete();
    } else {
      try {
        await deleteMutation.mutateAsync(borrow.id);
        toast.success("Empréstimo excluído com sucesso");
      } catch (error) {
        // Error is handled by the API client with detailed message
        console.error("Error deleting borrow:", error);
      }
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={cn("h-8 w-8", className)}>
          <IconDots className="h-4 w-4" />
          <span className="sr-only">Abrir menu de ações</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[200px]">
        <DropdownMenuLabel>Ações</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleView}>
          <IconEye className="mr-2 h-4 w-4" />
          Visualizar
        </DropdownMenuItem>

        {canEdit && (
          <DropdownMenuItem onClick={handleEdit}>
            {isReturnable ? (
              <>
                <IconPackage className="mr-2 h-4 w-4" />
                Devolver
              </>
            ) : (
              <>
                <IconEye className="mr-2 h-4 w-4" />
                Visualizar Devolução
              </>
            )}
          </DropdownMenuItem>
        )}

        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
              <IconTrash className="mr-2 h-4 w-4" />
              Excluir
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
