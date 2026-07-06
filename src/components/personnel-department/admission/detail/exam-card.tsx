import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, getBadgeVariantFromStatus } from "@/components/ui/badge";
import { IconStethoscope, IconExternalLink } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { ADMISSION_STATUS, MEDICAL_EXAM_STATUS, MEDICAL_EXAM_STATUS_LABELS, MEDICAL_EXAM_TYPE, routes } from "../../../../constants";
import type { Admission } from "../../../../types/admission";
import { InlineExamPanel } from "../../shared/inline-exam-panel";
import { useLinkedMedicalExam } from "@/components/occupational-health/medical-exam/detail/linked-exam-status";

interface ExamCardProps {
  admission: Admission;
  className?: string;
}

/**
 * Cartão (1/2 da largura, mesmo estilo do Colaborador/Checklist) que trata o
 * Exame Admissional (ASO) inline — agendar e concluir sem sair da página. O
 * status (quando agendado) fica no cabeçalho; o próprio título é um link que
 * abre o ASO (quando já existe um exame vinculado).
 */
export function ExamCard({ admission, className }: ExamCardProps) {
  const isCancelled = admission.status === ADMISSION_STATUS.CANCELLED;
  const isCompleted = admission.status === ADMISSION_STATUS.COMPLETED;
  const { exam } = useLinkedMedicalExam(admission.userId, MEDICAL_EXAM_TYPE.ADMISSION);
  const examCompleted = exam?.status === MEDICAL_EXAM_STATUS.COMPLETED;

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between gap-2">
          {/* Título clicável quando há ASO — abre o exame (substitui o antigo link "Ver ASO"). */}
          {exam ? (
            <Link
              to={routes.occupationalHealth.medicalExams.details(exam.id)}
              target="_blank"
              className="group flex min-w-0 items-center gap-2 transition-colors hover:text-green-600 dark:hover:text-green-500"
              title="Abrir ASO"
            >
              <IconStethoscope className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-green-600 dark:group-hover:text-green-500" />
              <span className="truncate">Exame Admissional (ASO)</span>
              <IconExternalLink className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-green-600 dark:group-hover:text-green-500" />
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <IconStethoscope className="h-5 w-5 text-muted-foreground" />
              Exame Admissional (ASO)
            </div>
          )}
          {/* Status só quando NÃO concluído (Agendado). Concluído mostra os dados no corpo. */}
          {exam && !examCompleted && (
            <Badge variant={getBadgeVariantFromStatus(exam.status, "MEDICAL_EXAM")} className="text-xs">
              {MEDICAL_EXAM_STATUS_LABELS[exam.status as MEDICAL_EXAM_STATUS] ?? exam.status}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        <InlineExamPanel
          userId={admission.userId}
          type={MEDICAL_EXAM_TYPE.ADMISSION}
          processField="admissionId"
          processId={admission.id}
          title="Exame Admissional (ASO)"
          bare
          hideTitle
          disabled={isCancelled || isCompleted}
        />
      </CardContent>
    </Card>
  );
}
