import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { IconStethoscope, IconAlertTriangle } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { MEDICAL_EXAM_RESULT, MEDICAL_EXAM_STATUS, MEDICAL_EXAM_TYPE, TERMINATION_STATUS } from "../../../../constants";
import type { Termination } from "../../../../types/termination";
import { useLinkedMedicalExam } from "@/components/occupational-health/medical-exam/detail/linked-exam-status";
import { InlineExamPanel } from "../../shared/inline-exam-panel";
import { getTerminationStatusChain, TERMINATION_STATUS_CHAIN } from "./status-stepper-card";

interface ExamCardProps {
  termination: Termination;
  className?: string;
}

/**
 * Half-width card for the DISMISSAL exam (ASO demissional). Previously this
 * panel was rendered full-bleed inside the status-stepper card; pulling it into
 * its own Card lets it sit in a balanced grid next to the Summary/Documents.
 * Returns null when the process hasn't reached (and has no) dismissal exam.
 */
export function ExamCard({ termination, className }: ExamCardProps) {
  const isCancelled = termination.status === TERMINATION_STATUS.CANCELLED;
  const isCompleted = termination.status === TERMINATION_STATUS.COMPLETED;
  const chain = getTerminationStatusChain(termination);
  const fullIndex = TERMINATION_STATUS_CHAIN.indexOf(termination.status);
  const hasMedicalStep = chain.includes(TERMINATION_STATUS.MEDICAL_EXAM);

  const { exam: dismissalExam, isLoading: isExamLoading } = useLinkedMedicalExam(termination.userId, MEDICAL_EXAM_TYPE.DISMISSAL, termination.createdAt);
  const reachedMedicalStep = hasMedicalStep && !isCancelled && fullIndex >= TERMINATION_STATUS_CHAIN.indexOf(TERMINATION_STATUS.MEDICAL_EXAM);
  const showExamSection = reachedMedicalStep || !!dismissalExam;
  if (!showExamSection) return null;

  const isExamCompleted = dismissalExam?.status === MEDICAL_EXAM_STATUS.COMPLETED;
  const awaitingExam = termination.status === TERMINATION_STATUS.MEDICAL_EXAM && !isExamLoading && !isExamCompleted;
  const isExamUnfit = isExamCompleted && dismissalExam?.result === MEDICAL_EXAM_RESULT.UNFIT;

  return (
    <Card className={cn("shadow-sm border border-border", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <IconStethoscope className="h-5 w-5 text-muted-foreground" />
          Exame Demissional (ASO)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <InlineExamPanel
          userId={termination.userId}
          type={MEDICAL_EXAM_TYPE.DISMISSAL}
          processField="terminationId"
          processId={termination.id}
          createdAfter={termination.createdAt}
          title="Exame Demissional (ASO)"
          disabled={isCancelled || isCompleted}
          bare
          hideTitle
        />

        {/* Guard: leaving the medical step requires a COMPLETED dismissal exam */}
        {awaitingExam && (
          <div className="flex items-center gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <IconAlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium">Aguardando ASO demissional</p>
              <p className="text-muted-foreground">O exame demissional precisa ser concluído para avançar para o cálculo das verbas.</p>
            </div>
          </div>
        )}

        {/* Warning: UNFIT dismissal exam — possible stability rules */}
        {isExamUnfit && (
          <Alert variant="destructive">
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
