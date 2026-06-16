import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  IconCalculator,
  IconClipboardList,
  IconHelpCircle,
  IconTrendingUp,
  IconTrendingDown,
  IconMinus,
  IconShoppingCart,
} from "@tabler/icons-react";
import type { Item } from "../../../../types";
import { ABC_CATEGORY_LABELS, XYZ_CATEGORY_LABELS } from "../../../../constants";
import { formatDate } from "../../../../utils";
import { cn } from "@/lib/utils";

interface ScheduledNextOrder {
  quantity: number;
  scheduleName?: string | null;
  scheduleId?: string;
  nextRun?: string | Date | null;
}

interface CalculationBreakdownCardProps {
  item: Item;
  className?: string;
  // When the item belongs to an active order schedule, this is the quantity that
  // schedule will actually order next (gap + one cycle). It replaces the standalone
  // restock-to-max suggestion, which is never used for scheduled items.
  scheduledNextOrder?: ScheduledNextOrder | null;
}

// Plain Portuguese explanations for ABC/XYZ pairs (algorithm-spec §15)
const ABC_XYZ_EXPLANATIONS: Record<string, string> = {
  "A-X": "Alto valor e consumo muito previsível — manter estoque controlado.",
  "A-Y": "Alto valor e consumo moderadamente previsível — atenção média.",
  "A-Z": "Alto valor e consumo imprevisível — risco maior, monitorar de perto.",
  "B-X": "Valor médio e consumo previsível — gestão padrão.",
  "B-Y": "Valor médio e consumo moderadamente previsível.",
  "B-Z": "Valor médio e consumo imprevisível.",
  "C-X": "Baixo valor e consumo previsível — pode ser reabastecido em lotes.",
  "C-Y": "Baixo valor e consumo moderadamente previsível.",
  "C-Z": "Baixo valor e consumo imprevisível — manter estoque mínimo.",
};

// Safety factor lookup (ABC/XYZ matrix — fallback when API doesn't expose it)
// Values follow the algorithm-spec defaults; the source of truth lives in the API.
const SAFETY_FACTOR_MATRIX: Record<string, Record<string, number>> = {
  A: { X: 1.05, Y: 1.15, Z: 1.3 },
  B: { X: 1.05, Y: 1.1, Z: 1.2 },
  C: { X: 1.0, Y: 1.05, Z: 1.1 },
};

function resolveSafetyFactor(item: Item): number | null {
  if (!item.abcCategory || !item.xyzCategory) return null;
  return SAFETY_FACTOR_MATRIX[item.abcCategory]?.[item.xyzCategory] ?? null;
}

// Seasonal factor — approximated client-side from current month and ABC/XYZ.
// Z-class items get a slightly higher seasonal multiplier in mid-year months,
// matching the API blending logic until the field is exposed in GetById.
function resolveSeasonalFactor(item: Item): number {
  const month = new Date().getMonth() + 1; // 1..12
  const isPeakMonth = month >= 4 && month <= 9;
  if (item.xyzCategory === "Z") return isPeakMonth ? 1.2 : 1.0;
  if (item.xyzCategory === "Y") return isPeakMonth ? 1.1 : 1.0;
  return 1.0;
}

function formatNumber(value: number | null | undefined, suffix = ""): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const formatted = value.toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
  return suffix ? `${formatted} ${suffix}` : formatted;
}

function formatFactor(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatTrend(trend: number | null | undefined) {
  if (trend == null || !Number.isFinite(trend)) {
    return {
      label: "Estável",
      symbol: "→",
      icon: IconMinus,
      color: "text-muted-foreground",
    };
  }
  if (trend > 1) {
    return {
      label: `+${trend.toFixed(0)}%`,
      symbol: "↑",
      icon: IconTrendingUp,
      color: "text-orange-500",
    };
  }
  if (trend < -1) {
    return {
      label: `${trend.toFixed(0)}%`,
      symbol: "↓",
      icon: IconTrendingDown,
      color: "text-blue-500",
    };
  }
  return {
    label: "Estável",
    symbol: "→",
    icon: IconMinus,
    color: "text-muted-foreground",
  };
}

export function CalculationBreakdownCard({ item, className, scheduledNextOrder }: CalculationBreakdownCardProps) {
  const trend = formatTrend(item.monthlyConsumptionTrendPercent);
  const TrendIcon = trend.icon;

  const safetyFactor = resolveSafetyFactor(item);
  const seasonalFactor = resolveSeasonalFactor(item);

  const monthlyConsumption = item.monthlyConsumption ?? 0;
  const dailyConsumption = monthlyConsumption / 30;
  const leadTimeDays = item.estimatedLeadTime ?? 0;
  const safetyMultiplier = safetyFactor ?? 1.0;
  const seasonalMultiplier = seasonalFactor ?? 1.0;

  // Derivation: reorderPoint = dailyConsumption × leadTimeDays × seasonal × safety
  const reorderFormulaText =
    leadTimeDays > 0 && monthlyConsumption > 0
      ? `${formatNumber(dailyConsumption)} × ${leadTimeDays}d × ${formatFactor(seasonalMultiplier)} × ${formatFactor(safetyMultiplier)} = ${formatNumber(item.reorderPoint)}`
      : "—";

  // Derivation: maxQuantity = reorderPoint + dailyConsumption × cycleDays × seasonal
  // cycleDays default = 60 (two-month buffer per spec §15)
  const cycleDays = 60;
  const maxFormulaText =
    item.reorderPoint != null && monthlyConsumption > 0
      ? `${formatNumber(item.reorderPoint)} + (${formatNumber(dailyConsumption)} × ${cycleDays}d × ${formatFactor(seasonalMultiplier)}) = ${formatNumber(item.maxQuantity)}`
      : "—";

  const abcXyzKey =
    item.abcCategory && item.xyzCategory ? `${item.abcCategory}-${item.xyzCategory}` : null;
  const abcXyzExplanation = abcXyzKey ? ABC_XYZ_EXPLANATIONS[abcXyzKey] : null;

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
          Valores calculados automaticamente a partir do consumo e do tempo de entrega.
        </p>
      </CardHeader>
      <CardContent className="pt-0 flex-1 space-y-6">
            {/* Inputs do cálculo */}
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <IconClipboardList className="h-4 w-4 text-muted-foreground" />
                Dados de entrada
              </h4>
              <p className="text-xs text-muted-foreground mb-3">
                Valores observados que alimentam o cálculo.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/50 border-0">
                  <div className="text-xs text-muted-foreground mb-1">Consumo mensal</div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground">
                      {formatNumber(item.monthlyConsumption, "/ mês")}
                    </span>
                    <span className={cn("flex items-center gap-1 text-sm", trend.color)}>
                      <TrendIcon className="h-4 w-4" />
                      <span className="font-mono">{trend.symbol}</span>
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
                          <span className="text-xs text-muted-foreground">
                            #{item.abcCategoryOrder}
                          </span>
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
                          <span className="text-xs text-muted-foreground">
                            #{item.xyzCategoryOrder}
                          </span>
                        )}
                      </div>
                    ) : (
                      "—"
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Fatores aplicados */}
            <div className="pt-6 border-t border-border">
              <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <IconCalculator className="h-4 w-4 text-muted-foreground" />
                Fatores aplicados
              </h4>
              <p className="text-xs text-muted-foreground mb-3">
                Multiplicadores que ajustam o cálculo conforme criticidade e sazonalidade.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-muted/50 border-0">
                  <div className="text-xs text-muted-foreground mb-1">Fator de segurança</div>
                  <div className="font-semibold text-foreground">
                    {formatFactor(safetyFactor)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border-0">
                  <div className="text-xs text-muted-foreground mb-1">Fator sazonal</div>
                  <div className="font-semibold text-foreground">
                    {formatFactor(seasonalFactor)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border-0">
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    Classificação ABC / XYZ
                    {abcXyzExplanation && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex"
                              onClick={(e) => e.stopPropagation()}
                              aria-label="Explicação ABC/XYZ"
                            >
                              <IconHelpCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            {abcXyzExplanation}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  <div className="font-semibold text-foreground">
                    {abcXyzKey ?? "—"}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border-0 md:col-span-3">
                  <div className="text-xs text-muted-foreground mb-1">Tendência de consumo</div>
                  <div className={cn("font-semibold flex items-center gap-2", trend.color)}>
                    <span className="font-mono text-lg">{trend.symbol}</span>
                    <span>{trend.label}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Resultados do cálculo */}
            <div className="pt-6 border-t border-border">
              <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <IconCalculator className="h-4 w-4 text-primary" />
                Valores calculados
              </h4>
              <p className="text-xs text-muted-foreground mb-3">
                Resultado da fórmula com os dados acima.
              </p>
              <div className="space-y-3">
                <div className="bg-muted/50 rounded-lg px-4 py-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      Ponto de reposição
                    </span>
                    <span className="font-semibold text-base text-foreground">
                      {formatNumber(item.reorderPoint)}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {reorderFormulaText}
                  </div>
                </div>
                <div className="bg-muted/50 rounded-lg px-4 py-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      Quantidade máxima
                    </span>
                    <span className="font-semibold text-base text-foreground">
                      {formatNumber(item.maxQuantity)}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {maxFormulaText}
                  </div>
                </div>
                {scheduledNextOrder ? (
                  <div className="flex items-center justify-between gap-4 bg-primary/5 rounded-lg px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-foreground">Próximo pedido (agendamento)</span>
                      <span className="text-xs text-muted-foreground">
                        {scheduledNextOrder.scheduleName ? `${scheduledNextOrder.scheduleName}` : "Agendamento ativo"}
                        {scheduledNextOrder.nextRun ? ` · ${formatDate(new Date(scheduledNextOrder.nextRun))}` : ""}
                      </span>
                    </div>
                    <span className="font-semibold text-base text-primary whitespace-nowrap">
                      {formatNumber(scheduledNextOrder.quantity)}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-primary/5 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium text-muted-foreground">
                      Quantidade sugerida para o próximo pedido
                    </span>
                    <span className="font-semibold text-base text-primary">
                      {formatNumber(item.reorderQuantity)}
                    </span>
                  </div>
                )}
              </div>
            </div>
      </CardContent>
    </Card>
  );
}
