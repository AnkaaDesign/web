import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconPackage, IconBoxMultiple, IconShirt, IconShoe } from "@tabler/icons-react";
import type { PpeDeliverySchedule, PpeScheduleItem } from "../../../../../types";
import { PPE_TYPE_LABELS, PPE_TYPE } from "../../../../../constants";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

interface PpeScheduleItemsCardProps {
  schedule: PpeDeliverySchedule;
  className?: string;
}

// Get icon based on PPE type
function getPpeTypeIcon(ppeType: string) {
  switch (ppeType) {
    case PPE_TYPE.SHIRT:
      return <IconShirt className="h-4 w-4 text-primary" />;
    case PPE_TYPE.PANTS:
    case PPE_TYPE.SHORT:
      return <IconShirt className="h-4 w-4 text-primary" />;
    case PPE_TYPE.BOOTS:
    case PPE_TYPE.RAIN_BOOTS:
      return <IconShoe className="h-4 w-4 text-primary" />;
    default:
      return <IconPackage className="h-4 w-4 text-primary" />;
  }
}

// Get color class based on PPE type
function getPpeTypeColor(ppeType: string): string {
  switch (ppeType) {
    case PPE_TYPE.SHIRT:
      return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
    case PPE_TYPE.PANTS:
    case PPE_TYPE.SHORT:
      return "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400";
    case PPE_TYPE.BOOTS:
    case PPE_TYPE.RAIN_BOOTS:
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
    case PPE_TYPE.GLOVES:
      return "bg-green-500/10 text-green-600 dark:text-green-400";
    case PPE_TYPE.MASK:
      return "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400";
    case PPE_TYPE.SLEEVES:
      return "bg-purple-500/10 text-purple-600 dark:text-purple-400";
    case PPE_TYPE.OTHERS:
      return "bg-gray-500/10 text-gray-600 dark:text-gray-400";
    default:
      return "bg-primary/10 text-primary";
  }
}

export function PpeScheduleItemsCard({ schedule, className }: PpeScheduleItemsCardProps) {
  const ppeItems = schedule.items || [];

  // Calculate totals
  const totals = useMemo(() => {
    const totalTypes = ppeItems.length;
    const totalQuantity = ppeItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
    return { totalTypes, totalQuantity };
  }, [ppeItems]);

  return (
    <Card className={cn("shadow-sm border border-border", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <IconBoxMultiple className="h-5 w-5 text-muted-foreground" />
            Itens de EPI
          </CardTitle>
          {ppeItems.length > 0 && (
            <Badge variant="outline" className="font-semibold">
              {totals.totalQuantity} {totals.totalQuantity === 1 ? "item" : "itens"}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {ppeItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <IconPackage className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium">Nenhum item de EPI configurado</p>
            <p className="text-xs mt-1">Edite o agendamento para adicionar itens</p>
          </div>
        ) : (
          <div className="space-y-3">
            {ppeItems.map((ppeItem: PpeScheduleItem, index: number) => (
              <div
                key={ppeItem.id || index}
                className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={cn("p-2.5 rounded-lg", getPpeTypeColor(ppeItem.ppeType))}>
                    {getPpeTypeIcon(ppeItem.ppeType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {PPE_TYPE_LABELS[ppeItem.ppeType as keyof typeof PPE_TYPE_LABELS] || ppeItem.ppeType}
                    </p>
                    {/* Show item name for OTHERS type */}
                    {ppeItem.ppeType === PPE_TYPE.OTHERS && ppeItem.item ? (
                      <p className="text-xs text-muted-foreground truncate">{ppeItem.item.name}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Tamanho conforme perfil</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant="secondary" className="font-semibold tabular-nums">
                    {ppeItem.quantity}x
                  </Badge>
                </div>
              </div>
            ))}

            {/* Summary Footer */}
            <div className="pt-3 mt-3 border-t border-border">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total de Tipos</span>
                <span className="font-semibold">{totals.totalTypes} {totals.totalTypes === 1 ? "tipo" : "tipos"}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
