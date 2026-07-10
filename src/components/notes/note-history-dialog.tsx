// note-history-dialog.tsx
// Diálogo "Histórico" — monta o <ChangelogHistory> para a nota, lendo o
// changelog existente (GET /changelogs/entity/NOTE/:id).

import { IconHistory } from "@tabler/icons-react";

import type { Note } from "@/types/note";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { CHANGE_LOG_ENTITY_TYPE } from "@/constants/enums";

export interface NoteHistoryDialogProps {
  note: Note | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NoteHistoryDialog({ note, open, onOpenChange }: NoteHistoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconHistory className="h-5 w-5" />
            Histórico da nota
          </DialogTitle>
          <DialogDescription>Todas as alterações registradas nesta nota.</DialogDescription>
        </DialogHeader>

        {note && (
          <ChangelogHistory
            entityType={CHANGE_LOG_ENTITY_TYPE.NOTE}
            entityId={note.id}
            entityName={note.title || undefined}
            maxHeight="60vh"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

export default NoteHistoryDialog;
