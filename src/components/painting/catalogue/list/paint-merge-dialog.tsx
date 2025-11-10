import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Paint } from "../../../../types";
import { IconGitMerge, IconAlertTriangle } from "@tabler/icons-react";

interface PaintMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPaints: Paint[];
  onConfirm: (keepPaintId: string, mergeIntoIds: string[]) => void;
}

export function PaintMergeDialog({ open, onOpenChange, selectedPaints, onConfirm }: PaintMergeDialogProps) {
  const [selectedKeepId, setSelectedKeepId] = useState<string | null>(null);

  const handleConfirm = () => {
    if (!selectedKeepId) return;

    const mergeIds = selectedPaints
      .filter((p) => p.id !== selectedKeepId)
      .map((p) => p.id);

    onConfirm(selectedKeepId, mergeIds);
    onOpenChange(false);
    setSelectedKeepId(null);
  };

  const handleCancel = () => {
    onOpenChange(false);
    setSelectedKeepId(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconGitMerge className="h-5 w-5" />
            Mesclar Tintas
          </DialogTitle>
          <DialogDescription>
            Selecione a tinta que deseja manter. As outras tintas selecionadas serão mescladas nela e removidas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Warning */}
          <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
            <IconAlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800 dark:text-yellow-200">
              <p className="font-medium mb-1">Atenção!</p>
              <p>Esta ação não pode ser desfeita. As tintas mescladas serão permanentemente removidas.</p>
            </div>
          </div>

          {/* Paint selection */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Selecione a tinta a manter ({selectedPaints.length} tintas selecionadas):</p>
            <div className="space-y-2">
              {selectedPaints.map((paint) => (
                <button
                  key={paint.id}
                  onClick={() => setSelectedKeepId(paint.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                    selectedKeepId === paint.id
                      ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  {/* Color preview */}
                  <div
                    className="w-12 h-12 rounded-md border border-gray-300 dark:border-gray-600 flex-shrink-0"
                    style={{ backgroundColor: paint.hex }}
                  />

                  {/* Paint info */}
                  <div className="flex-1 text-left">
                    <p className="font-medium">{paint.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-mono text-muted-foreground">{paint.hex}</span>
                      {paint.paintType && (
                        <Badge variant="secondary" className="text-xs">
                          {paint.paintType.name}
                        </Badge>
                      )}
                      {paint.paintBrand && (
                        <Badge variant="outline" className="text-xs">
                          {paint.paintBrand.name}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {paint.formulas?.length || 0} fórmula{(paint.formulas?.length || 0) !== 1 ? "s" : ""}
                    </p>
                  </div>

                  {/* Selection indicator */}
                  {selectedKeepId === paint.id && (
                    <div className="flex-shrink-0 bg-green-500 text-white rounded-full p-1">
                      <IconGitMerge className="h-4 w-4" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          {selectedKeepId && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <span className="font-medium">Resumo:</span> {selectedPaints.length - 1} tinta
                {selectedPaints.length - 1 !== 1 ? "s serão mescladas" : " será mesclada"} em{" "}
                <span className="font-medium">{selectedPaints.find((p) => p.id === selectedKeepId)?.name}</span> e removida
                {selectedPaints.length - 1 !== 1 ? "s" : ""}.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedKeepId} className="bg-green-600 hover:bg-green-700">
            <IconGitMerge className="h-4 w-4 mr-2" />
            Confirmar Mesclagem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
