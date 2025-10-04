import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconHistory, IconUser, IconCalendarEvent, IconDatabase, IconHash } from "@tabler/icons-react";
import type { ChangeLog } from "../../../../types";
import { cn } from "@/lib/utils";
import { formatDateTime } from "../../../../utils";
import { CHANGE_LOG_ACTION_LABELS, CHANGE_LOG_ENTITY_TYPE_LABELS } from "../../../../constants";

interface ChangelogBasicInfoCardProps {
  changelog: ChangeLog;
  className?: string;
}

export function ChangelogBasicInfoCard({ changelog, className }: ChangelogBasicInfoCardProps) {
  const actionVariant = changelog.action === "DELETE" ? "destructive" : changelog.action === "CREATE" ? "success" : "default";

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)} level={1}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-3 text-xl">
          <div className="p-2 rounded-lg bg-primary/10">
            <IconHistory className="h-5 w-5 text-primary" />
          </div>
          Informações Básicas
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-6">
          {/* Basic Information Section */}
          <div>
            <h3 className="text-base font-semibold mb-4 text-foreground">Identificação</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconHash className="h-4 w-4" />
                  ID
                </span>
                <span className="text-sm font-semibold text-foreground font-mono">{changelog.id.substring(0, 8)}</span>
              </div>

              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconDatabase className="h-4 w-4" />
                  Entidade
                </span>
                <span className="text-sm font-semibold text-foreground">{CHANGE_LOG_ENTITY_TYPE_LABELS[changelog.entityType] || changelog.entityType}</span>
              </div>

              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">ID da Entidade</span>
                <span className="text-sm font-semibold text-foreground font-mono">{changelog.entityId.substring(0, 8)}</span>
              </div>

              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">Ação</span>
                <Badge variant={actionVariant}>{CHANGE_LOG_ACTION_LABELS[changelog.action]}</Badge>
              </div>

              {changelog.user && (
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconUser className="h-4 w-4" />
                    Usuário
                  </span>
                  <span className="text-sm font-semibold text-foreground">{changelog.user.name || changelog.user.email || "Desconhecido"}</span>
                </div>
              )}

              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconCalendarEvent className="h-4 w-4" />
                  Data/Hora
                </span>
                <span className="text-sm font-semibold text-foreground">{formatDateTime(changelog.createdAt)}</span>
              </div>

              {changelog.reason && (
                <div className="bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground block mb-2">Motivo</span>
                  <span className="text-sm text-foreground">{changelog.reason}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
