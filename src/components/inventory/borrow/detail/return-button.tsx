import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import { IconPackageExport, IconLoader2 } from "@tabler/icons-react";
import { BORROW_STATUS } from "../../../../constants";
import { useBorrowMutations } from "../../../../hooks";
import { usePrivileges } from "../../../../hooks";
import type { Borrow } from "../../../../types";
import { formatDateTime } from "../../../../utils";

interface ReturnButtonProps {
  borrow: Borrow;
  className?: string;
}

export function ReturnButton({ borrow, className }: ReturnButtonProps) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const { updateMutation } = useBorrowMutations();
  const { canManageWarehouse } = usePrivileges();

  // Only show for active borrows and users with warehouse permissions
  if (borrow.status !== BORROW_STATUS.ACTIVE || !canManageWarehouse) {
    return null;
  }

  const handleReturn = async () => {
    try {
      await updateMutation.mutateAsync({
        id: borrow.id,
        data: {
          status: BORROW_STATUS.RETURNED,
          returnedAt: new Date(),
        },
      });

      setShowConfirmDialog(false);
    } catch (error) {
      // Error handled by API client
    }
  };

  return (
    <>
      <Button onClick={() => setShowConfirmDialog(true)} className={className} variant="default" disabled={updateMutation.isPending}>
        {updateMutation.isPending ? (
          <>
            <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
            Processando...
          </>
        ) : (
          <>
            <IconPackageExport className="mr-2 h-4 w-4" />
            Devolver Item
          </>
        )}
      </Button>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Devolução</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>Você está prestes a registrar a devolução deste empréstimo:</p>

              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <p className="text-sm">
                  <span className="font-medium">Item:</span> {borrow.item?.name}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Quantidade:</span> {borrow.quantity}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Emprestado por:</span> {borrow.user?.name}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Data do empréstimo:</span> {formatDateTime(borrow.createdAt)}
                </p>
              </div>

              <p className="text-sm text-muted-foreground">Esta ação irá marcar o empréstimo como devolvido e atualizar o estoque do item.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReturn} disabled={updateMutation.isPending} className="bg-primary hover:bg-primary/90">
              {updateMutation.isPending ? (
                <>
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                "Confirmar Devolução"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
