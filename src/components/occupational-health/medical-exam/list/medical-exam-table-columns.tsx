import { differenceInCalendarDays } from "date-fns";

import { formatDate } from "../../../../utils";
import {
  MEDICAL_EXAM_TYPE_LABELS,
  MEDICAL_EXAM_STATUS_LABELS,
  MEDICAL_EXAM_RESULT_LABELS,
  getBadgeVariant,
} from "../../../../constants";
import type { MEDICAL_EXAM_TYPE, MEDICAL_EXAM_STATUS, MEDICAL_EXAM_RESULT } from "../../../../constants";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MedicalExam } from "@/types/medical-exam";
import type { MedicalExamColumn } from "./types";

// Type badges (no entity config in badge-colors for type — local mapping)
export const MEDICAL_EXAM_TYPE_BADGE_VARIANTS: Record<string, BadgeProps["variant"]> = {
  ADMISSION: "blue",
  PERIODIC: "teal",
  RETURN_TO_WORK: "indigo",
  RISK_CHANGE: "orange",
  DISMISSAL: "purple",
};

// Expiry highlight: red when past, amber when within 30 days
export function getExpiryClassName(expiresAt: Date | string | null | undefined): string {
  if (!expiresAt) return "";
  const daysLeft = differenceInCalendarDays(new Date(expiresAt), new Date());
  if (daysLeft < 0) return "text-destructive font-semibold";
  if (daysLeft <= 30) return "text-amber-600 dark:text-amber-500 font-semibold";
  return "";
}

export const createMedicalExamColumns = (): MedicalExamColumn[] => [
  // Colaborador
  {
    key: "user.name",
    header: "COLABORADOR",
    accessor: (exam: MedicalExam) => (
      <div className="truncate">
        <p className="font-medium truncate" title={exam.user?.name}>
          {exam.user?.name || <span className="text-muted-foreground">-</span>}
        </p>
        {exam.user?.position?.name && <p className="text-xs text-muted-foreground truncate">{exam.user.position.name}</p>}
      </div>
    ),
    sortable: false,
    className: "min-w-[220px]",
    align: "left",
  },

  // Tipo
  {
    key: "type",
    header: "TIPO",
    accessor: (exam: MedicalExam) => (
      <Badge variant={MEDICAL_EXAM_TYPE_BADGE_VARIANTS[exam.type] || "default"} className="text-xs whitespace-nowrap">
        {MEDICAL_EXAM_TYPE_LABELS[exam.type as MEDICAL_EXAM_TYPE] || exam.type}
      </Badge>
    ),
    sortable: true,
    className: "min-w-[140px]",
    align: "left",
  },

  // Status
  {
    key: "status",
    header: "STATUS",
    accessor: (exam: MedicalExam) => (
      <Badge variant={getBadgeVariant(exam.status, "MEDICAL_EXAM")} className="text-xs whitespace-nowrap">
        {MEDICAL_EXAM_STATUS_LABELS[exam.status as MEDICAL_EXAM_STATUS] || exam.status}
      </Badge>
    ),
    sortable: true,
    className: "min-w-[120px]",
    align: "left",
  },

  // Resultado
  {
    key: "result",
    header: "RESULTADO",
    accessor: (exam: MedicalExam) => (
      <Badge variant={getBadgeVariant(exam.result, "MEDICAL_EXAM_RESULT")} className="text-xs whitespace-nowrap">
        {MEDICAL_EXAM_RESULT_LABELS[exam.result as MEDICAL_EXAM_RESULT] || exam.result}
      </Badge>
    ),
    sortable: true,
    className: "min-w-[120px]",
    align: "left",
  },

  // Agendado para
  {
    key: "scheduledAt",
    header: "AGENDADO PARA",
    accessor: (exam: MedicalExam) => (
      <div className="text-sm truncate">{exam.scheduledAt ? formatDate(new Date(exam.scheduledAt)) : <span className="text-muted-foreground">-</span>}</div>
    ),
    sortable: true,
    className: "min-w-[140px]",
    align: "left",
  },

  // Data do exame
  {
    key: "examDate",
    header: "DATA DO EXAME",
    accessor: (exam: MedicalExam) => (
      <div className="text-sm truncate">{exam.examDate ? formatDate(new Date(exam.examDate)) : <span className="text-muted-foreground">-</span>}</div>
    ),
    sortable: true,
    className: "min-w-[140px]",
    align: "left",
  },

  // Validade
  {
    key: "expiresAt",
    header: "VALIDADE",
    accessor: (exam: MedicalExam) => (
      <div className={cn("text-sm truncate", getExpiryClassName(exam.expiresAt))}>
        {exam.expiresAt ? formatDate(new Date(exam.expiresAt)) : <span className="text-muted-foreground">-</span>}
      </div>
    ),
    sortable: true,
    className: "min-w-[130px]",
    align: "left",
  },

  // Clínica
  {
    key: "clinic",
    header: "CLÍNICA",
    accessor: (exam: MedicalExam) => (
      <div className="text-sm truncate" title={exam.clinic ?? undefined}>
        {exam.clinic || <span className="text-muted-foreground">-</span>}
      </div>
    ),
    sortable: true,
    className: "min-w-[160px]",
    align: "left",
  },

  // Médico
  {
    key: "physicianName",
    header: "MÉDICO",
    accessor: (exam: MedicalExam) => (
      <div className="text-sm truncate" title={exam.physicianName ?? undefined}>
        {exam.physicianName || <span className="text-muted-foreground">-</span>}
      </div>
    ),
    sortable: true,
    className: "min-w-[160px]",
    align: "left",
  },

  // CRM
  {
    key: "crm",
    header: "CRM",
    accessor: (exam: MedicalExam) => <div className="text-sm truncate">{exam.crm || <span className="text-muted-foreground">-</span>}</div>,
    sortable: false,
    className: "min-w-[110px]",
    align: "left",
  },

  // Criado em
  {
    key: "createdAt",
    header: "CRIADO EM",
    accessor: (exam: MedicalExam) => (
      <div className="text-sm truncate">{exam.createdAt ? formatDate(new Date(exam.createdAt)) : <span className="text-muted-foreground">-</span>}</div>
    ),
    sortable: true,
    className: "min-w-[130px]",
    align: "left",
  },
];

// Default visible columns
export const DEFAULT_VISIBLE_COLUMNS = new Set(["user.name", "type", "status", "result", "examDate", "expiresAt", "clinic"]);
