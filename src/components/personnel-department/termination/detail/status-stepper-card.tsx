import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { IconCheck, IconProgress, IconBan, IconAlertTriangle, IconStethoscope, IconCalendarPlus } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import {
  MEDICAL_EXAM_RESULT,
  MEDICAL_EXAM_STATUS,
  MEDICAL_EXAM_TYPE,
  NOTICE_TYPE,
  TERMINATION_STATUS,
  TERMINATION_STATUS_LABELS,
  TERMINATION_TYPE,
  routes,
} from "../../../../constants";
import type { Termination } from "../../../../types/termination";
import { LinkedExamStatus, useLinkedMedicalExam } from "@/components/occupational-health/medical-exam/detail/linked-exam-status";

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
 * api/src/modules/human-resources/termination/termination.service.ts):
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
  const navigate = useNavigate();
  const isCancelled = termination.status === TERMINATION_STATUS.CANCELLED;
  // Applicable steps for THIS termination (skips the notice period when the
  // notice is not worked and the dismissal exam for DEATH).
  const chain = getTerminationStatusChain(termination);
  const fullIndex = TERMINATION_STATUS_CHAIN.indexOf(termination.status);
  const currentIndex = fullIndex === -1 ? -1 : chain.findIndex((status) => TERMINATION_STATUS_CHAIN.indexOf(status) >= fullIndex);
  const hasMedicalStep = chain.includes(TERMINATION_STATUS.MEDICAL_EXAM);

  // DISMISSAL exam created for this termination process (auto-created by the
  // server when the process enters the medical-exam step).
  const { exam: dismissalExam, isLoading: isExamLoading } = useLinkedMedicalExam(termination.userId, MEDICAL_EXAM_TYPE.DISMISSAL, termination.createdAt);
  const reachedMedicalStep =
    hasMedicalStep && !isCancelled && fullIndex >= TERMINATION_STATUS_CHAIN.indexOf(TERMINATION_STATUS.MEDICAL_EXAM);
  const showExamSection = reachedMedicalStep || !!dismissalExam;
  const isExamCompleted = dismissalExam?.status === MEDICAL_EXAM_STATUS.COMPLETED;
  const awaitingExam = termination.status === TERMINATION_STATUS.MEDICAL_EXAM && !isExamLoading && !isExamCompleted;
  const isExamUnfit = isExamCompleted && dismissalExam?.result === MEDICAL_EXAM_RESULT.UNFIT;
  // Offer scheduling when the medical step applies/was reached and no DISMISSAL
  // exam exists yet (covers older processes without auto-creation).
  const canScheduleExam = showExamSection && !isExamLoading && !dismissalExam && !isCancelled;

  // Navigate to the ASO CREATE form, pre-filled and locked. The exam is created
  // ONLY when the form is submitted — backing out leaves no orphan "Agendado".
  const handleScheduleExam = () => {
    const params = new URLSearchParams({
      userId: termination.userId,
      type: MEDICAL_EXAM_TYPE.DISMISSAL,
      terminationId: termination.id,
    });
    navigate(`${routes.occupationalHealth.medicalExams.create}?${params.toString()}`);
  };

  return (
    <Card className={cn("shadow-sm border border-border", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <IconProgress className="h-5 w-5 text-muted-foreground" />
          Andamento da Rescisão
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isCancelled && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Rescisão cancelada</AlertTitle>
            <AlertDescription>Este processo de rescisão foi cancelado e não pode mais ser avançado.</AlertDescription>
          </Alert>
        )}

        <div className="flex items-start gap-2">
          {/* Full-width stepper: dots span edge to edge with a continuous
              connector track behind them; labels centered under each dot. */}
          <div className={cn("relative flex-1", isCancelled && "opacity-50")}>
            {chain.length > 1 && (
              <>
                <div className="absolute top-4 left-4 right-4 h-0.5 -translate-y-1/2 bg-border" />
                <div
                  className="absolute top-4 left-4 h-0.5 -translate-y-1/2 bg-primary transition-all"
                  style={{
                    // The fill must terminate exactly at the CURRENT circle's
                    // center. Circles are not evenly interpolated: the first is
                    // left-aligned (center 1rem), the last right-aligned (center
                    // 100% - 1rem) and middle ones centered in equal n-columns
                    // (center = (i + 0.5) * 100% / n). The track origin is at 1rem
                    // (left-4), so the fill width is the current center minus 1rem.
                    width:
                      termination.status === TERMINATION_STATUS.COMPLETED || currentIndex >= chain.length - 1
                        ? "calc(100% - 2rem)"
                        : currentIndex <= 0
                          ? "0px"
                          : `calc((${currentIndex} + 0.5) * (100% / ${chain.length}) - 1rem)`,
                  }}
                />
              </>
            )}
            <div className="relative flex items-start justify-between">
              {chain.map((status, index) => {
                const isDone = currentIndex > index || termination.status === TERMINATION_STATUS.COMPLETED;
                const isCurrent = currentIndex === index && termination.status !== TERMINATION_STATUS.COMPLETED;
                const isFirst = index === 0;
                const isLast = index === chain.length - 1;

                return (
                  <div
                    key={status}
                    className={cn("flex min-w-0 flex-1 flex-col", isFirst ? "items-start" : isLast ? "items-end" : "items-center")}
                  >
                    {/* Step circle */}
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

                    {/* Label — aligned to its circle: first left, last right, rest centered */}
                    <span
                      className={cn(
                        "mt-2 w-full text-[11px] sm:text-xs leading-tight px-1 break-words",
                        isFirst ? "text-left" : isLast ? "text-right" : "text-center",
                        isCurrent ? "font-semibold text-primary" : isDone ? "font-medium text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {TERMINATION_STATUS_LABELS[status]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {isCancelled && (
            <div className="flex flex-shrink-0 flex-col items-center relative">
              <div className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 border-destructive bg-destructive text-destructive-foreground">
                <IconBan className="h-4 w-4" />
              </div>
              <span className="mt-2 text-[11px] sm:text-xs text-center font-semibold text-destructive">{TERMINATION_STATUS_LABELS[TERMINATION_STATUS.CANCELLED]}</span>
            </div>
          )}
        </div>

        {/* DISMISSAL exam (ASO demissional) linked to the medical step */}
        {showExamSection && (
          <div className="mt-4 rounded-md border border-border bg-muted/30 px-4 py-3 space-y-2">
            {/* Header row: title + status badge (inline) + "Agendar exame" (right) */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-medium">
                <IconStethoscope className="h-4 w-4 text-muted-foreground" />
                Exame Demissional (ASO)
              </p>
              {canScheduleExam ? (
                <Button size="sm" variant="outline" onClick={handleScheduleExam}>
                  <IconCalendarPlus className="mr-2 h-4 w-4" />
                  Agendar exame demissional
                </Button>
              ) : (
                <LinkedExamStatus userId={termination.userId} type={MEDICAL_EXAM_TYPE.DISMISSAL} createdAfter={termination.createdAt} variant="inline" />
              )}
            </div>
            {!canScheduleExam && (
              <LinkedExamStatus
                userId={termination.userId}
                type={MEDICAL_EXAM_TYPE.DISMISSAL}
                createdAfter={termination.createdAt}
                variant="date"
                emptyText="Nenhum exame demissional encontrado. Ele é criado automaticamente ao entrar na etapa de exame."
              />
            )}
          </div>
        )}

        {/* Guard: leaving the medical step requires a COMPLETED dismissal exam */}
        {awaitingExam && (
          <div className="mt-4 flex items-center gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <IconAlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium">Aguardando ASO demissional</p>
              <p className="text-muted-foreground">O exame demissional precisa ser concluído para avançar para o cálculo das verbas.</p>
            </div>
          </div>
        )}

        {/* Warning: UNFIT dismissal exam — possible stability rules */}
        {isExamUnfit && (
          <Alert variant="destructive" className="mt-4">
            <AlertTitle className="flex items-center gap-2">
              <IconAlertTriangle className="h-4 w-4" />
              Exame demissional com resultado Inapto
            </AlertTitle>
            <AlertDescription>Verifique possíveis regras de estabilidade antes de prosseguir com a rescisão.</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
