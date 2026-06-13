import {
  IconUser,
  IconStethoscope,
  IconCalendarEvent,
  IconCalendarDue,
  IconCalendarPlus,
  IconBuildingHospital,
  IconId,
  IconBriefcase,
  IconBuilding,
  IconUserCheck,
  IconProgressCheck,
  IconClipboardCheck,
  IconLicense,
  IconNotes,
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
import type { MedicalExam } from "@/types/medical-exam";
import { MEDICAL_EXAM_TYPE_BADGE_VARIANTS, getExpiryClassName } from "../list/medical-exam-table-columns";

interface ExamInfoCardProps {
  exam: MedicalExam;
  className?: string;
}

function InfoRow({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center gap-4 bg-muted/50 rounded-lg px-4 py-3">
      <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <div className="text-sm font-semibold text-foreground text-right">{children}</div>
    </div>
  );
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
            <div className="space-y-4">
              <InfoRow icon={IconUser} label="Nome">
                {exam.user?.name || "-"}
              </InfoRow>
              <InfoRow icon={IconBriefcase} label="Cargo">
                {exam.user?.position?.name || "-"}
              </InfoRow>
              <InfoRow icon={IconBuilding} label="Setor">
                {exam.user?.sector?.name || "-"}
              </InfoRow>
            </div>
          </div>

          {/* Exame */}
          <div className="pt-6 border-t border-border">
            <h3 className="text-base font-semibold mb-4 text-foreground">Exame</h3>
            <div className="space-y-4">
              <InfoRow icon={IconId} label="Tipo">
                <Badge variant={MEDICAL_EXAM_TYPE_BADGE_VARIANTS[exam.type] || "default"} className="font-normal">
                  {MEDICAL_EXAM_TYPE_LABELS[exam.type as MEDICAL_EXAM_TYPE] || exam.type}
                </Badge>
              </InfoRow>
              <InfoRow icon={IconProgressCheck} label="Status">
                <Badge variant={getBadgeVariant(exam.status, "MEDICAL_EXAM")} className="font-normal">
                  {MEDICAL_EXAM_STATUS_LABELS[exam.status as MEDICAL_EXAM_STATUS] || exam.status}
                </Badge>
              </InfoRow>
              <InfoRow icon={IconClipboardCheck} label="Resultado">
                <Badge variant={getBadgeVariant(exam.result, "MEDICAL_EXAM_RESULT")} className="font-normal">
                  {MEDICAL_EXAM_RESULT_LABELS[exam.result as MEDICAL_EXAM_RESULT] || exam.result}
                </Badge>
              </InfoRow>
            </div>
          </div>

          {/* Datas */}
          <div className="pt-6 border-t border-border">
            <h3 className="text-base font-semibold mb-4 text-foreground">Datas</h3>
            <div className="space-y-4">
              <InfoRow icon={IconCalendarPlus} label="Agendado para">
                {exam.scheduledAt ? formatDate(new Date(exam.scheduledAt)) : "-"}
              </InfoRow>
              <InfoRow icon={IconCalendarEvent} label="Data do exame">
                {exam.examDate ? formatDate(new Date(exam.examDate)) : "-"}
              </InfoRow>
              <InfoRow icon={IconCalendarDue} label="Validade">
                <span className={getExpiryClassName(exam.expiresAt)}>{exam.expiresAt ? formatDate(new Date(exam.expiresAt)) : "-"}</span>
              </InfoRow>
            </div>
          </div>

          {/* Clínica / Médico */}
          <div className="pt-6 border-t border-border">
            <h3 className="text-base font-semibold mb-4 text-foreground">Clínica e Médico</h3>
            <div className="space-y-4">
              <InfoRow icon={IconBuildingHospital} label="Clínica">
                {exam.clinic || "-"}
              </InfoRow>
              <InfoRow icon={IconUserCheck} label="Médico">
                {exam.physicianName || "-"}
              </InfoRow>
              <InfoRow icon={IconLicense} label="CRM">
                {exam.crm || "-"}
              </InfoRow>
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
