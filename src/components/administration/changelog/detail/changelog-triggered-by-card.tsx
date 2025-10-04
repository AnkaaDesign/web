import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconRobot, IconUser, IconWebhook, IconClock, IconTerminal, IconApi } from "@tabler/icons-react";
import type { ChangeLog } from "../../../../types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { CHANGE_TRIGGERED_BY, CHANGE_TRIGGERED_BY_LABELS } from "../../../../constants";

interface ChangelogTriggeredByCardProps {
  changelog: ChangeLog;
  className?: string;
}

export function ChangelogTriggeredByCard({ changelog, className }: ChangelogTriggeredByCardProps) {
  const getTriggeredByIcon = () => {
    switch (changelog.triggeredBy) {
      case CHANGE_TRIGGERED_BY.USER:
        return <IconUser className="h-4 w-4" />;
      case CHANGE_TRIGGERED_BY.SYSTEM:
        return <IconRobot className="h-4 w-4" />;
      case CHANGE_TRIGGERED_BY.SCHEDULED_JOB:
        return <IconClock className="h-4 w-4" />;
      case CHANGE_TRIGGERED_BY.API:
        return <IconApi className="h-4 w-4" />;
      case CHANGE_TRIGGERED_BY.WEBHOOK:
        return <IconWebhook className="h-4 w-4" />;
      case CHANGE_TRIGGERED_BY.ADMIN:
        return <IconTerminal className="h-4 w-4" />;
      default:
        return <IconWebhook className="h-4 w-4" />;
    }
  };

  const getTriggeredByVariant = () => {
    switch (changelog.triggeredBy) {
      case CHANGE_TRIGGERED_BY.USER:
        return "default";
      case CHANGE_TRIGGERED_BY.SYSTEM:
        return "secondary";
      case CHANGE_TRIGGERED_BY.SCHEDULED_JOB:
        return "outline";
      case CHANGE_TRIGGERED_BY.API:
        return "info";
      case CHANGE_TRIGGERED_BY.WEBHOOK:
        return "warning";
      case CHANGE_TRIGGERED_BY.ADMIN:
        return "destructive";
      default:
        return "default";
    }
  };

  const hasTriggeredInfo = changelog.triggeredBy || changelog.triggeredById;

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)} level={1}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-3 text-xl">
          <div className="p-2 rounded-lg bg-primary/10">
            <IconWebhook className="h-5 w-5 text-primary" />
          </div>
          Origem da Alteração
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        {!hasTriggeredInfo ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <IconWebhook className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">Origem da alteração não especificada</p>
            <p className="text-xs text-muted-foreground mt-1">Provavelmente uma alteração manual direta</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Triggered By Type */}
            {changelog.triggeredBy && (
              <div className="bg-muted/50 rounded-lg px-4 py-4">
                <span className="text-sm font-medium text-muted-foreground block mb-3">Tipo de Origem</span>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-background">{getTriggeredByIcon()}</div>
                  <div className="flex-1">
                    <Badge variant={getTriggeredByVariant()} className="mb-1">
                      {CHANGE_TRIGGERED_BY_LABELS[changelog.triggeredBy]}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">{getTriggeredByDescription(changelog.triggeredBy)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Triggered By ID */}
            {changelog.triggeredById && (
              <div className="bg-muted/50 rounded-lg px-4 py-4">
                <span className="text-sm font-medium text-muted-foreground block mb-2">Identificador de Origem</span>
                <div className="bg-background rounded-md px-3 py-2">
                  <code className="text-sm font-mono text-foreground">{changelog.triggeredById}</code>
                </div>
                <p className="text-xs text-muted-foreground mt-2">{getTriggeredByIdDescription(changelog.triggeredBy)}</p>
              </div>
            )}

            {/* Additional Context */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="p-1.5 rounded bg-blue-100 dark:bg-blue-800/50">
                  <IconWebhook className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-1">Rastreabilidade</p>
                  <p className="text-xs text-blue-700 dark:text-blue-400">
                    Esta alteração foi{" "}
                    {changelog.triggeredBy === CHANGE_TRIGGERED_BY.USER
                      ? "iniciada manualmente por um usuário"
                      : changelog.triggeredBy === CHANGE_TRIGGERED_BY.SYSTEM
                        ? "executada automaticamente pelo sistema"
                        : changelog.triggeredBy === CHANGE_TRIGGERED_BY.SCHEDULED_JOB
                          ? "executada por uma tarefa agendada"
                          : changelog.triggeredBy === CHANGE_TRIGGERED_BY.API
                            ? "realizada através da API"
                            : changelog.triggeredBy === CHANGE_TRIGGERED_BY.WEBHOOK
                              ? "disparada por um webhook externo"
                              : changelog.triggeredBy === CHANGE_TRIGGERED_BY.ADMIN
                                ? "executada por um administrador"
                                : "realizada de forma não especificada"}
                    .
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getTriggeredByDescription(triggeredBy: string | null): string {
  switch (triggeredBy) {
    case CHANGE_TRIGGERED_BY.USER:
      return "Alteração realizada diretamente por um usuário através da interface";
    case CHANGE_TRIGGERED_BY.SYSTEM:
      return "Alteração automática realizada pelo sistema";
    case CHANGE_TRIGGERED_BY.SCHEDULED_JOB:
      return "Alteração executada por uma rotina programada";
    case CHANGE_TRIGGERED_BY.API:
      return "Alteração realizada através de chamada à API";
    case CHANGE_TRIGGERED_BY.WEBHOOK:
      return "Alteração disparada por webhook de sistema externo";
    case CHANGE_TRIGGERED_BY.ADMIN:
      return "Alteração administrativa com privilégios especiais";
    default:
      return "Tipo de origem não especificado";
  }
}

function getTriggeredByIdDescription(triggeredBy: string | null): string {
  switch (triggeredBy) {
    case CHANGE_TRIGGERED_BY.USER:
      return "ID do usuário que realizou a alteração";
    case CHANGE_TRIGGERED_BY.SYSTEM:
      return "Identificador do processo ou módulo do sistema";
    case CHANGE_TRIGGERED_BY.SCHEDULED_JOB:
      return "ID do job ou tarefa agendada";
    case CHANGE_TRIGGERED_BY.API:
      return "ID da aplicação ou token de API utilizado";
    case CHANGE_TRIGGERED_BY.WEBHOOK:
      return "ID do webhook ou sistema externo";
    case CHANGE_TRIGGERED_BY.ADMIN:
      return "ID do administrador responsável";
    default:
      return "Identificador relacionado à origem da alteração";
  }
}
