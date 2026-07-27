// =====================================================
// Attention system — save-time conflict guard
// =====================================================
//
// The last line of the presence-based override guard.
//
// Locking the "Editar" button is a good deterrent, but it only covers people who
// arrive AFTER someone else. It does nothing for the case that actually loses work:
// two users who both opened the record while it was free, and now both press Salvar.
//
// So the save path re-checks with the server at the moment of writing and, if someone
// else is holding the record, makes the user make an explicit choice instead of
// silently overwriting.
//
// Usage:
//   const { guardSave, conflictDialog } = useSaveConflictGuard();
//   ...
//   if (!(await guardSave("TASK", task.id))) return;   // user chose to cancel
//   ...
//   return (<>{conflictDialog}<form .../></>)

import { useCallback, useRef, useState } from "react";

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

import { formatEditingSince, type PresenceEditor } from "./presence";
import { checkOtherEditors } from "./presence-guard";
import type { AttentionEntityType } from "./types";

export interface SaveConflictGuard {
  /**
   * Resolve to `true` when it is safe to proceed with the write.
   *
   * Fails OPEN — if the presence check cannot reach the server the save proceeds, since
   * blocking every write whenever an advisory service is unavailable would be a far
   * worse outage than the race it guards against.
   */
  guardSave: (type: AttentionEntityType, id: string | undefined) => Promise<boolean>;
  /** Render this once, anywhere inside the form. */
  conflictDialog: React.ReactNode;
}

export function useSaveConflictGuard(): SaveConflictGuard {
  const [editors, setEditors] = useState<ReadonlyArray<PresenceEditor>>([]);
  const [open, setOpen] = useState(false);
  const resolveRef = useRef<((proceed: boolean) => void) | null>(null);

  const settle = useCallback((proceed: boolean) => {
    setOpen(false);
    const resolve = resolveRef.current;
    resolveRef.current = null;
    resolve?.(proceed);
  }, []);

  const guardSave = useCallback<SaveConflictGuard["guardSave"]>(async (type, id) => {
    if (!id) return true;
    const { others } = await checkOtherEditors(type, id);
    if (others.length === 0) return true;

    setEditors(others);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const now = Date.now();
  const who =
    editors.length === 1
      ? `${editors[0].userName} está editando este registro ${formatEditingSince(editors[0].since, now)}`
      : `${editors.map((e) => e.userName).join(", ")} estão editando este registro agora`;

  const conflictDialog = (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        // Dismissing by overlay/Escape is a cancel, never an implicit "overwrite".
        if (!next) settle(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Alguém está editando ao mesmo tempo</AlertDialogTitle>
          <AlertDialogDescription>
            {who}. Se você salvar agora, suas alterações podem sobrescrever as dessa pessoa — e as dela podem sobrescrever as suas.
            <br />
            <br />
            O ideal é combinar quem salva primeiro.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => settle(false)}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => settle(true)}>Salvar mesmo assim</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { guardSave, conflictDialog };
}
