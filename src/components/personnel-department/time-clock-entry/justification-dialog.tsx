import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Button } from "../../ui/button";
import { RadioGroup, RadioGroupItem } from "../../ui/radio-group";
import { Label } from "../../ui/label";
import { ScrollArea } from "../../ui/scroll-area";

interface Justification {
  Id: number;
  NomeAbreviado: string;
  NomeCompleto?: string | null;
  ValorDia?: any;
  Ajuste: boolean;
  Abono2: boolean;
  Abono3: boolean;
  Abono4: boolean;
  UsarJustificativaParaContagemDeFerias: boolean;
}

interface JustificationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  justifications: Justification[];
  onSelect: (justification: Justification) => void;
}

export function JustificationDialog({ isOpen, onClose, justifications, onSelect }: JustificationDialogProps) {
  const [selectedId, setSelectedId] = React.useState<string>("");

  const handleConfirm = () => {
    const selected = justifications.find((j) => j.Id.toString() === selectedId);
    if (selected) {
      onSelect(selected);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Selecionar Justificativa</DialogTitle>
          <DialogDescription>Escolha uma justificativa para aplicar ao registro</DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[300px] w-full rounded-md border p-4">
          <RadioGroup value={selectedId} onValueChange={setSelectedId}>
            {justifications.map((justification) => (
              <div key={justification.Id} className="flex items-start space-x-2 mb-4 pb-4 border-b last:border-0">
                <RadioGroupItem value={justification.Id.toString()} id={`just-${justification.Id}`} className="mt-1" />
                <Label htmlFor={`just-${justification.Id}`} className="flex-1 cursor-pointer">
                  <div className="font-medium text-sm">{justification.NomeAbreviado}</div>
                  {justification.NomeCompleto && <div className="text-xs text-gray-500 mt-1">{justification.NomeCompleto}</div>}
                  <div className="flex gap-3 mt-2 text-xs text-gray-400">
                    {justification.Ajuste && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">Ajuste</span>}
                    {justification.Abono2 && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded">Abono 2</span>}
                    {justification.Abono3 && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded">Abono 3</span>}
                    {justification.Abono4 && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded">Abono 4</span>}
                    {justification.UsarJustificativaParaContagemDeFerias && <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded">Conta Férias</span>}
                  </div>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedId}>
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
