import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconProgressCheck, IconAlertTriangle } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { ADMISSION_STATUS, ADMISSION_STATUS_LABELS, MEDICAL_EXAM_RESULT, MEDICAL_EXAM_STATUS, MEDICAL_EXAM_TYPE } from "../../../../constants";
import { Badge, getBadgeVariantFromStatus } from "@/components/ui/badge";
import type { Admission } from "../../../../types/admission";
import { ADMISSION_STATUS_CHAIN, hasBlockingRequiredDocs } from "../utils";
import { WorkflowStepper, type WorkflowStep } from "../../shared/workflow-stepper";
import { useLinkedMedicalExam } from "@/components/occupational-health/medical-exam/detail/linked-exam-status";

interface StatusCardProps {
  admission: Admission;
  className?: string;
}

// Stepper steps: the leading "Cadastro de Colaborador" step is ALWAYS done (the
// collaborator is created together with the admission), followed by the status
// chain with UI-only labels. The enum/labels used by badges/lists stay untouched.
const STEPPER_STEPS: WorkflowStep[] = [
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
  // Index within STEPPER_STEPS (offset by the always-done registration step).
  const stepperIndex = currentIndex + 1;
  const isCompleted = admission.status === ADMISSION_STATUS.COMPLETED;
  const blockedByDocs = hasBlockingRequiredDocs(admission);

  // The step the process stopped on when cancelled (offset by registration).
  const cancelledFromIndex = admission.cancelledFromStatus ? ADMISSION_STATUS_CHAIN.indexOf(admission.cancelledFromStatus) + 1 : 1;

  // ADMISSION exam linked to this collaborator — used only for the advance-guard
  // warning here (the exam itself is handled in the dedicated Exame card).
  const { exam: admissionExam, isLoading: isExamLoading } = useLinkedMedicalExam(admission.userId, MEDICAL_EXAM_TYPE.ADMISSION);
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
        <WorkflowStepper
          steps={STEPPER_STEPS}
          currentIndex={stepperIndex}
          isCompleted={isCompleted}
          cancelled={isCancelled ? { atIndex: cancelledFromIndex, reason: admission.cancellationReason } : null}
        />

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
