/**
 * O diálogo dos atos que pedem texto: aprovar em nome do cliente (como ele
 * aprovou) e reprovar (o motivo). O texto vai para a trilha da arte.
 */
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export interface ArtNoteDialogConfig {
  title: string;
  description: string;
  placeholder: string;
  confirm: string;
  destructive?: boolean;
}

interface ArtNoteDialogProps {
  config: ArtNoteDialogConfig | null;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (text: string) => void;
}

/** A API recusa nota curta demais; três letras é o piso dela. */
const MIN_NOTE_LENGTH = 3;

export function ArtNoteDialog({ config, busy, onCancel, onConfirm }: ArtNoteDialogProps) {
  const [text, setText] = useState("");
  useEffect(() => {
    if (config) setText("");
  }, [config]);

  const trimmed = text.trim();
  const canConfirm = trimmed.length >= MIN_NOTE_LENGTH && !busy;

  return (
    <Dialog open={!!config} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        {config && (
          <>
            <DialogHeader>
              <DialogTitle>{config.title}</DialogTitle>
              <DialogDescription>{config.description}</DialogDescription>
            </DialogHeader>
            <Textarea
              autoFocus
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={config.placeholder}
              rows={4}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant={config.destructive ? "destructive" : "default"}
                disabled={!canConfirm}
                onClick={() => onConfirm(trimmed)}
              >
                {config.confirm}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
