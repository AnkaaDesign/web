import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  IconCalculator,
  IconClipboardList,
  IconTrendingUp,
  IconTrendingDown,
  IconMinus,
  IconShoppingCart,
} from "@tabler/icons-react";
import type { Item } from "../../../../types";
import { ABC_CATEGORY_LABELS, XYZ_CATEGORY_LABELS } from "../../../../constants";
import { cn } from "@/lib/utils";

interface CalculationBreakdownCardProps {
  item: Item;
  className?: string;
}

function formatNumber(value: number | null | undefined, suffix = ""): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const formatted = value.toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  });
  return suffix ? `${formatted} ${suffix}` : formatted;
}

function formatTrend(trend: number | null | undefined) {
  if (trend == null || !Number.isFinite(trend)) {
    return { label: "—", icon: IconMinus, color: "text-muted-foreground" };
  }
  if (trend > 1) {
    return {
      label: `+${trend.toFixed(0)}%`,
      icon: IconTrendingUp,
      color: "text-orange-500",
    };
  }
  if (trend < -1) {
    return {
      label: `${trend.toFixed(0)}%`,
      icon: IconTrendingDown,
      color: "text-blue-500",
    };
  }
  return { label: "Estável", icon: IconMinus, color: "text-muted-foreground" };
}

export function CalculationBreakdownCard({ item, className }: CalculationBreakdownCardProps) {
  const trend = formatTrend(item.monthlyConsumptionTrendPercent);
  const TrendIcon = trend.icon;

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2">
            <IconCalculator className="h-5 w-5 text-muted-foreground" />
            Cálculo de Estoque
          </CardTitle>
          {item.hasActiveOrder && (
            <Badge variant="info" className="flex items-center gap-1">
              <IconShoppingCart className="h-3 w-3" />
              Pedido em aberto
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Valores calculados automaticamente a partir do consumo e do tempo de entrega
        </p>
      </CardHeader>

      <CardContent className="pt-0 flex-1 space-y-6">
        {/* Inputs do cálculo */}
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <IconClipboardList className="h-4 w-4 text-muted-foreground" />
            Dados de entrada
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/50 border-0">
              <div className="text-xs text-muted-foreground mb-1">Consumo mensal</div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-foreground">
                  {formatNumber(item.monthlyConsumption, "/ mês")}
                </span>
                <span className={cn("flex items-center gap-1 text-sm", trend.color)}>
                  <TrendIcon className="h-4 w-4" />
                  {trend.label}
                </span>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border-0">
              <div className="text-xs text-muted-foreground mb-1">Tempo de entrega</div>
              <div className="font-semibold text-foreground">
                {item.estimatedLeadTime != null ? `${item.estimatedLeadTime} dias` : "—"}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border-0">
              <div className="text-xs text-muted-foreground mb-1">Categoria ABC</div>
              <div className="font-semibold text-foreground">
                {item.abcCategory ? (
                  <div className="flex items-center gap-2">
                    <span>{ABC_CATEGORY_LABELS[item.abcCategory]}</span>
                    {item.abcCategoryOrder != null && (
                      <span className="text-xs text-muted-foreground">#{item.abcCategoryOrder}</span>
                    )}
                  </div>
                ) : (
                  "—"
                )}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20 border-0">
              <div className="text-xs text-muted-foreground mb-1">Categoria XYZ</div>
              <div className="font-semibold text-foreground">
                {item.xyzCategory ? (
                  <div className="flex items-center gap-2">
                    <span>{XYZ_CATEGORY_LABELS[item.xyzCategory]}</span>
                    {item.xyzCategoryOrder != null && (
                      <span className="text-xs text-muted-foreground">#{item.xyzCategoryOrder}</span>
                    )}
                  </div>
                ) : (
                  "—"
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Resultados do cálculo */}
        <div className="pt-6 border-t border-border">
          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <IconCalculator className="h-4 w-4 text-primary" />
            Valores calculados
          </h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-3">
              <span className="text-sm font-medium text-muted-foreground">Ponto de reposição</span>
              <span className="font-semibold text-base text-foreground">
                {formatNumber(item.reorderPoint)}
              </span>
            </div>
            <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-3">
              <span className="text-sm font-medium text-muted-foreground">Quantidade máxima</span>
              <span className="font-semibold text-base text-foreground">
                {formatNumber(item.maxQuantity)}
              </span>
            </div>
            <div className="flex items-center justify-between bg-primary/5 rounded-lg px-4 py-3">
              <span className="text-sm font-medium text-muted-foreground">
                Quantidade sugerida para o próximo pedido
              </span>
              <span className="font-semibold text-base text-primary">
                {formatNumber(item.reorderQuantity)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
