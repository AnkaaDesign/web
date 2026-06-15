import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconProgressCheck, IconCheck, IconBan, IconAlertTriangle, IconStethoscope, IconCalendarPlus } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { ADMISSION_STATUS, ADMISSION_STATUS_LABELS, MEDICAL_EXAM_RESULT, MEDICAL_EXAM_STATUS, MEDICAL_EXAM_TYPE, routes } from "../../../../constants";
import { Badge, getBadgeVariantFromStatus } from "@/components/ui/badge";
import type { Admission } from "../../../../types/admission";
import { ADMISSION_STATUS_CHAIN, hasBlockingRequiredDocs } from "../utils";
import { LinkedExamStatus, useLinkedMedicalExam } from "@/components/occupational-health/medical-exam/detail/linked-exam-status";

interface StatusCardProps {
  admission: Admission;
  className?: string;
}

// Stepper steps per the spec ("Cadastro de colaborador → Documentação →
// Contrato → Registro"): the leading "Cadastro de Colaborador" step is ALWAYS
// done (the collaborator is created together with the admission), followed by
// the status chain with UI-only labels. The enum/labels used by badges and
// lists stay untouched (ADMISSION_STATUS_LABELS).
const STEPPER_STEPS: { key: string; label: string }[] = [
  { key: "USER_REGISTRATION", label: "Cadastro de Colaborador" },
  { key: ADMISSION_STATUS.DOCS_PENDING, label: "Documentação" },
  { key: ADMISSION_STATUS.MEDICAL_EXAM, label: "Exame Admissional" },
  { key: ADMISSION_STATUS.CONTRACT, label: "Contrato" },
  { key: ADMISSION_STATUS.REGISTRATION, label: "Registro" },
  { key: ADMISSION_STATUS.COMPLETED, label: "Concluída" },
];

export function StatusCard({ admission, className }: StatusCardProps) {
  const navigate = useNavigate();
  const isCancelled = admission.status === ADMISSION_STATUS.CANCELLED;
  const currentIndex = ADMISSION_STATUS_CHAIN.indexOf(admission.status);
  // Index within STEPPER_STEPS (offset by the always-done registration step)
  const stepperIndex = currentIndex + 1;
  const medicalExamIndex = ADMISSION_STATUS_CHAIN.indexOf(ADMISSION_STATUS.MEDICAL_EXAM);
  const blockedByDocs = hasBlockingRequiredDocs(admission);

  // ADMISSION exam linked to this collaborator (auto-created by the server
  // when the process enters the medical-exam step).
  const { exam: admissionExam, isLoading: isExamLoading } = useLinkedMedicalExam(admission.userId, MEDICAL_EXAM_TYPE.ADMISSION);
  const reachedMedicalStep = !isCancelled && currentIndex >= medicalExamIndex;
  const showExamSection = reachedMedicalStep || !!admissionExam;
  const isExamFitAndCompleted = admissionExam?.status === MEDICAL_EXAM_STATUS.COMPLETED && admissionExam?.result === MEDICAL_EXAM_RESULT.FIT;
  const awaitingExam = admission.status === ADMISSION_STATUS.MEDICAL_EXAM && !isExamLoading && !isExamFitAndCompleted;
  // Offer scheduling when the process is at/past the medical step and no
  // ADMISSION exam exists yet (covers older processes without auto-creation).
  const canScheduleExam = showExamSection && !isExamLoading && !admissionExam && !isCancelled;

  // Navigate to the ASO CREATE form, pre-filled and locked. The exam is created
  // ONLY when the form is submitted — backing out leaves no orphan "Agendado".
  const handleScheduleExam = () => {
    const params = new URLSearchParams({
      userId: admission.userId,
      type: MEDICAL_EXAM_TYPE.ADMISSION,
      admissionId: admission.id,
    });
    navigate(`${routes.occupationalHealth.medicalExams.create}?${params.toString()}`);
  };

  return (
    <Card className={cn("shadow-sm border border-border", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <IconProgressCheck className="h-5 w-5 text-muted-foreground" />
            Andamento da Admissão
          </div>
          <Badge variant={getBadgeVariantFromStatus(admission.status, "ADMISSION")} className="text-xs whitespace-nowrap">
            {ADMISSION_STATUS_LABELS[admission.status as ADMISSION_STATUS] || admission.status}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isCancelled ? (
          <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3">
            <IconBan className="h-5 w-5 text-destructive flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-destructive">Admissão cancelada</p>
              <p className="text-muted-foreground">Este processo foi cancelado e não pode mais ser avançado.</p>
            </div>
          </div>
        ) : (
          /* Full-width stepper: the dots row spans edge to edge (first dot flush
             left, last dot flush right) with a continuous connector track behind
             them; labels sit centered under their dot. */
          <div className="relative">
            {/* Connector track: a base line spanning the dot centers (h-4 = top of
                an h-8 circle) inset by half a circle on each side, plus a filled
                overlay up to the current step. */}
            {STEPPER_STEPS.length > 1 && (
              <>
                <div className="absolute top-4 left-4 right-4 h-0.5 -translate-y-1/2 bg-border" />
                <div
                  className="absolute top-4 left-4 h-0.5 -translate-y-1/2 bg-primary transition-all"
                  style={{
                    width: `calc((100% - 2rem) * ${
                      admission.status === ADMISSION_STATUS.COMPLETED ? 1 : Math.min(stepperIndex, STEPPER_STEPS.length - 1) / (STEPPER_STEPS.length - 1)
                    })`,
                  }}
                />
              </>
            )}
            <div className="relative flex items-start justify-between">
              {STEPPER_STEPS.map((step, index) => {
                const isDone = index < stepperIndex || admission.status === ADMISSION_STATUS.COMPLETED;
                const isCurrent = index === stepperIndex && admission.status !== ADMISSION_STATUS.COMPLETED;

                return (
                  <div key={step.key} className="flex min-w-0 flex-1 flex-col items-center first:items-start last:items-end">
                    <div
                      className={cn(
                        "z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                        isDone && "border-primary bg-primary text-primary-foreground",
                        isCurrent && "border-primary bg-background text-primary",
                        !isDone && !isCurrent && "border-border bg-muted/30 text-muted-foreground",
                      )}
                    >
                      {isDone ? <IconCheck className="h-4 w-4" /> : index + 1}
                    </div>
                    <span
                      className={cn(
                        // Index-based alignment: first label flush-left under the
                        // first dot, last flush-right under the last, rest centered.
                        // (first:/last: on the span match its sibling slot — the
                        // circle/span pair — not the column, so they don't work here.)
                        "mt-2 w-full px-1 text-xs leading-tight break-words",
                        index === 0 ? "text-left" : index === STEPPER_STEPS.length - 1 ? "text-right" : "text-center",
                        isCurrent ? "font-semibold text-foreground" : isDone ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ADMISSION exam (ASO) linked to the medical step */}
        {showExamSection && (
          <div className="rounded-md border border-border bg-muted/30 px-4 py-3 space-y-2">
            {/* Header row: title + status badge (inline) + "Agendar exame" (right) */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-medium">
                <IconStethoscope className="h-4 w-4 text-muted-foreground" />
                Exame Admissional (ASO)
              </p>
              {canScheduleExam ? (
                <Button size="sm" variant="outline" onClick={handleScheduleExam}>
                  <IconCalendarPlus className="mr-2 h-4 w-4" />
                  Agendar exame admissional
                </Button>
              ) : (
                <LinkedExamStatus userId={admission.userId} type={MEDICAL_EXAM_TYPE.ADMISSION} variant="inline" />
              )}
            </div>
            {!canScheduleExam && (
              <LinkedExamStatus
                userId={admission.userId}
                type={MEDICAL_EXAM_TYPE.ADMISSION}
                variant="date"
                emptyText="Nenhum exame admissional encontrado. Ele é criado automaticamente ao entrar na etapa de exame."
              />
            )}
          </div>
        )}

        {/* Guard: leaving the medical step requires a COMPLETED + FIT exam */}
        {awaitingExam && (
          <div className="flex items-center gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <IconAlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium">Aguardando ASO admissional</p>
              <p className="text-muted-foreground">O exame admissional precisa ser concluído com resultado Apto para avançar para o contrato.</p>
            </div>
          </div>
        )}

        {/* Guard explanation (mirrors the server rule) */}
        {blockedByDocs && (
          <div className="flex items-center gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <IconAlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium">Existem documentos obrigatórios pendentes</p>
              <p className="text-muted-foreground">Receba, assine ou dispense os documentos obrigatórios para avançar a etapa.</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
