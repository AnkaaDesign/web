// components/production/skill-assessment/submit-confirmation-dialog.tsx
//
// Final lock-in dialog. Surfaces a recap of coverage + a warning that the
// entry will become read-only after submit (admin can reopen).

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
import { IconAlertTriangle, IconCheck } from "@tabler/icons-react";
import { buttonVariants } from "@/components/ui/button";

interface SubmitConfirmationDialogProps {
  open: boolean;
  evaluateeName: string;
  totalTopics: number;
  answered: number;
  missingJustifications: number;
  isSubmitting?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function SubmitConfirmationDialog({
  open,
  evaluateeName,
  totalTopics,
  answered,
  missingJustifications,
  isSubmitting,
  onOpenChange,
  onConfirm,
}: SubmitConfirmationDialogProps) {
  const allAnswered = answered === totalTopics;
  const canSubmit = allAnswered && missingJustifications === 0 && !isSubmitting;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <IconCheck className="h-5 w-5 text-emerald-600" />
            Finalizar avaliação?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>
                Você está prestes a enviar a avaliação de{" "}
                <span className="font-semibold text-foreground">{evaluateeName}</span>. Após o
                envio, esta avaliação ficará bloqueada para edição.
              </p>
              <div className="rounded-md border bg-muted/40 p-3 text-foreground">
                <ul className="space-y-1">
                  <li className="flex items-center justify-between">
                    <span>Tópicos respondidos</span>
                    <span className="font-semibold tabular-nums">
                      {answered} / {totalTopics}
                    </span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>Justificativas pendentes (nota ≤ 2)</span>
                    <span
                      className={
                        missingJustifications > 0
                          ? "font-semibold text-amber-700"
                          : "font-semibold text-emerald-700"
                      }
                    >
                      {missingJustifications}
                    </span>
                  </li>
                </ul>
              </div>
              {!allAnswered && (
                <p className="flex items-start gap-2 rounded-md bg-amber-50 p-2 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                  <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  Responda todos os tópicos antes de finalizar.
                </p>
              )}
              {allAnswered && missingJustifications > 0 && (
                <p className="flex items-start gap-2 rounded-md bg-amber-50 p-2 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                  <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  Adicione justificativa para as notas críticas (≤ 2) antes de enviar.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (canSubmit) onConfirm();
            }}
            disabled={!canSubmit}
            className={buttonVariants({ variant: "default" })}
          >
            {isSubmitting ? "Enviando…" : "Confirmar e enviar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
