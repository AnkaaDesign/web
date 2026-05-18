import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  isLoading?: boolean;
}

export function IgnoreTransactionDialog({ open, onOpenChange, onConfirm, isLoading }: Props) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    if (reason.trim().length < 10) {
      setError("Informe um motivo com ao menos 10 caracteres");
      return;
    }
    setError(null);
    onConfirm(reason.trim());
  };

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        onOpenChange(next);
        if (!next) {
          setReason("");
          setError(null);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ignorar transação</DialogTitle>
          <DialogDescription>
            A transação será marcada como "Ignorada" e não aparecerá mais nas listas de pendentes.
            Documente o motivo para auditoria futura.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reason">Motivo</Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Ex.: transferência interna entre contas; tarifa bancária; estorno duplicado..."
            rows={4}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? "Salvando..." : "Ignorar transação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
