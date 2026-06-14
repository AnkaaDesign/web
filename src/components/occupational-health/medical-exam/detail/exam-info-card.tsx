import { differenceInCalendarDays } from "date-fns";
import {
  IconUser,
  IconStethoscope,
  IconCalendarEvent,
  IconCalendarDue,
  IconCalendarPlus,
  IconCalendarRepeat,
  IconBuildingHospital,
  IconId,
  IconBriefcase,
  IconBuilding,
  IconUserCheck,
  IconProgressCheck,
  IconClipboardCheck,
  IconLicense,
  IconNotes,
  IconAlertTriangle,
} from "@tabler/icons-react";

import {
  MEDICAL_EXAM_TYPE_LABELS,
  MEDICAL_EXAM_STATUS_LABELS,
  MEDICAL_EXAM_RESULT_LABELS,
  getBadgeVariant,
} from "../../../../constants";
import type { MEDICAL_EXAM_TYPE, MEDICAL_EXAM_STATUS, MEDICAL_EXAM_RESULT } from "../../../../constants";
import { formatDate } from "../../../../utils";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DetailRow } from "@/components/ui/detail-row";
import type { MedicalExam } from "@/types/medical-exam";
import { MEDICAL_EXAM_TYPE_BADGE_VARIANTS, getExpiryClassName } from "../list/medical-exam-table-columns";

interface ExamInfoCardProps {
  exam: MedicalExam;
  className?: string;
}

/** Badge de vencimento do ASO: vencido (vermelho) / a vencer (âmbar) / em dia. */
function ExpiryBadge({ expiresAt }: { expiresAt: Date | string | null }) {
  if (!expiresAt) return null;
  const daysLeft = differenceInCalendarDays(new Date(expiresAt), new Date());
  if (daysLeft < 0) {
    return (
      <Badge variant="destructive" className="font-normal whitespace-nowrap">
        <IconAlertTriangle className="h-3 w-3 mr-1" />
        Vencido há {Math.abs(daysLeft)} {Math.abs(daysLeft) === 1 ? "dia" : "dias"}
      </Badge>
    );
  }
  if (daysLeft <= 30) {
    return (
      <Badge variant="amber" className="font-normal whitespace-nowrap">
        Vence em {daysLeft} {daysLeft === 1 ? "dia" : "dias"}
      </Badge>
    );
  }
  return null;
}

export function ExamInfoCard({ exam, className }: ExamInfoCardProps) {
  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-2">
          <IconStethoscope className="h-5 w-5 text-muted-foreground" />
          Informações do Exame
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-6">
          {/* Colaborador */}
          <div>
            <h3 className="text-base font-semibold mb-4 text-foreground">Colaborador</h3>
            <div className="space-y-2">
              <DetailRow icon={IconUser} label="Nome" value={exam.user?.name || "-"} />
              <DetailRow icon={IconBriefcase} label="Cargo" value={exam.user?.position?.name || "-"} />
              <DetailRow icon={IconBuilding} label="Setor" value={exam.user?.sector?.name || "-"} />
            </div>
          </div>

          {/* Exame */}
          <div className="pt-6 border-t border-border">
            <h3 className="text-base font-semibold mb-4 text-foreground">Exame</h3>
            <div className="space-y-2">
              <DetailRow
                icon={IconId}
                label="Tipo"
                value={
                  <Badge variant={MEDICAL_EXAM_TYPE_BADGE_VARIANTS[exam.type] || "default"} className="font-normal">
                    {MEDICAL_EXAM_TYPE_LABELS[exam.type as MEDICAL_EXAM_TYPE] || exam.type}
                  </Badge>
                }
              />
              <DetailRow
                icon={IconProgressCheck}
                label="Status"
                value={
                  <Badge variant={getBadgeVariant(exam.status, "MEDICAL_EXAM")} className="font-normal">
                    {MEDICAL_EXAM_STATUS_LABELS[exam.status as MEDICAL_EXAM_STATUS] || exam.status}
                  </Badge>
                }
              />
              <DetailRow
                icon={IconClipboardCheck}
                label="Resultado"
                value={
                  <Badge variant={getBadgeVariant(exam.result, "MEDICAL_EXAM_RESULT")} className="font-normal">
                    {MEDICAL_EXAM_RESULT_LABELS[exam.result as MEDICAL_EXAM_RESULT] || exam.result}
                  </Badge>
                }
              />
              {exam.periodicityMonths != null && (
                <DetailRow
                  icon={IconCalendarRepeat}
                  label="Periodicidade"
                  value={`${exam.periodicityMonths} ${exam.periodicityMonths === 1 ? "mês" : "meses"}`}
                />
              )}
            </div>
            {/* Restrições (apto com restrições) */}
            {exam.restrictions && (
              <div className="mt-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg px-4 py-3">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-1.5">
                  <IconAlertTriangle className="h-3.5 w-3.5" />
                  Restrições
                </p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{exam.restrictions}</p>
              </div>
            )}
          </div>

          {/* Datas */}
          <div className="pt-6 border-t border-border">
            <h3 className="text-base font-semibold mb-4 text-foreground">Datas</h3>
            <div className="space-y-2">
              <DetailRow icon={IconCalendarPlus} label="Agendado para" value={exam.scheduledAt ? formatDate(new Date(exam.scheduledAt)) : "-"} />
              <DetailRow icon={IconCalendarEvent} label="Data do exame" value={exam.examDate ? formatDate(new Date(exam.examDate)) : "-"} />
              <DetailRow
                icon={IconCalendarDue}
                label="Validade"
                value={
                  <div className="flex items-center justify-end gap-2 flex-wrap">
                    <span className={getExpiryClassName(exam.expiresAt)}>{exam.expiresAt ? formatDate(new Date(exam.expiresAt)) : "-"}</span>
                    <ExpiryBadge expiresAt={exam.expiresAt} />
                  </div>
                }
              />
            </div>
          </div>

          {/* Clínica / Médico */}
          <div className="pt-6 border-t border-border">
            <h3 className="text-base font-semibold mb-4 text-foreground">Clínica e Médico</h3>
            <div className="space-y-2">
              <DetailRow icon={IconBuildingHospital} label="Clínica" value={exam.clinic || "-"} />
              <DetailRow icon={IconUserCheck} label="Médico" value={exam.physicianName || "-"} />
              <DetailRow icon={IconLicense} label="CRM" value={exam.crm || "-"} />
            </div>
          </div>

          {/* Observações */}
          {exam.notes && (
            <div className="pt-6 border-t border-border">
              <h3 className="text-base font-semibold mb-4 text-foreground flex items-center gap-2">
                <IconNotes className="h-4 w-4 text-muted-foreground" />
                Observações
              </h3>
              <div className="bg-muted/50 rounded-lg px-4 py-3">
                <p className="text-sm text-foreground whitespace-pre-wrap">{exam.notes}</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
