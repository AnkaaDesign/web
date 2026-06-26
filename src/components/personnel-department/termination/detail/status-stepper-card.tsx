import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconProgress } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import {
  NOTICE_TYPE,
  TERMINATION_STATUS,
  TERMINATION_STATUS_LABELS,
  TERMINATION_TYPE,
} from "../../../../constants";
import type { Termination } from "../../../../types/termination";
import { WorkflowStepper, type WorkflowStep } from "../../shared/workflow-stepper";

/** Forward chain of the termination status machine (CANCELLED handled separately). */
export const TERMINATION_STATUS_CHAIN: TERMINATION_STATUS[] = [
  TERMINATION_STATUS.INITIATED,
  TERMINATION_STATUS.NOTICE_PERIOD,
  TERMINATION_STATUS.DOCUMENTS,
  TERMINATION_STATUS.MEDICAL_EXAM,
  TERMINATION_STATUS.CALCULATION,
  TERMINATION_STATUS.PAYMENT,
  // HOMOLOGATION (Part G) sits between PAYMENT and COMPLETED: the TRCT /
  // homologação PDFs are auto-generated when the process enters this step.
  TERMINATION_STATUS.HOMOLOGATION,
  TERMINATION_STATUS.COMPLETED,
];

/**
 * Per-termination applicable chain (mirrors the server in
 * api/src/modules/personnel-department/termination/termination.service.ts):
 * - NOTICE_PERIOD only when the notice is actually WORKED;
 * - MEDICAL_EXAM never applies to DEATH (no exame demissional is possible).
 */
export function getTerminationStatusChain(termination: Pick<Termination, "type" | "noticeType">): TERMINATION_STATUS[] {
  return TERMINATION_STATUS_CHAIN.filter((status) => {
    if (status === TERMINATION_STATUS.NOTICE_PERIOD) return termination.noticeType === NOTICE_TYPE.WORKED;
    if (status === TERMINATION_STATUS.MEDICAL_EXAM) return termination.type !== TERMINATION_TYPE.DEATH;
    return true;
  });
}

export function getNextTerminationStatus(termination: Pick<Termination, "status" | "type" | "noticeType">): TERMINATION_STATUS | null {
  const currentIndex = TERMINATION_STATUS_CHAIN.indexOf(termination.status);
  if (currentIndex === -1) return null; // CANCELLED
  // First applicable status after the current one in the full chain (robust
  // even when the current status was later made inapplicable by an edit).
  return getTerminationStatusChain(termination).find((status) => TERMINATION_STATUS_CHAIN.indexOf(status) > currentIndex) ?? null;
}

export function getPreviousTerminationStatus(termination: Pick<Termination, "status" | "type" | "noticeType">): TERMINATION_STATUS | null {
  const currentIndex = TERMINATION_STATUS_CHAIN.indexOf(termination.status);
  if (currentIndex === -1) return null; // CANCELLED
  // Last applicable status strictly before the current one in the full chain.
  const applicable = getTerminationStatusChain(termination);
  for (let i = applicable.length - 1; i >= 0; i--) {
    if (TERMINATION_STATUS_CHAIN.indexOf(applicable[i]) < currentIndex) return applicable[i];
  }
  return null;
}

interface StatusStepperCardProps {
  termination: Termination;
  className?: string;
}

export function StatusStepperCard({ termination, className }: StatusStepperCardProps) {
  const isCancelled = termination.status === TERMINATION_STATUS.CANCELLED;
  const isCompleted = termination.status === TERMINATION_STATUS.COMPLETED;
  // Applicable steps for THIS termination (skips the notice period when the
  // notice is not worked and the dismissal exam for DEATH).
  const chain = getTerminationStatusChain(termination);
  const steps: WorkflowStep[] = chain.map((status) => ({ key: status, label: TERMINATION_STATUS_LABELS[status] }));
  const fullIndex = TERMINATION_STATUS_CHAIN.indexOf(termination.status);
  const currentIndex = fullIndex === -1 ? -1 : chain.findIndex((status) => TERMINATION_STATUS_CHAIN.indexOf(status) >= fullIndex);

  // The step the process stopped on when cancelled (mapped into the applicable chain).
  const cancelledFullIndex = termination.cancelledFromStatus ? TERMINATION_STATUS_CHAIN.indexOf(termination.cancelledFromStatus) : -1;
  const cancelledAtIndex = cancelledFullIndex === -1 ? 0 : Math.max(0, chain.findIndex((status) => TERMINATION_STATUS_CHAIN.indexOf(status) >= cancelledFullIndex));

  return (
    <Card className={cn("shadow-sm border border-border", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <IconProgress className="h-5 w-5 text-muted-foreground" />
          Andamento da Rescisão
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <WorkflowStepper
          steps={steps}
          currentIndex={currentIndex}
          isCompleted={isCompleted}
          cancelled={isCancelled ? { atIndex: cancelledAtIndex, reason: termination.cancellationReason } : null}
        />
        {/* The DISMISSAL exam (ASO) lives in its own half-width ExamCard now;
            it used to render full-bleed inside this stepper card. */}
      </CardContent>
    </Card>
  );
}
