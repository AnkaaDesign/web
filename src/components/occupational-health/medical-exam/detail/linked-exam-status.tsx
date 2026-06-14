// linked-exam-status.tsx
// Bloco reutilizável que exibe o exame ocupacional (ASO) vinculado a um fluxo
// (admissão → ADMISSION, rescisão → DISMISSAL, afastamento → RETURN_TO_WORK):
// status/resultado + link "Ver ASO" para o detalhe do exame. Os exames são
// criados automaticamente pelo servidor ao avançar as etapas, mas o bloco
// também cobre processos antigos em que o exame ainda não existe.

import { Link } from "react-router-dom";
import { IconExternalLink, IconLoader2, IconStethoscope } from "@tabler/icons-react";

import {
  MEDICAL_EXAM_RESULT,
  MEDICAL_EXAM_RESULT_LABELS,
  MEDICAL_EXAM_STATUS,
  MEDICAL_EXAM_STATUS_LABELS,
  MEDICAL_EXAM_TYPE,
  routes,
} from "../../../../constants";
import type { MedicalExam } from "../../../../types/medical-exam";
import { formatDate } from "../../../../utils";
import { useMedicalExams } from "../../../../hooks/occupational-health/use-medical-exams";

import { Badge, getBadgeVariantFromStatus } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Busca o exame mais recente (não cancelado) do colaborador para o tipo dado.
 * `createdAfter` restringe a exames pertencentes ao processo atual (ex.: o
 * exame demissional criado desde o início da rescisão / após o início do
 * afastamento).
 */
export function useLinkedMedicalExam(userId: string | undefined, type: MEDICAL_EXAM_TYPE, createdAfter?: Date | string | null) {
  const { data, isLoading } = useMedicalExams(
    {
      where: {
        userId,
        type,
        status: { not: MEDICAL_EXAM_STATUS.CANCELLED },
        ...(createdAfter
          ? {
              OR: [{ createdAt: { gte: new Date(createdAfter) } }, { scheduledAt: { gte: new Date(createdAfter) } }],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      limit: 1,
    } as any,
    { enabled: !!userId },
  );

  return { exam: (data?.data?.[0] as MedicalExam | undefined) ?? null, isLoading };
}

interface LinkedExamStatusProps {
  userId: string | undefined;
  type: MEDICAL_EXAM_TYPE;
  /** Restringe a exames criados/agendados a partir desta data (processo atual). */
  createdAfter?: Date | string | null;
  /** Texto exibido quando nenhum exame foi encontrado. */
  emptyText?: string;
  /**
   * Modo de exibição:
   * - "full" (padrão): ícone + status/resultado + data + "Ver ASO" numa linha.
   * - "inline": apenas badges de status/resultado + "Ver ASO" (sem ícone/data),
   *   para colocar ao lado do cabeçalho da seção. Não renderiza nada quando vazio.
   * - "date": apenas a data realizado/agendado (ou o texto vazio), sem badges.
   */
  variant?: "full" | "inline" | "date";
  className?: string;
}

export function LinkedExamStatus({ userId, type, createdAfter, emptyText = "Nenhum exame encontrado.", variant = "full", className }: LinkedExamStatusProps) {
  const { exam, isLoading } = useLinkedMedicalExam(userId, type, createdAfter);

  if (isLoading) {
    // The inline header variant stays empty while loading to avoid layout shift.
    if (variant === "inline") return null;
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <IconLoader2 className="h-4 w-4 animate-spin" />
        Carregando exame...
      </div>
    );
  }

  if (!exam) {
    if (variant === "inline") return null;
    if (variant === "date") return <p className={cn("text-sm text-muted-foreground", className)}>{emptyText}</p>;
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <IconStethoscope className="h-4 w-4 flex-shrink-0" />
        {emptyText}
      </div>
    );
  }

  const relevantDate = exam.examDate ?? exam.scheduledAt;

  // Inline: status/result badges + "Ver ASO" link only (for the header row).
  if (variant === "inline") {
    return (
      <div className={cn("flex flex-wrap items-center gap-2 text-sm", className)}>
        <Badge variant={getBadgeVariantFromStatus(exam.status, "MEDICAL_EXAM")} className="text-xs whitespace-nowrap">
          {MEDICAL_EXAM_STATUS_LABELS[exam.status as MEDICAL_EXAM_STATUS] || exam.status}
        </Badge>
        {exam.result && exam.result !== MEDICAL_EXAM_RESULT.PENDING && (
          <Badge variant={getBadgeVariantFromStatus(exam.result, "MEDICAL_EXAM_RESULT")} className="text-xs whitespace-nowrap">
            {MEDICAL_EXAM_RESULT_LABELS[exam.result as MEDICAL_EXAM_RESULT] || exam.result}
          </Badge>
        )}
        <Button asChild variant="link" size="sm" className="h-auto p-0">
          <Link to={routes.occupationalHealth.medicalExams.details(exam.id)}>
            Ver ASO
            <IconExternalLink className="h-3.5 w-3.5 ml-1" />
          </Link>
        </Button>
      </div>
    );
  }

  // Date: realizado/agendado line only (badges live on the header row).
  if (variant === "date") {
    if (!relevantDate) return null;
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        {exam.examDate ? "Realizado em" : "Agendado para"} {formatDate(relevantDate)}
      </p>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2 text-sm", className)}>
      <IconStethoscope className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
      <Badge variant={getBadgeVariantFromStatus(exam.status, "MEDICAL_EXAM")} className="text-xs whitespace-nowrap">
        {MEDICAL_EXAM_STATUS_LABELS[exam.status as MEDICAL_EXAM_STATUS] || exam.status}
      </Badge>
      {exam.result && exam.result !== MEDICAL_EXAM_RESULT.PENDING && (
        <Badge variant={getBadgeVariantFromStatus(exam.result, "MEDICAL_EXAM_RESULT")} className="text-xs whitespace-nowrap">
          {MEDICAL_EXAM_RESULT_LABELS[exam.result as MEDICAL_EXAM_RESULT] || exam.result}
        </Badge>
      )}
      {relevantDate && (
        <span className="text-muted-foreground">
          {exam.examDate ? "Realizado em" : "Agendado para"} {formatDate(relevantDate)}
        </span>
      )}
      <Button asChild variant="link" size="sm" className="h-auto p-0">
        <Link to={routes.occupationalHealth.medicalExams.details(exam.id)}>
          Ver ASO
          <IconExternalLink className="h-3.5 w-3.5 ml-1" />
        </Link>
      </Button>
    </div>
  );
}
