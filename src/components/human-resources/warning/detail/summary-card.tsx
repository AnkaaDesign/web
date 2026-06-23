import {
  IconAlertTriangle,
  IconTag,
  IconCircleCheck,
  IconUser,
  IconBriefcase,
  IconBuilding,
  IconUserShield,
  IconCalendar,
  IconCalendarCheck,
  IconCalendarEvent,
  IconUsers,
  IconCalendarOff,
  IconLink,
} from "@tabler/icons-react";
import { Link } from "react-router-dom";

import type { Warning } from "../../../../types";
import { formatDate, formatDateTime } from "../../../../utils";
import { WARNING_SEVERITY_LABELS, WARNING_CATEGORY_LABELS, routes } from "../../../../constants";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DetailRow } from "@/components/ui/detail-row";
import { cn } from "@/lib/utils";

interface SummaryCardProps {
  warning: Warning;
  className?: string;
}

function getSeverityVariant(severity: string) {
  switch (severity) {
    case "VERBAL": return "warning" as const;
    case "WRITTEN": return "secondary" as const;
    case "SUSPENSION": return "destructive" as const;
    case "FINAL_WARNING": return "error" as const;
    default: return "default" as const;
  }
}

export function SummaryCard({ warning, className }: SummaryCardProps) {
  const collaborator = warning.collaborator as any;
  const supervisor = warning.supervisor as any;
  const witnesses = (warning.witness as any[]) ?? [];

  return (
    <Card className={cn("shadow-sm border border-border", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <IconAlertTriangle className="h-5 w-5 text-muted-foreground" />
          Resumo
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {/* Classification */}
          <DetailRow
            icon={IconAlertTriangle}
            label="Gravidade"
            value={
              <Badge variant={getSeverityVariant(warning.severity)}>
                {WARNING_SEVERITY_LABELS[warning.severity]}
              </Badge>
            }
          />
          <DetailRow
            icon={IconTag}
            label="Categoria"
            value={<Badge variant="outline">{WARNING_CATEGORY_LABELS[warning.category]}</Badge>}
          />
          <DetailRow
            icon={IconCircleCheck}
            label="Status"
            value={
              <Badge variant={warning.isActive ? "secondary" : "success"}>
                {warning.isActive ? "Ativa" : "Resolvida"}
              </Badge>
            }
          />
          {warning.severity === "SUSPENSION" && (
            <DetailRow
              icon={IconCalendarOff}
              label="Dias de Suspensão"
              value={
                warning.suspensionDays != null
                  ? `${warning.suspensionDays} ${warning.suspensionDays === 1 ? "dia" : "dias"}`
                  : undefined
              }
            />
          )}

          {/* Collaborator */}
          <DetailRow
            icon={IconUser}
            label="Colaborador"
            value={
              collaborator ? (
                <Link
                  to={routes.administration.collaborators.details(collaborator.id)}
                  className="text-sm font-semibold hover:underline text-foreground"
                  onClick={(e) => e.stopPropagation()}
                >
                  {collaborator.name}
                </Link>
              ) : undefined
            }
          />
          {collaborator?.position && (
            <DetailRow icon={IconBriefcase} label="Cargo" value={collaborator.position.name} />
          )}
          {collaborator?.sector && (
            <DetailRow icon={IconBuilding} label="Setor" value={collaborator.sector.name} />
          )}

          {/* Supervisor */}
          <DetailRow
            icon={IconUserShield}
            label="Supervisor"
            value={supervisor?.name ?? undefined}
          />

          {/* Witnesses */}
          {witnesses.length > 0 && (
            <DetailRow
              icon={IconUsers}
              label="Testemunhas"
              block
              value={
                <div className="space-y-1">
                  {witnesses.map((w: any) => (
                    <p key={w.id} className="text-sm">
                      {w.name}
                      {w.position && (
                        <span className="text-muted-foreground"> — {w.position.name}</span>
                      )}
                    </p>
                  ))}
                </div>
              }
            />
          )}

          {/* Dates */}
          <DetailRow
            icon={IconCalendar}
            label="Acompanhamento"
            value={warning.followUpDate ? formatDate(warning.followUpDate) : undefined}
          />
          {warning.resolvedAt && (
            <DetailRow
              icon={IconCalendarCheck}
              label="Resolvida em"
              value={formatDateTime(warning.resolvedAt)}
            />
          )}
          <DetailRow
            icon={IconCalendarEvent}
            label="Emitida em"
            value={formatDateTime(warning.createdAt)}
          />

          {/* Termination link */}
          {warning.terminationId && (
            <DetailRow
              icon={IconLink}
              label="Rescisão Vinculada"
              value={
                <Link
                  to={routes.personnelDepartment.terminations.details(warning.terminationId)}
                  className="text-sm font-semibold hover:underline text-primary"
                  onClick={(e) => e.stopPropagation()}
                >
                  Ver rescisão
                </Link>
              }
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
