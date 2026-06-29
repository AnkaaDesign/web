import { useCallback, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface ReasonOpts {
  title: string;
  description?: string;
  label?: string;
  placeholder?: string;
  /** Require a non-empty reason (disables Save until typed). */
  required?: boolean;
  /** Minimum reason length — Save stays disabled (with an inline hint) until met. */
  minLength?: number;
  confirmLabel?: string;
}

/**
 * Promise-based reason-capture dialog — `await ask({...})` resolves to the typed string (possibly
 * empty when not `required`), or `null` if cancelled. Plugs into an inline-edit `beforeCommit` gate.
 */
export function useReason() {
  const [state, setState] = useState<(ReasonOpts & { open: boolean }) | null>(null);
  const [value, setValue] = useState("");
  const resolver = useRef<((v: string | null) => void) | null>(null);

  const ask = useCallback((opts: ReasonOpts) => {
    // A new prompt supersedes any pending one — settle the prior promise (abort = null) so its
    // awaiter unblocks instead of being orphaned forever.
    resolver.current?.(null);
    setValue("");
    setState({ ...opts, open: true });
    return new Promise<string | null>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((v: string | null) => {
    resolver.current?.(v);
    resolver.current = null;
    setState((s) => (s ? { ...s, open: false } : s));
  }, []);

  const minLength = state?.minLength ?? 0;
  const trimmed = value.trim();
  const tooShort = minLength > 0 && trimmed.length < minLength;
  // Confirm is blocked while a required reason is empty OR shorter than the minimum.
  const confirmDisabled = (state?.required ? !trimmed : false) || tooShort;

  const dialog = (
    <Dialog open={!!state?.open} onOpenChange={(o) => !o && settle(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{state?.title}</DialogTitle>
          {state?.description ? <DialogDescription>{state.description}</DialogDescription> : null}
        </DialogHeader>
        <div className="space-y-2">
          {state?.label ? <Label>{state.label}</Label> : null}
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={state?.placeholder}
            rows={3}
            autoFocus
          />
          {tooShort ? (
            <p className="text-xs text-destructive">Mínimo de {minLength} caracteres.</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => settle(null)}>
            Cancelar
          </Button>
          <Button onClick={() => settle(value)} disabled={confirmDisabled}>
            {state?.confirmLabel ?? "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { ask, dialog };
}
