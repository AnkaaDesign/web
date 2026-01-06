import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconPackage, IconBoxMultiple } from "@tabler/icons-react";
import type { PpeDeliverySchedule, PpeScheduleItem } from "../../../../../types";
import { PPE_TYPE_LABELS } from "../../../../../constants";
import { cn } from "@/lib/utils";

interface PpeScheduleItemsCardProps {
  schedule: PpeDeliverySchedule;
  className?: string;
}

export function PpeScheduleItemsCard({ schedule, className }: PpeScheduleItemsCardProps) {
  const ppeItems = schedule.ppeItems || [];

  return (
    <Card className={cn("shadow-sm border border-border", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <IconBoxMultiple className="h-5 w-5 text-muted-foreground" />
          Itens de EPI
        </CardTitle>
      </CardHeader>

      <CardContent>
        {ppeItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <IconPackage className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Nenhum item de EPI configurado</p>
          </div>
        ) : (
          <div className="space-y-4">
            {ppeItems.map((ppeItem: PpeScheduleItem, index: number) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="p-2 rounded-md bg-primary/10">
                    <IconPackage className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">
                      {PPE_TYPE_LABELS[ppeItem.ppeType as keyof typeof PPE_TYPE_LABELS] || ppeItem.ppeType}
                    </p>
                    <p className="text-xs text-muted-foreground">Tipo de EPI</p>
                  </div>
                </div>
                <Badge variant="secondary" className="ml-2 font-semibold">
                  {ppeItem.quantity}x
                </Badge>
              </div>
            ))}

            {/* Summary */}
            <div className="pt-4 border-t border-border flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Total de Tipos</span>
              <Badge variant="outline" className="font-semibold">
                {ppeItems.length} {ppeItems.length === 1 ? "tipo" : "tipos"}
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
