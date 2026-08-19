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
  onConfirm: (note: string | null) => void;
  isLoading?: boolean;
  /** Categoria que sustenta a linha, para a frase dizer o que fica valendo. */
  category?: string | null;
}

/**
 * "Marcar como resolvido" — o oposto de Ignorar.
 *
 * Ignorar tira a linha do escopo da conciliação (fica cinza) e por isso exige
 * motivo. Aqui o pagamento continua contabilizado pela sua categoria; o que se
 * declara é só que não existe conta recorrente nem nota fiscal para vincular —
 * então o motivo é opcional.
 */
export function AcknowledgeTransactionDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
  category,
}: Props) {
  const [note, setNote] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        onOpenChange(next);
        if (!next) setNote("");
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar como resolvido</DialogTitle>
          <DialogDescription>
            {category
              ? `A linha continua contabilizada em "${category}" — você está declarando que não existe conta recorrente nem nota fiscal para vincular a ela.`
              : "Você está declarando que esta linha não tem conta recorrente nem nota fiscal para vincular."}{" "}
            Ela passa a contar como conciliada. Isso é diferente de "Ignorar", que tira a
            transação do escopo da conciliação.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="ack-note">Observação (opcional)</Label>
          <Textarea
            id="ack-note"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Ex.: pagamento avulso à Vivo, não há conta recorrente cadastrada."
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={() => onConfirm(note.trim() || null)} disabled={isLoading}>
            {isLoading ? "Salvando..." : "Marcar como resolvido"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
