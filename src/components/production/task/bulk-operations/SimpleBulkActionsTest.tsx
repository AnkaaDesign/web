import React, { useState, forwardRef, useImperativeHandle } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type BulkOperationType = "arts" | "documents" | "paints" | "cuttingPlans";

interface SimpleBulkActionsTestProps {
  selectedTaskIds: Set<string>;
  onClearSelection: () => void;
}

export const SimpleBulkActionsTest = forwardRef<
  { openModal: (type: BulkOperationType, taskIds: string[]) => void },
  SimpleBulkActionsTestProps
>(({ selectedTaskIds, onClearSelection }, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [operationType, setOperationType] = useState<BulkOperationType | null>(null);
  const [currentTaskIds, setCurrentTaskIds] = useState<string[]>([]);

  // Expose the openModal method to parent component
  useImperativeHandle(ref, () => ({
    openModal: (type: BulkOperationType, taskIds: string[]) => {
      setOperationType(type);
      setCurrentTaskIds(taskIds);
      setIsOpen(true);
    },
  }));

  const handleClose = () => {
    setIsOpen(false);
    setOperationType(null);
    setCurrentTaskIds([]);
  };

  const handleSubmit = () => {
    toast.success(`${operationType} operation would be applied to ${currentTaskIds.length} task(s)`);
    handleClose();
    onClearSelection();
  };

  const getModalTitle = () => {
    if (!operationType) return "";
    const titles: Record<BulkOperationType, string> = {
      arts: "Adicionar Artes",
      documents: "Adicionar Documentos",
      paints: "Adicionar Tintas",
      cuttingPlans: "Adicionar Plano de Corte",
    };
    return titles[operationType];
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{getModalTitle()}</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p>Tipo de operação: <strong>{operationType}</strong></p>
          <p>Tarefas selecionadas: <strong>{currentTaskIds.length}</strong></p>
          <p className="text-sm text-muted-foreground mt-2">
            Esta é uma versão de teste simplificada.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>
            Testar Operação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

SimpleBulkActionsTest.displayName = "SimpleBulkActionsTest";