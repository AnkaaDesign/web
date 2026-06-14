import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconProgressCheck, IconCheck, IconBan, IconAlertTriangle, IconStethoscope } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { ADMISSION_STATUS, ADMISSION_STATUS_LABELS, MEDICAL_EXAM_RESULT, MEDICAL_EXAM_STATUS, MEDICAL_EXAM_TYPE } from "../../../../constants";
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
          <div className="flex items-start">
            {STEPPER_STEPS.map((step, index) => {
              const isDone = index < stepperIndex || admission.status === ADMISSION_STATUS.COMPLETED;
              const isCurrent = index === stepperIndex && admission.status !== ADMISSION_STATUS.COMPLETED;
              const isFirst = index === 0;
              const isLast = index === STEPPER_STEPS.length - 1;
              // A connector segment is "filled" once the step it leads INTO has
              // been reached/completed (green up to the current step).
              const leftFilled = index <= stepperIndex || admission.status === ADMISSION_STATUS.COMPLETED;
              const rightFilled = index < stepperIndex || admission.status === ADMISSION_STATUS.COMPLETED;

              return (
                // Equal-width columns keep circles evenly spaced and labels
                // centered under their circle regardless of label length.
                <div key={step.key} className="flex min-w-0 flex-1 flex-col items-center">
                  {/* Circle + connector row: half-width connectors on each side
                      meet at the vertical center of the circle. */}
                  <div className="flex w-full items-center">
                    <div className={cn("h-0.5 flex-1", isFirst ? "bg-transparent" : leftFilled ? "bg-primary" : "bg-border")} />
                    <div
                      className={cn(
                        "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                        isDone && "border-primary bg-primary text-primary-foreground",
                        isCurrent && "border-primary bg-background text-primary",
                        !isDone && !isCurrent && "border-border bg-muted/30 text-muted-foreground",
                      )}
                    >
                      {isDone ? <IconCheck className="h-4 w-4" /> : index + 1}
                    </div>
                    <div className={cn("h-0.5 flex-1", isLast ? "bg-transparent" : rightFilled ? "bg-primary" : "bg-border")} />
                  </div>
                  <span
                    className={cn(
                      "mt-2 w-full px-1 text-center text-xs leading-tight break-words",
                      isCurrent ? "font-semibold text-foreground" : isDone ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* ADMISSION exam (ASO) linked to the medical step */}
        {showExamSection && (
          <div className="rounded-md border border-border bg-muted/30 px-4 py-3 space-y-2">
            <p className="flex items-center gap-2 text-sm font-medium">
              <IconStethoscope className="h-4 w-4 text-muted-foreground" />
              Exame Admissional (ASO)
            </p>
            <LinkedExamStatus
              userId={admission.userId}
              type={MEDICAL_EXAM_TYPE.ADMISSION}
              emptyText="Nenhum exame admissional encontrado. Ele é criado automaticamente ao entrar na etapa de exame."
            />
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
