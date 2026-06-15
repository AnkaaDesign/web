// inline-exam-panel.tsx
// Tratamento do exame ocupacional (ASO) DIRETO na página do processo (admissão
// → ADMISSION, rescisão → DISMISSAL), SEM modal e SEM sair da página. A conclusão
// usa o MESMO formulário do ASO (MedicalExamCompleteForm) renderizado INLINE —
// data (digitável ou pelo calendário), resultado, médico, CRM, clínica, validade
// e anexo. Reusa `useMedicalExamMutations` + `useLinkedMedicalExam`.

import { IconStethoscope, IconCalendarPlus, IconExternalLink } from "@tabler/icons-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Badge, getBadgeVariantFromStatus } from "@/components/ui/badge";
import { DetailRow } from "@/components/ui/detail-row";
import { cn } from "@/lib/utils";

import { MEDICAL_EXAM_RESULT, MEDICAL_EXAM_RESULT_LABELS, MEDICAL_EXAM_STATUS, MEDICAL_EXAM_STATUS_LABELS, type MEDICAL_EXAM_TYPE, routes } from "../../../constants";
import { formatDate } from "../../../utils";
import { useMedicalExamMutations } from "@/hooks/occupational-health/use-medical-exams";
import { useLinkedMedicalExam } from "@/components/occupational-health/medical-exam/detail/linked-exam-status";
import { MedicalExamCompleteForm } from "@/components/occupational-health/medical-exam/complete";

interface InlineExamPanelProps {
  userId: string;
  type: MEDICAL_EXAM_TYPE;
  /** FK do processo (admissionId/terminationId) gravado no exame ao agendar. */
  processField: "admissionId" | "terminationId";
  processId: string;
  /** Restringe a exames criados/agendados a partir desta data (processo atual). */
  createdAfter?: Date | string | null;
  title: string;
  /** Desabilita as ações (ex.: processo cancelado/concluído). */
  disabled?: boolean;
  /** Sem a moldura própria (borda/fundo) — para uso como corpo de um Card. */
  bare?: boolean;
  /** Não renderiza o título à esquerda (o Card já fornece o cabeçalho). */
  hideTitle?: boolean;
}

export function InlineExamPanel({ userId, type, processField, processId, createdAfter, title, disabled, bare, hideTitle }: InlineExamPanelProps) {
  const { exam, isLoading } = useLinkedMedicalExam(userId, type, createdAfter);
  const { createAsync, isCreating } = useMedicalExamMutations();

  const isCompleted = exam?.status === MEDICAL_EXAM_STATUS.COMPLETED;

  const handleSchedule = async () => {
    try {
      await createAsync({ userId, type: type as any, status: MEDICAL_EXAM_STATUS.SCHEDULED, [processField]: processId } as any);
    } catch {
      /* erro tratado pelo api-client */
    }
  };

  return (
    <div className={cn(bare ? "space-y-3" : "rounded-md border border-border bg-muted/30 px-4 py-3 space-y-3")}>
      {/* Cabeçalho próprio (modo "boxed"): título + status/resultado + Ver ASO.
          No modo card (hideTitle) o cabeçalho é fornecido pelo próprio Card. */}
      {!hideTitle && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-medium">
            <IconStethoscope className="h-4 w-4 text-muted-foreground" />
            {title}
          </p>
          <div className="flex items-center gap-2">
            {exam && (
              <>
                <Badge variant={getBadgeVariantFromStatus(exam.status, "MEDICAL_EXAM") as any} className="text-xs">
                  {MEDICAL_EXAM_STATUS_LABELS[exam.status as MEDICAL_EXAM_STATUS] ?? exam.status}
                </Badge>
                {isCompleted && exam.result && (
                  <Badge variant={exam.result === MEDICAL_EXAM_RESULT.UNFIT ? ("destructive" as any) : ("success" as any)} className="text-xs">
                    {MEDICAL_EXAM_RESULT_LABELS[exam.result as MEDICAL_EXAM_RESULT] ?? exam.result}
                  </Badge>
                )}
                <Link
                  to={routes.occupationalHealth.medicalExams.details(exam.id)}
                  target="_blank"
                  className="inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-700 dark:text-green-600 dark:hover:text-green-500 hover:underline"
                >
                  Ver ASO
                  <IconExternalLink className="h-4 w-4" />
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando exame…</p>
      ) : !exam ? (
        // Sem exame: agendar inline.
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">Nenhum exame agendado.</p>
          <Button size="sm" onClick={handleSchedule} disabled={disabled || isCreating}>
            <IconCalendarPlus className="mr-2 h-4 w-4" />
            Agendar exame
          </Button>
        </div>
      ) : isCompleted ? (
        // Concluído: resumo em linhas rótulo/valor (mesmo design do Colaborador).
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2">
            <DetailRow label="Data do exame" value={exam.examDate ? formatDate(new Date(exam.examDate)) : "-"} />
            <DetailRow
              label="Resultado"
              value={
                exam.result ? (
                  <Badge variant={exam.result === MEDICAL_EXAM_RESULT.UNFIT ? ("destructive" as any) : ("success" as any)} className="text-xs whitespace-nowrap">
                    {MEDICAL_EXAM_RESULT_LABELS[exam.result as MEDICAL_EXAM_RESULT] ?? exam.result}
                  </Badge>
                ) : (
                  "-"
                )
              }
            />
            <DetailRow label="Médico(a)" value={<span className="truncate">{exam.physicianName || "-"}</span>} />
            <DetailRow label="CRM" value={exam.crm || "-"} />
            <DetailRow label="Clínica" value={<span className="truncate">{exam.clinic || "-"}</span>} />
            <DetailRow label="Validade" value={exam.expiresAt ? formatDate(new Date(exam.expiresAt)) : "-"} />
          </div>
          {exam.result === MEDICAL_EXAM_RESULT.FIT_WITH_RESTRICTIONS && exam.restrictions ? (
            <DetailRow label="Restrições" value={<span className="break-words">{exam.restrictions}</span>} block />
          ) : null}
        </div>
      ) : disabled ? (
        // Processo cancelado/concluído: somente leitura.
        <p className="text-sm text-muted-foreground">Exame agendado{exam.scheduledAt ? ` para ${formatDate(new Date(exam.scheduledAt))}` : ""}.</p>
      ) : (
        // Agendado/pendente: concluir pelo MESMO formulário do ASO, inline.
        <MedicalExamCompleteForm exam={exam} />
      )}
    </div>
  );
}
