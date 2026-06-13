// return-exam-alert.tsx
// Alerta de exame de retorno obrigatório (afastamento ≥30 dias INSS/acidente).
// O servidor cria o exame RETURN_TO_WORK automaticamente ao finalizar o
// afastamento; quando o exame já existe, o alerta mostra o status dele em vez
// do botão de agendamento (que permanece para afastamentos antigos/ativos).

import { IconAlertTriangle, IconStethoscope } from "@tabler/icons-react";

import type { Leave } from "../../../../types/leave";
import { MEDICAL_EXAM_TYPE } from "../../../../constants";
import { LinkedExamStatus, useLinkedMedicalExam } from "@/components/occupational-health/medical-exam/detail/linked-exam-status";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface ReturnExamAlertProps {
  leave: Leave;
  onScheduleClick: () => void;
}

export function ReturnExamAlert({ leave, onScheduleClick }: ReturnExamAlertProps) {
  const { exam, isLoading } = useLinkedMedicalExam(leave.userId, MEDICAL_EXAM_TYPE.RETURN_TO_WORK, leave.startDate);

  return (
    <Alert variant="warning">
      <AlertTitle className="flex items-center gap-2">
        <IconAlertTriangle className="h-4 w-4" />
        Exame de retorno obrigatório (≥30 dias de afastamento)
      </AlertTitle>
      <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <span>O colaborador deve realizar exame de retorno ao trabalho antes de retomar as atividades.</span>
        {exam ? (
          <LinkedExamStatus userId={leave.userId} type={MEDICAL_EXAM_TYPE.RETURN_TO_WORK} createdAfter={leave.startDate} className="shrink-0" />
        ) : (
          <Button variant="outline" size="sm" className="shrink-0" onClick={onScheduleClick} disabled={isLoading}>
            <IconStethoscope className="h-4 w-4 mr-2" />
            Agendar exame de retorno
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
