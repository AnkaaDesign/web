import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { IconCheck, IconProgress, IconAlertTriangle } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { VACATION_STATUS, VACATION_STATUS_LABELS } from "../../../../constants";
import type { Vacation } from "../../../../types/vacation";

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

interface VacationStatusStepperCardProps {
  vacation: Vacation;
  className?: string;
}

export function VacationStatusStepperCard({ vacation, className }: VacationStatusStepperCardProps) {
  const isExpired = vacation.status === VACATION_STATUS.EXPIRED;
  const chain = VACATION_STATUS_CHAIN;
  const currentIndex = chain.indexOf(vacation.status);

  return (
    <Card className={cn("shadow-sm border border-border", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <IconProgress className="h-5 w-5 text-muted-foreground" />
          Andamento das Férias
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isExpired && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle className="flex items-center gap-2">
              <IconAlertTriangle className="h-4 w-4" />
              Período concessivo vencido (art. 137)
            </AlertTitle>
            <AlertDescription>O período concessivo expirou sem concessão das férias. As férias são devidas em dobro.</AlertDescription>
          </Alert>
        )}

        <div className={cn("flex items-start", isExpired && "opacity-50")}>
          {chain.map((status, index) => {
            const isDone = currentIndex > index || vacation.status === VACATION_STATUS.PAID;
            const isCurrent = currentIndex === index && vacation.status !== VACATION_STATUS.PAID;

            return (
              <div key={status} className="flex-1 flex flex-col items-center relative">
                {index > 0 && (
                  <div
                    className={cn(
                      "absolute top-4 right-1/2 w-full h-0.5 -translate-y-1/2",
                      currentIndex >= index || vacation.status === VACATION_STATUS.PAID ? "bg-primary" : "bg-border",
                    )}
                  />
                )}

                <div
                  className={cn(
                    "relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 text-xs font-semibold transition-colors bg-background",
                    isDone && "bg-primary border-primary text-primary-foreground",
                    isCurrent && "border-primary text-primary",
                    !isDone && !isCurrent && "border-border text-muted-foreground",
                  )}
                >
                  {isDone ? <IconCheck className="h-4 w-4" /> : index + 1}
                </div>

                <span
                  className={cn(
                    "mt-2 text-[11px] sm:text-xs text-center leading-tight px-1",
                    isCurrent ? "font-semibold text-primary" : isDone ? "font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  {VACATION_STATUS_LABELS[status]}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
