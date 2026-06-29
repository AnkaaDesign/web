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
import type { ReactNode } from "react";

interface ConfirmOpts {
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
}

/**
 * Promise-based confirm dialog — `await confirm({...})` resolves true/false. Designed to plug into
 * an inline-edit `beforeCommit` gate so a styled AlertDialog can guard a commit.
 */
export function useConfirm() {
  const [state, setState] = useState<(ConfirmOpts & { open: boolean }) | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOpts) => {
    // A new dialog supersedes any pending one — settle the prior promise (false) so its awaiter
    // unblocks instead of being orphaned when the resolver is overwritten.
    resolver.current?.(false);
    setState({ ...opts, open: true });
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setState((s) => (s ? { ...s, open: false } : s));
  }, []);

  const dialog = (
    <AlertDialog open={!!state?.open} onOpenChange={(o) => !o && settle(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state?.title}</AlertDialogTitle>
          {state?.description ? <AlertDialogDescription>{state.description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => settle(false)}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => settle(true)}
            className={state?.destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
          >
            {state?.confirmLabel ?? "Confirmar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, dialog };
}
