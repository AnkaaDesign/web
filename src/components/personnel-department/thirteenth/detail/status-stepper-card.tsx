import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { IconCheck, IconProgress, IconBan } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { THIRTEENTH_STATUS, THIRTEENTH_STATUS_LABELS } from "../../../../constants";
import type { Thirteenth } from "../../../../types/thirteenth";
import { THIRTEENTH_STEPPER_FLOW } from "../utils";

interface StatusStepperCardProps {
  thirteenth: Thirteenth;
  className?: string;
}

export function StatusStepperCard({ thirteenth, className }: StatusStepperCardProps) {
  const isCancelled = thirteenth.status === THIRTEENTH_STATUS.CANCELLED;
  const isPaid = thirteenth.status === THIRTEENTH_STATUS.PAID;
  const currentIndex = THIRTEENTH_STEPPER_FLOW.indexOf(thirteenth.status);

  return (
    <Card className={cn("shadow-sm border border-border", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <IconProgress className="h-5 w-5 text-muted-foreground" />
          Andamento do 13º
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isCancelled && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>13º cancelado</AlertTitle>
            <AlertDescription>Este 13º foi cancelado e não pode mais ser avançado.</AlertDescription>
          </Alert>
        )}

        <div className={cn("flex items-start", isCancelled && "opacity-50")}>
          {THIRTEENTH_STEPPER_FLOW.map((status, index) => {
            const isDone = isPaid || currentIndex > index;
            const isCurrent = !isCancelled && currentIndex === index && !isPaid;

            return (
              <div key={status} className="flex-1 flex flex-col items-center relative">
                {index > 0 && (
                  <div
                    className={cn(
                      "absolute top-4 right-1/2 w-full h-0.5 -translate-y-1/2",
                      isPaid || currentIndex >= index ? "bg-primary" : "bg-border",
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
                  {THIRTEENTH_STATUS_LABELS[status]}
                </span>
              </div>
            );
          })}

          {isCancelled && (
            <div className="flex flex-col items-center relative pl-2">
              <div className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 border-destructive bg-destructive text-destructive-foreground">
                <IconBan className="h-4 w-4" />
              </div>
              <span className="mt-2 text-[11px] sm:text-xs text-center font-semibold text-destructive">{THIRTEENTH_STATUS_LABELS[THIRTEENTH_STATUS.CANCELLED]}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
