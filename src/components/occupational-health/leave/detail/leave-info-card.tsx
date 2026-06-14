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
  IconShieldCheck,
  IconNotes,
} from "@tabler/icons-react";

import type { Leave } from "../../../../types/leave";
import { LEAVE_TYPE, LEAVE_STATUS, LEAVE_TYPE_LABELS, LEAVE_STATUS_LABELS, INSS_BENEFIT_SPECIES_LABELS } from "../../../../constants";
import type { INSS_BENEFIT_SPECIES } from "../../../../constants";
import { formatDate, formatDateTime } from "../../../../utils";
import { cn } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, getBadgeVariantFromStatus } from "@/components/ui/badge";
import { DetailRow } from "@/components/ui/detail-row";

interface LeaveInfoCardProps {
  leave: Leave;
  className?: string;
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
            <div className="space-y-2">
              <DetailRow
                icon={IconId}
                label="Tipo"
                value={
                  <Badge variant="secondary" className="font-normal">
                    {LEAVE_TYPE_LABELS[leave.type as LEAVE_TYPE] || leave.type}
                  </Badge>
                }
              />
              <DetailRow
                icon={IconProgressCheck}
                label="Status"
                value={
                  <Badge variant={getBadgeVariantFromStatus(leave.status, "LEAVE")} className="font-normal">
                    {LEAVE_STATUS_LABELS[leave.status as LEAVE_STATUS] || leave.status}
                  </Badge>
                }
              />
              <DetailRow
                icon={IconStethoscope}
                label="Exame de Retorno"
                value={
                  leave.returnExamRequired ? (
                    <Badge variant="amber" className="font-normal">
                      Obrigatório
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="font-normal">
                      Não obrigatório
                    </Badge>
                  )
                }
              />
            </div>
          </div>

          {/* Dates */}
          <div className="pt-6 border-t border-border">
            <h3 className="text-base font-semibold mb-4 text-foreground">Datas</h3>
            <div className="space-y-2">
              <DetailRow icon={IconCalendarEvent} label="Início" value={formatDate(leave.startDate)} />
              <DetailRow icon={IconCalendarDue} label="Término Previsto" value={leave.expectedEndDate ? formatDate(leave.expectedEndDate) : "-"} />
              <DetailRow icon={IconCalendarCheck} label="Retorno Efetivo" value={leave.actualEndDate ? formatDate(leave.actualEndDate) : "-"} />
            </div>
          </div>

          {/* Restricted information */}
          <div className="pt-6 border-t border-border">
            <h3 className="text-base font-semibold mb-4 text-foreground">Informações Restritas</h3>
            <div className="space-y-2">
              <DetailRow icon={IconFileDescription} label="CID" value={leave.cid || "-"} />
              <DetailRow
                icon={IconShieldCheck}
                label="Espécie do Benefício"
                value={
                  leave.inssBenefitSpecies ? (
                    <Badge variant="secondary" className="font-normal">
                      {INSS_BENEFIT_SPECIES_LABELS[leave.inssBenefitSpecies as INSS_BENEFIT_SPECIES] || leave.inssBenefitSpecies}
                    </Badge>
                  ) : (
                    "-"
                  )
                }
              />
              <DetailRow icon={IconHash} label="Nº do Benefício INSS" value={leave.inssBenefitNumber || "-"} />
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
            <div className="space-y-2">
              <DetailRow icon={IconCalendarPlus} label="Criado em" value={leave.createdAt ? formatDateTime(leave.createdAt) : "-"} />
              <DetailRow icon={IconCalendarTime} label="Atualizado em" value={leave.updatedAt ? formatDateTime(leave.updatedAt) : "-"} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
