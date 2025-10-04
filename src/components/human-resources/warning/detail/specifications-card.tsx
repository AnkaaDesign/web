import { IconInfoCircle, IconCalendar, IconHash, IconAlertTriangle, IconUser, IconUserShield } from "@tabler/icons-react";

import type { Warning } from "../../../../types";
import { formatDate, formatDateTime } from "../../../../utils";
import { WARNING_SEVERITY_LABELS, WARNING_CATEGORY_LABELS } from "../../../../constants";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface SpecificationsCardProps {
  warning: Warning;
}

export function SpecificationsCard({ warning }: SpecificationsCardProps) {
  const getSeverityBadgeVariant = (severity: string) => {
    switch (severity) {
      case "VERBAL":
        return "warning";
      case "WRITTEN":
        return "secondary";
      case "SUSPENSION":
        return "destructive";
      case "FINAL_WARNING":
        return "error";
      default:
        return "default";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconInfoCircle className="h-5 w-5" />
          Especificações
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Basic Information */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Informações Básicas</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <IconAlertTriangle className="h-4 w-4" />
                Severidade
              </span>
              <Badge variant={getSeverityBadgeVariant(warning.severity)}>{WARNING_SEVERITY_LABELS[warning.severity]}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Categoria</span>
              <Badge variant="outline">{WARNING_CATEGORY_LABELS[warning.category]}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge variant={warning.isActive ? "warning" : "success"}>{warning.isActive ? "Ativa" : "Resolvida"}</Badge>
            </div>
          </div>
        </div>

        <Separator />

        {/* People Involved */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Pessoas Envolvidas</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <IconUser className="h-4 w-4" />
                Colaborador
              </span>
              <div className="text-right">
                <p className="text-sm font-medium">{warning.collaborator?.name || "-"}</p>
                {warning.collaborator?.position && <p className="text-xs text-muted-foreground">{warning.collaborator.position.name}</p>}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <IconUserShield className="h-4 w-4" />
                Supervisor
              </span>
              <div className="text-right">
                <p className="text-sm font-medium">{warning.supervisor?.name || "-"}</p>
                {warning.supervisor?.position && <p className="text-xs text-muted-foreground">{warning.supervisor.position.name}</p>}
              </div>
            </div>
            {warning.witness && warning.witness.length > 0 && (
              <div>
                <span className="text-sm text-muted-foreground">Testemunhas</span>
                <div className="mt-2 space-y-1">
                  {warning.witness.map((w: any) => (
                    <p key={w.id} className="text-sm">
                      • {w.name}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Dates */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <IconCalendar className="h-4 w-4" />
            Datas
          </h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-muted-foreground">Data de Acompanhamento</span>
              <span className="text-sm font-medium">{formatDate(warning.followUpDate)}</span>
            </div>
            {warning.resolvedAt && (
              <div className="flex items-center justify-between py-1">
                <span className="text-sm text-muted-foreground">Resolvida em</span>
                <span className="text-sm">{formatDateTime(warning.resolvedAt)}</span>
              </div>
            )}
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-muted-foreground">Criada em</span>
              <span className="text-sm">{formatDateTime(warning.createdAt)}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-muted-foreground">Atualizada em</span>
              <span className="text-sm">{formatDateTime(warning.updatedAt)}</span>
            </div>
          </div>
        </div>

        {/* Identification */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <IconHash className="h-4 w-4" />
            Identificação
          </h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-muted-foreground">ID da Advertência</span>
              <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{warning.id}</code>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
