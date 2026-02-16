import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconInfoCircle, IconArrowUp, IconArrowDown, IconUser, IconCalendar, IconClipboardList, IconPackage } from "@tabler/icons-react";
import type { Activity } from "../../../../types";
import { ACTIVITY_REASON_LABELS, ACTIVITY_OPERATION } from "../../../../constants";
import { formatDateTime, formatRelativeTime } from "../../../../utils";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface ActivitySpecificationsCardProps {
  activity: Activity;
  className?: string;
}

export function ActivitySpecificationsCard({ activity, className }: ActivitySpecificationsCardProps) {
  const isInbound = activity.operation === ACTIVITY_OPERATION.INBOUND;

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-2">
          <IconInfoCircle className="h-5 w-5 text-muted-foreground" />
          Informações da Movimentação
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-6">
          {/* Operation and Quantity Section */}
          <div>
            <h3 className="text-base font-semibold mb-4 text-foreground">Detalhes da Operação</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    {isInbound ? <IconArrowUp className="h-4 w-4" /> : <IconArrowDown className="h-4 w-4" />}
                    Tipo de Operação
                  </span>
                  <Badge
                    className={cn(
                      "text-xs font-medium border text-white",
                      isInbound ? "bg-green-700 hover:bg-green-800 border-green-700" : "bg-red-700 hover:bg-red-800 border-red-700",
                    )}
                  >
                    <span className="font-enhanced-unicode sort-arrow">{isInbound ? "↑" : "↓"}</span> {isInbound ? "Entrada" : "Saída"}
                  </Badge>
                </div>
              </div>

              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <IconPackage className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Quantidade</span>
                </div>
                <span className={cn("text-2xl font-bold", isInbound ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400")}>
                  {isInbound ? "+" : "-"}
                  {Math.abs(activity.quantity)}
                </span>
              </div>

              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <IconClipboardList className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Motivo</span>
                </div>
                <span className="text-base font-semibold text-foreground">
                  {activity.reason ? ACTIVITY_REASON_LABELS[activity.reason] : <span className="text-muted-foreground italic">Não especificado</span>}
                </span>
              </div>
            </div>
          </div>

          {/* User Information Section */}
          <div className="pt-6 border-t border-border">
            <h3 className="text-base font-semibold mb-4 text-foreground">Responsável</h3>
            <div className="bg-muted/30 rounded-lg p-4">
              {activity.user ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-2">
                      <IconUser className="h-4 w-4" />
                      Nome do Usuário
                    </p>
                    <p className="text-base font-semibold text-foreground">{activity.user.name}</p>
                  </div>
                  {activity.user.sector && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Setor</p>
                      <p className="text-sm text-foreground">{activity.user.sector.name}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <IconUser className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground italic">Operação realizada pelo sistema</span>
                </div>
              )}
            </div>
          </div>

          {/* Date Information Section */}
          <div className="pt-6 border-t border-border">
            <h3 className="text-base font-semibold mb-4 text-foreground">Data e Hora</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <IconCalendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Data da Movimentação</span>
                </div>
                <p className="text-base font-semibold text-foreground">{formatDateTime(activity.createdAt)}</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <IconCalendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Tempo Decorrido</span>
                </div>
                <p className="text-base font-semibold text-foreground">{formatRelativeTime(activity.createdAt)}</p>
              </div>
            </div>
          </div>

          {/* Related Order Section */}
          {activity.order && (
            <div className="pt-6 border-t border-border">
              <h3 className="text-base font-semibold mb-4 text-foreground">Pedido Relacionado</h3>
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <IconClipboardList className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Número do Pedido</span>
                </div>
                <p className="font-mono text-base bg-muted/50 rounded px-3 py-2 w-fit text-foreground">#{activity.order.id.slice(0, 8).toUpperCase()}</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
