import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { IconProgress, IconAlertTriangle } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { VACATION_STATUS, VACATION_STATUS_LABELS } from "../../../../constants";
import { isVacationInProgress } from "../../../../utils";
import type { Vacation } from "../../../../types/vacation";
import { getVacationStatusVariant } from "../list/vacation-table-columns";
import { WorkflowStepper, type WorkflowStep } from "@/components/personnel-department/shared/workflow-stepper";

/**
 * The vacation lifecycle is now SCHEDULED → PAID (+ EXPIRED system-set). The
 * only action is "Marcar como pago" — there is no chained advance. "Em gozo" is
 * a computed middle step (never persisted) shown when the gozo window is active.
 */
export function getNextVacationStatus(vacation: Pick<Vacation, "status">): VACATION_STATUS | null {
  // From SCHEDULED or EXPIRED the only forward transition is PAID.
  if (vacation.status === VACATION_STATUS.SCHEDULED || vacation.status === VACATION_STATUS.EXPIRED) {
    return VACATION_STATUS.PAID;
  }
  return null; // PAID is final.
}

// Display stepper: Agendada → Em gozo (computed) → Paga.
const STEPPER_STEPS: WorkflowStep[] = [
  { key: VACATION_STATUS.SCHEDULED, label: VACATION_STATUS_LABELS[VACATION_STATUS.SCHEDULED] },
  { key: "IN_PROGRESS", label: "Em gozo" },
  { key: VACATION_STATUS.PAID, label: VACATION_STATUS_LABELS[VACATION_STATUS.PAID] },
];

interface VacationStatusStepperCardProps {
  vacation: Vacation;
  className?: string;
}

export function VacationStatusStepperCard({ vacation, className }: VacationStatusStepperCardProps) {
  const isExpired = vacation.status === VACATION_STATUS.EXPIRED;
  const isPaid = vacation.status === VACATION_STATUS.PAID;
  const inProgress = isVacationInProgress(vacation);

  // Map the entity to a step index on the Agendada → Em gozo → Paga rail.
  // PAID lands on the last step (completed). Em gozo (computed) lands on the
  // middle step. SCHEDULED (not yet em gozo) and EXPIRED sit on the first step.
  let currentIndex: number;
  if (isPaid) currentIndex = 2;
  else if (inProgress) currentIndex = 1;
  else currentIndex = 0;

  return (
    <Card className={cn("shadow-sm border border-border", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <IconProgress className="h-5 w-5 text-muted-foreground" />
            Andamento das Férias
          </div>
          {inProgress ? (
            <Badge variant="active" className="text-xs whitespace-nowrap">
              Em gozo
            </Badge>
          ) : (
            <Badge variant={getVacationStatusVariant(vacation.status)} className="text-xs whitespace-nowrap">
              {VACATION_STATUS_LABELS[vacation.status] || vacation.status}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <WorkflowStepper
          steps={STEPPER_STEPS}
          currentIndex={currentIndex}
          isCompleted={isPaid}
          className={cn(isExpired && "opacity-50")}
        />

        {isExpired && (
          <Alert variant="destructive">
            <AlertTitle className="flex items-center gap-2">
              <IconAlertTriangle className="h-4 w-4" />
              Período concessivo vencido (art. 137)
            </AlertTitle>
            <AlertDescription>O período concessivo expirou sem concessão das férias. As férias são devidas em dobro — ainda podem ser marcadas como pagas.</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
