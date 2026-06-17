import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { IconProgress, IconAlertTriangle } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { VACATION_STATUS, VACATION_STATUS_LABELS } from "../../../../constants";
import type { Vacation } from "../../../../types/vacation";
import { getVacationStatusVariant } from "../list/vacation-table-columns";
import { WorkflowStepper, type WorkflowStep } from "@/components/personnel-department/shared/workflow-stepper";

/** Forward chain of the vacation status machine (EXPIRED handled separately). */
export const VACATION_STATUS_CHAIN: VACATION_STATUS[] = [
  VACATION_STATUS.OPEN,
  VACATION_STATUS.SCHEDULED,
  VACATION_STATUS.IN_PROGRESS,
  VACATION_STATUS.PAID,
];

export function getNextVacationStatus(vacation: Pick<Vacation, "status">): VACATION_STATUS | null {
  const currentIndex = VACATION_STATUS_CHAIN.indexOf(vacation.status);
  if (currentIndex === -1) return null; // EXPIRED
  return VACATION_STATUS_CHAIN[currentIndex + 1] ?? null;
}

// Shared full-width stepper steps (same component used by Admissão/Rescisão).
const STEPPER_STEPS: WorkflowStep[] = VACATION_STATUS_CHAIN.map((status) => ({
  key: status,
  label: VACATION_STATUS_LABELS[status],
}));

interface VacationStatusStepperCardProps {
  vacation: Vacation;
  className?: string;
}

export function VacationStatusStepperCard({ vacation, className }: VacationStatusStepperCardProps) {
  const isExpired = vacation.status === VACATION_STATUS.EXPIRED;
  const isCompleted = vacation.status === VACATION_STATUS.PAID;
  const chainIndex = VACATION_STATUS_CHAIN.indexOf(vacation.status);
  // EXPIRED isn't in the forward chain; show it dimmed at the scheduling step
  // with the art.137 alert below (it is still payable, in dobro).
  const currentIndex = chainIndex >= 0 ? chainIndex : 1;

  return (
    <Card className={cn("shadow-sm border border-border", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <IconProgress className="h-5 w-5 text-muted-foreground" />
            Andamento das Férias
          </div>
          <Badge variant={getVacationStatusVariant(vacation.status)} className="text-xs whitespace-nowrap">
            {VACATION_STATUS_LABELS[vacation.status] || vacation.status}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <WorkflowStepper
          steps={STEPPER_STEPS}
          currentIndex={currentIndex}
          isCompleted={isCompleted}
          className={cn(isExpired && "opacity-50")}
        />

        {isExpired && (
          <Alert variant="destructive">
            <AlertTitle className="flex items-center gap-2">
              <IconAlertTriangle className="h-4 w-4" />
              Período concessivo vencido (art. 137)
            </AlertTitle>
            <AlertDescription>O período concessivo expirou sem concessão das férias. As férias são devidas em dobro.</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
