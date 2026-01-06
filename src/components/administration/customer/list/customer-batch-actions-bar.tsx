import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Customer } from "../../../../types";
import { routes } from "../../../../constants";
import { useCustomerBatchMutations } from "../../../../hooks";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconEdit, IconTrash, IconX, IconLoader2, IconUsers, IconCheck } from "@tabler/icons-react";
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

interface CustomerBatchActionsBarProps {
  selectedCustomers: Customer[];
  onSelectionClear: () => void;
  onSuccess?: () => void;
}

export function CustomerBatchActionsBar({ selectedCustomers, onSelectionClear, onSuccess }: CustomerBatchActionsBarProps) {
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { batchDeleteAsync } = useCustomerBatchMutations();

  const selectedCount = selectedCustomers.length;

  if (selectedCount === 0) {
    return null;
  }

  const handleBatchEdit = () => {
    if (selectedCount === 1) {
      // Single customer - navigate to edit page
      navigate(routes.administration.customers.edit(selectedCustomers[0].id));
    } else {
      // Multiple customers - navigate to batch edit page
      const ids = selectedCustomers.map((customer) => customer.id).join(",");
      navigate(`${routes.administration.customers.batchEdit}?ids=${ids}`);
    }
  };

  const handleBatchDelete = async () => {
    setIsDeleting(true);
    try {
      const ids = selectedCustomers.map((customer) => customer.id);
      await batchDeleteAsync({ customerIds: ids });

      // Success toast is handled by the API client
      onSelectionClear();
      onSuccess?.();
    } catch (error) {
      // Error is handled by the API client
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error deleting customers:", error);
      }
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <>
      {/* Floating Actions Bar */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
        <Card className="shadow-sm border-border/40 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-4 px-4 py-3">
            {/* Selection Info */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <IconUsers className="h-5 w-5 text-primary" />
                <Badge variant="default" className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">
                  {selectedCount}
                </Badge>
              </div>
              <span className="text-sm font-medium">
                {selectedCount} {selectedCount === 1 ? "cliente selecionado" : "clientes selecionados"}
              </span>
            </div>

            {/* Divider */}
            <div className="h-6 w-px bg-border" />

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleBatchEdit} className="flex items-center gap-2">
                <IconEdit className="h-4 w-4" />
                {selectedCount === 1 ? "Editar" : "Editar em Lote"}
              </Button>

              <Button size="sm" variant="destructive" onClick={() => setShowDeleteConfirm(true)} disabled={isDeleting} className="flex items-center gap-2">
                {isDeleting ? <IconLoader2 className="h-4 w-4 animate-spin" /> : <IconTrash className="h-4 w-4" />}
                Excluir
              </Button>

              <Button size="sm" variant="ghost" onClick={onSelectionClear} className="flex items-center gap-2">
                <IconX className="h-4 w-4" />
                Cancelar
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <IconTrash className="h-5 w-5" />
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a excluir <strong>{selectedCount}</strong> {selectedCount === 1 ? "cliente" : "clientes"}.
              <br />
              <br />
              Esta ação não pode ser desfeita.
              <br />
              <br />
              Clientes selecionados:
              <div className="mt-2 p-2 bg-muted rounded text-sm max-h-32 overflow-y-auto space-y-1">
                {selectedCustomers.map((customer) => (
                  <div key={customer.id} className="flex items-center gap-2">
                    <IconCheck className="h-3 w-3 text-green-500" />
                    <span className="truncate">{customer.fantasyName}</span>
                  </div>
                ))}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBatchDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? (
                <>
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <IconTrash className="mr-2 h-4 w-4" />
                  Sim, Excluir {selectedCount === 1 ? "Cliente" : "Clientes"}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
