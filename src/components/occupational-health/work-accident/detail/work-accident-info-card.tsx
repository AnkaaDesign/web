import { differenceInCalendarDays } from "date-fns";
import {
  IconClipboardList,
  IconUser,
  IconBriefcase,
  IconBuilding,
  IconId,
  IconHash,
  IconCalendarEvent,
  IconCalendarPlus,
  IconCalendarOff,
  IconShieldCheck,
  IconAlertTriangle,
  IconNotes,
  IconFileText,
  IconExternalLink,
} from "@tabler/icons-react";
import { Link } from "react-router-dom";

import { WORK_ACCIDENT_REPORT_TYPE_LABELS, STABILITY_TYPE_LABELS, LEAVE_TYPE_LABELS, routes } from "../../../../constants";
import type { WORK_ACCIDENT_REPORT_TYPE, STABILITY_TYPE, LEAVE_TYPE } from "../../../../constants";
import { formatDate, getFileUrl } from "../../../../utils";
import { cn } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DetailRow } from "@/components/ui/detail-row";
import type { WorkAccidentReport } from "@/types/work-accident";

interface WorkAccidentInfoCardProps {
  report: WorkAccidentReport;
  className?: string;
}

export function WorkAccidentInfoCard({ report, className }: WorkAccidentInfoCardProps) {
  // Estabilidade acidentária — espelhada no vínculo atual do colaborador.
  const contract = report.user?.currentContract;
  const stabilityStart = contract?.stabilityStart ? new Date(contract.stabilityStart) : null;
  const stabilityEnd = contract?.stabilityEnd ? new Date(contract.stabilityEnd) : null;
  const hasStability = !!(contract?.stabilityType && stabilityEnd);
  const stabilityDaysLeft = stabilityEnd ? differenceInCalendarDays(stabilityEnd, new Date()) : null;
  const stabilityActive = hasStability && stabilityDaysLeft !== null && stabilityDaysLeft >= 0;

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-2">
          <IconClipboardList className="h-5 w-5 text-muted-foreground" />
          Informações da CAT
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-6">
          {/* Colaborador */}
          <div>
            <h3 className="text-base font-semibold mb-4 text-foreground">Colaborador</h3>
            <div className="space-y-2">
              <DetailRow icon={IconUser} label="Nome" value={report.user?.name || "-"} />
              <DetailRow icon={IconBriefcase} label="Cargo" value={report.user?.position?.name || "-"} />
              <DetailRow icon={IconBuilding} label="Setor" value={report.user?.sector?.name || "-"} />
            </div>
          </div>

          {/* CAT */}
          <div className="pt-6 border-t border-border">
            <h3 className="text-base font-semibold mb-4 text-foreground">CAT</h3>
            <div className="space-y-2">
              <DetailRow
                icon={IconId}
                label="Tipo"
                value={
                  <Badge variant="secondary" className="font-normal">
                    {WORK_ACCIDENT_REPORT_TYPE_LABELS[report.type as WORK_ACCIDENT_REPORT_TYPE] || report.type}
                  </Badge>
                }
              />
              <DetailRow icon={IconHash} label="Nº da CAT" value={report.catNumber || "-"} />
              <DetailRow icon={IconCalendarEvent} label="Data do acidente" value={report.accidentDate ? formatDate(new Date(report.accidentDate)) : "-"} />
              <DetailRow icon={IconCalendarPlus} label="Data de emissão" value={report.emissionDate ? formatDate(new Date(report.emissionDate)) : "-"} />
              {report.leave && (
                <DetailRow
                  icon={IconCalendarOff}
                  label="Afastamento vinculado"
                  value={
                    <Link to={routes.occupationalHealth.leaves.details(report.leave.id)} className="text-primary hover:underline">
                      {LEAVE_TYPE_LABELS[report.leave.type as LEAVE_TYPE] || report.leave.type}
                    </Link>
                  }
                />
              )}
              {report.file && (
                <DetailRow
                  icon={IconFileText}
                  label="Documento da CAT"
                  value={
                    <a href={getFileUrl(report.file)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                      Ver documento
                      <IconExternalLink className="h-3.5 w-3.5" />
                    </a>
                  }
                />
              )}
            </div>
          </div>

          {/* Estabilidade acidentária */}
          <div className="pt-6 border-t border-border">
            <h3 className="text-base font-semibold mb-4 text-foreground flex items-center gap-2">
              <IconShieldCheck className="h-4 w-4 text-muted-foreground" />
              Estabilidade
            </h3>
            {hasStability ? (
              <div className="space-y-2">
                <DetailRow
                  icon={IconShieldCheck}
                  label="Tipo"
                  value={
                    <Badge variant={stabilityActive ? "amber" : "secondary"} className="font-normal">
                      {STABILITY_TYPE_LABELS[contract!.stabilityType as STABILITY_TYPE] || contract!.stabilityType}
                    </Badge>
                  }
                />
                <DetailRow icon={IconCalendarPlus} label="Início" value={stabilityStart ? formatDate(stabilityStart) : "-"} />
                <DetailRow icon={IconCalendarEvent} label="Término" value={stabilityEnd ? formatDate(stabilityEnd) : "-"} />
                <DetailRow
                  icon={IconAlertTriangle}
                  label="Situação"
                  value={
                    stabilityActive ? (
                      <Badge variant="amber" className="font-normal">
                        Ativa — {stabilityDaysLeft} {stabilityDaysLeft === 1 ? "dia" : "dias"} restantes (desligamento bloqueado)
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="font-normal">
                        Encerrada
                      </Badge>
                    )
                  }
                />
              </div>
            ) : (
              <div className="bg-muted/50 rounded-lg px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Nenhuma janela de estabilidade aplicada. Vincule um afastamento por acidente e confirme a estabilidade ao registrar/editar a CAT para que os 12 meses sejam calculados a partir do retorno.
                </p>
              </div>
            )}
          </div>

          {/* Descrição */}
          {report.description && (
            <div className="pt-6 border-t border-border">
              <h3 className="text-base font-semibold mb-4 text-foreground flex items-center gap-2">
                <IconNotes className="h-4 w-4 text-muted-foreground" />
                Descrição
              </h3>
              <div className="bg-muted/50 rounded-lg px-4 py-3">
                <p className="text-sm text-foreground whitespace-pre-wrap">{report.description}</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
