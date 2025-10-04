import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconChartBar, IconClock, IconCurrencyDollar } from "@tabler/icons-react";
import type { Maintenance } from "../../../../types";
import { formatCurrency } from "../../../../utils";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface MaintenanceMetricsCardProps {
  maintenance: Maintenance & {
    lastRun?: Date | null;
    itemsNeeded?: Array<{
      quantity: number;
      item?: {
        prices?: Array<{ value: number }>;
        price?: number; // fallback for single price field
      };
    }>;
  };
  className?: string;
}

export function MaintenanceMetricsCard({ maintenance, className }: MaintenanceMetricsCardProps) {
  const metrics = useMemo(() => {
    // Debug the maintenance structure// Calculate estimated cost per maintenance
    const estimatedCost =
      maintenance.itemsNeeded?.reduce((total, mi) => {
        if (!mi.item) {
          return total;
        }

        // Get price from prices array (only source - no direct price field exists)
        let itemPrice = 0;
        if (mi.item.prices && mi.item.prices.length > 0) {
          itemPrice = mi.item.prices[0].value;
        } else {
        }

        const itemCost = itemPrice * mi.quantity;
        return total + itemCost;
      }, 0) || 0;
    return {
      estimatedCost,
    };
  }, [maintenance]);

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)} level={1}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-3 text-xl">
          <div className="p-2 rounded-lg bg-primary/10">
            <IconChartBar className="h-5 w-5 text-primary" />
          </div>
          Métricas e Análises
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Estimated Cost */}
            <div className="p-4 rounded-xl bg-primary/5 border-0">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                <IconCurrencyDollar className="h-4 w-4 text-primary" />
                Custo Estimado
              </div>
              <p className="text-lg font-bold text-primary">{formatCurrency(metrics.estimatedCost)}</p>
            </div>

            {/* Last Run */}
            <div className="p-4 rounded-xl bg-muted/50 border-0">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                <IconClock className="h-4 w-4 text-muted-foreground" />
                Última Execução
              </div>
              <p className="text-lg font-bold text-foreground">{maintenance.lastRun ? new Date(maintenance.lastRun).toLocaleDateString("pt-BR") : "N/A"}</p>
            </div>
          </div>

          {/* Items Required Summary */}
          {maintenance.itemsNeeded && maintenance.itemsNeeded.length > 0 && (
            <div className="pt-4 border-t border-border/50">
              <h4 className="text-sm font-semibold mb-3 text-foreground">Recursos Necessários</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/30 rounded-lg p-3">
                  <span className="text-xs font-medium text-muted-foreground block">Itens Necessários</span>
                  <p className="text-lg font-bold mt-1 text-foreground">{maintenance.itemsNeeded.length}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <span className="text-xs font-medium text-muted-foreground block">Quantidade Total</span>
                  <p className="text-lg font-bold mt-1 text-foreground">{maintenance.itemsNeeded.reduce((sum, mi) => sum + mi.quantity, 0)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
