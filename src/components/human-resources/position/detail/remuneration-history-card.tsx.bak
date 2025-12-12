import { IconHistory, IconCurrencyReal, IconTrendingUp, IconTrendingDown, IconMinus } from "@tabler/icons-react";

import type { Position, PositionRemuneration } from "../../../../types";
import { formatCurrency, formatDateTime } from "../../../../utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface RemunerationHistoryCardProps {
  position: Position;
}

export function RemunerationHistoryCard({ position }: RemunerationHistoryCardProps) {
  if (!position.remunerations || position.remunerations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconHistory className="h-5 w-5" />
            Histórico de Remunerações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <IconCurrencyReal className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum histórico de remuneração encontrado</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const sortedRemunerations = [...position.remunerations].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const getChangeInfo = (current: PositionRemuneration, previous?: PositionRemuneration) => {
    if (!previous) return null;

    const difference = current.value - previous.value;
    const percentage = ((difference / previous.value) * 100).toFixed(1);

    if (difference > 0) {
      return {
        icon: IconTrendingUp,
        color: "text-green-600",
        badge: "success" as const,
        text: `+${formatCurrency(difference)} (${percentage}%)`,
      };
    } else if (difference < 0) {
      return {
        icon: IconTrendingDown,
        color: "text-red-600",
        badge: "destructive" as const,
        text: `${formatCurrency(difference)} (${percentage}%)`,
      };
    } else {
      return {
        icon: IconMinus,
        color: "text-muted-foreground",
        badge: "secondary" as const,
        text: "Sem alteração",
      };
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconHistory className="h-5 w-5" />
            Histórico de Remunerações
          </div>
          <Badge variant="secondary">
            {sortedRemunerations.length} registro{sortedRemunerations.length !== 1 ? "s" : ""}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {sortedRemunerations.map((remuneration, index) => {
              const previous = sortedRemunerations[index + 1];
              const changeInfo = getChangeInfo(remuneration, previous);
              const isLatest = index === 0;

              return (
                <div key={remuneration.id} className={`border rounded-lg p-4 ${isLatest ? "border-primary bg-primary/5" : ""}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-semibold">{formatCurrency(remuneration.value)}</p>
                      {isLatest && (
                        <Badge variant="primary" className="text-xs">
                          Atual
                        </Badge>
                      )}
                    </div>
                    {changeInfo && (
                      <div className="flex items-center gap-2">
                        <changeInfo.icon className={`h-4 w-4 ${changeInfo.color}`} />
                        <Badge variant={changeInfo.badge} className="text-xs">
                          {changeInfo.text}
                        </Badge>
                      </div>
                    )}
                  </div>

                  <div className="text-sm text-muted-foreground">
                    <p>Registrado em {formatDateTime(remuneration.createdAt)}</p>
                  </div>

                  {index === sortedRemunerations.length - 1 && (
                    <div className="mt-2 pt-2 border-t">
                      <p className="text-xs text-muted-foreground">Remuneração inicial do cargo</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
