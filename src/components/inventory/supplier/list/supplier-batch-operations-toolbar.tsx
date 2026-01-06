import { useState } from "react";
import type { Supplier } from "../../../../types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { IconTrash, IconEdit, IconX, IconDownload, IconArchive } from "@tabler/icons-react";
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
import { SupplierBatchEditDialog } from "../batch-edit";
import { useBatchDeleteSuppliers } from "../../../../hooks";
import { toast } from "sonner";

interface SupplierBatchOperationsToolbarProps {
  selectedSuppliers: Supplier[];
  onClearSelection: () => void;
  onRefresh?: () => void;
  className?: string;
}

export function SupplierBatchOperationsToolbar({ selectedSuppliers, onClearSelection, onRefresh, className }: SupplierBatchOperationsToolbarProps) {
  const [showBatchEditDialog, setShowBatchEditDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { mutateAsync: batchDeleteAsync } = useBatchDeleteSuppliers();

  const selectedCount = selectedSuppliers.length;

  if (selectedCount === 0) {
    return null;
  }

  const handleBatchEdit = () => {
    setShowBatchEditDialog(true);
  };

  const handleBatchDelete = async () => {
    setIsDeleting(true);
    try {
      const supplierIds = selectedSuppliers.map((supplier) => supplier.id);
      await batchDeleteAsync({ supplierIds });

      // Success/error toasts are handled by the API client
      onClearSelection();
      onRefresh?.();
    } catch (error) {
      // Error is handled by the API client
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error during batch delete:", error);
      }
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleExport = () => {
    // TODO: Implement export functionality
    toast.info("Funcionalidade de exportação em desenvolvimento");
  };

  const handleArchive = () => {
    // TODO: Implement archive functionality if suppliers have status
    toast.info("Funcionalidade de arquivamento em desenvolvimento");
  };

  const onBatchEditSuccess = () => {
    setShowBatchEditDialog(false);
    onClearSelection();
    onRefresh?.();
  };

  return (
    <>
      <div className={`flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg ${className || ""}`}>
        {/* Selection Info */}
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100">
            {selectedCount} selecionado{selectedCount !== 1 ? "s" : ""}
          </Badge>
          <span className="text-sm text-blue-700 dark:text-blue-300">{selectedCount === 1 ? "fornecedor selecionado" : "fornecedores selecionados"}</span>
        </div>

        <Separator orientation="vertical" className="h-6 bg-blue-200 dark:bg-blue-700" />

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleBatchEdit} className="border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50">
            <IconEdit className="mr-2 h-4 w-4" />
            Editar em Lote
          </Button>

          <Button variant="outline" size="sm" onClick={handleExport} className="border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50">
            <IconDownload className="mr-2 h-4 w-4" />
            Exportar
          </Button>

          <Button variant="outline" size="sm" onClick={handleArchive} className="border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50">
            <IconArchive className="mr-2 h-4 w-4" />
            Arquivar
          </Button>

          <Separator orientation="vertical" className="h-6 bg-blue-200 dark:bg-blue-700" />

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            className="border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <IconTrash className="mr-2 h-4 w-4" />
            Excluir
          </Button>
        </div>

        <div className="flex-1" />

        {/* Clear Selection */}
        <Button variant="ghost" size="sm" onClick={onClearSelection} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200">
          <IconX className="mr-2 h-4 w-4" />
          Limpar Seleção
        </Button>
      </div>

      {/* Batch Edit Dialog */}
      <SupplierBatchEditDialog isOpen={showBatchEditDialog} onClose={() => setShowBatchEditDialog(false)} selectedSuppliers={selectedSuppliers} onSuccess={onBatchEditSuccess} />

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <IconTrash className="h-5 w-5" />
              Confirmar Exclusão em Lote
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a excluir <strong>{selectedCount}</strong> {selectedCount === 1 ? "fornecedor" : "fornecedores"}.
              <br />
              <br />
              <strong>Esta ação não pode ser desfeita.</strong> Todos os dados relacionados aos fornecedores também podem ser afetados.
              <br />
              <br />
              Fornecedores que serão excluídos:
              <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-900 rounded text-sm max-h-32 overflow-y-auto">
                {selectedSuppliers.map((supplier) => (
                  <div key={supplier.id} className="flex items-center gap-2 py-1">
                    <span className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0"></span>
                    <span className="truncate font-medium">{supplier.fantasyName}</span>
                    {supplier.cnpj && <span className="text-xs text-muted-foreground font-mono">({supplier.cnpj})</span>}
                  </div>
                ))}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBatchDelete} disabled={isDeleting} className="bg-red-700 hover:bg-red-800">
              {isDeleting ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Excluindo...
                </>
              ) : (
                <>
                  <IconTrash className="mr-2 h-4 w-4" />
                  Sim, Excluir {selectedCount === 1 ? "Fornecedor" : "Fornecedores"}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
