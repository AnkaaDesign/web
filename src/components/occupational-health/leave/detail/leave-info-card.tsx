import {
  IconInfoCircle,
  IconId,
  IconProgressCheck,
  IconStethoscope,
  IconCalendarEvent,
  IconCalendarDue,
  IconCalendarCheck,
  IconCalendarPlus,
  IconCalendarTime,
  IconFileDescription,
  IconHash,
  IconNotes,
} from "@tabler/icons-react";

import type { Leave } from "../../../../types/leave";
import { LEAVE_TYPE, LEAVE_STATUS, LEAVE_TYPE_LABELS, LEAVE_STATUS_LABELS } from "../../../../constants";
import { formatDate, formatDateTime } from "../../../../utils";
import { cn } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, getBadgeVariantFromStatus } from "@/components/ui/badge";

interface LeaveInfoCardProps {
  leave: Leave;
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

export function LeaveInfoCard({ leave, className }: LeaveInfoCardProps) {
  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-2">
          <IconInfoCircle className="h-5 w-5 text-muted-foreground" />
          Informações do Afastamento
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-base font-semibold mb-4 text-foreground">Informações Básicas</h3>
            <div className="space-y-4">
              <InfoRow icon={IconId} label="Tipo">
                <Badge variant="secondary" className="font-normal">
                  {LEAVE_TYPE_LABELS[leave.type as LEAVE_TYPE] || leave.type}
                </Badge>
              </InfoRow>
              <InfoRow icon={IconProgressCheck} label="Status">
                <Badge variant={getBadgeVariantFromStatus(leave.status, "LEAVE")} className="font-normal">
                  {LEAVE_STATUS_LABELS[leave.status as LEAVE_STATUS] || leave.status}
                </Badge>
              </InfoRow>
              <InfoRow icon={IconStethoscope} label="Exame de Retorno">
                {leave.returnExamRequired ? (
                  <Badge variant="amber" className="font-normal">
                    Obrigatório
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="font-normal">
                    Não obrigatório
                  </Badge>
                )}
              </InfoRow>
            </div>
          </div>

          {/* Dates */}
          <div className="pt-6 border-t border-border">
            <h3 className="text-base font-semibold mb-4 text-foreground">Datas</h3>
            <div className="space-y-4">
              <InfoRow icon={IconCalendarEvent} label="Início">
                {formatDate(leave.startDate)}
              </InfoRow>
              <InfoRow icon={IconCalendarDue} label="Término Previsto">
                {leave.expectedEndDate ? formatDate(leave.expectedEndDate) : "-"}
              </InfoRow>
              <InfoRow icon={IconCalendarCheck} label="Retorno Efetivo">
                {leave.actualEndDate ? formatDate(leave.actualEndDate) : "-"}
              </InfoRow>
            </div>
          </div>

          {/* Restricted information */}
          <div className="pt-6 border-t border-border">
            <h3 className="text-base font-semibold mb-4 text-foreground">Informações Restritas</h3>
            <div className="space-y-4">
              <InfoRow icon={IconFileDescription} label="CID">
                {leave.cid || "-"}
              </InfoRow>
              <InfoRow icon={IconHash} label="Nº do Benefício INSS">
                {leave.inssBenefitNumber || "-"}
              </InfoRow>
            </div>
          </div>

          {/* Notes */}
          {leave.notes && (
            <div className="pt-6 border-t border-border">
              <h3 className="text-base font-semibold mb-4 text-foreground flex items-center gap-2">
                <IconNotes className="h-4 w-4 text-muted-foreground" />
                Observações
              </h3>
              <div className="bg-muted/50 rounded-lg px-4 py-3">
                <p className="text-sm text-foreground whitespace-pre-wrap">{leave.notes}</p>
              </div>
            </div>
          )}

          {/* System Dates */}
          <div className="pt-6 border-t border-border">
            <h3 className="text-base font-semibold mb-4 text-foreground">Datas do Sistema</h3>
            <div className="space-y-4">
              <InfoRow icon={IconCalendarPlus} label="Criado em">
                {leave.createdAt ? formatDateTime(leave.createdAt) : "-"}
              </InfoRow>
              <InfoRow icon={IconCalendarTime} label="Atualizado em">
                {leave.updatedAt ? formatDateTime(leave.updatedAt) : "-"}
              </InfoRow>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
