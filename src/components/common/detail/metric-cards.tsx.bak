import type { ComponentType } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { IconTrendingUp, IconTrendingDown, IconMinus } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface MetricCard {
  title: string;
  value: string | number;
  previousValue?: string | number;
  format?: "number" | "currency" | "percentage";
  icon?: ComponentType<{ className?: string }>;
  trend?: "up" | "down" | "stable";
  trendValue?: string;
  description?: string;
  variant?: "default" | "success" | "warning" | "danger";
}

interface MetricCardsProps {
  metrics: MetricCard[];
  columns?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}

export const MetricCards = ({ metrics, columns = 4, className }: MetricCardsProps) => {
  const getTrendIcon = (trend?: string) => {
    switch (trend) {
      case "up":
        return IconTrendingUp;
      case "down":
        return IconTrendingDown;
      default:
        return IconMinus;
    }
  };

  const getTrendColor = (trend?: string, variant?: string) => {
    if (variant) {
      switch (variant) {
        case "success":
          return "text-green-600";
        case "warning":
          return "text-yellow-600";
        case "danger":
          return "text-red-600";
        default:
          return "text-muted-foreground";
      }
    }

    switch (trend) {
      case "up":
        return "text-green-600";
      case "down":
        return "text-red-600";
      default:
        return "text-muted-foreground";
    }
  };

  const formatValue = (value: string | number, format?: string) => {
    if (typeof value === "string") return value;

    switch (format) {
      case "currency":
        return new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(value);
      case "percentage":
        return `${value}%`;
      case "number":
      default:
        return value.toLocaleString("pt-BR");
    }
  };

  return (
    <div
      className={cn(
        "grid gap-4",
        columns === 2 && "grid-cols-1 sm:grid-cols-2",
        columns === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        columns === 4 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
        columns === 5 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-5",
        columns === 6 && "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
        className,
      )}
    >
      {metrics.map((metric, index) => {
        const TrendIcon = getTrendIcon(metric.trend);
        const MetricIcon = metric.icon;

        return (
          <Card key={index} className="overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {MetricIcon && (
                    <div className="p-2 bg-muted rounded-lg">
                      <MetricIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <h3 className="text-sm font-medium text-muted-foreground">{metric.title}</h3>
                </div>
              </div>

              <div className="space-y-2">
                <p
                  className={cn(
                    "text-2xl font-bold",
                    metric.variant === "success" && "text-green-600",
                    metric.variant === "warning" && "text-yellow-600",
                    metric.variant === "danger" && "text-red-600",
                  )}
                >
                  {formatValue(metric.value, metric.format)}
                </p>

                {(metric.trend || metric.trendValue) && (
                  <div className="flex items-center gap-2">
                    <div className={cn("flex items-center gap-1", getTrendColor(metric.trend, metric.variant))}>
                      <TrendIcon className="h-4 w-4" />
                      {metric.trendValue && <span className="text-sm font-medium">{metric.trendValue}</span>}
                    </div>
                    {metric.previousValue && <span className="text-xs text-muted-foreground">desde {formatValue(metric.previousValue, metric.format)}</span>}
                  </div>
                )}

                {metric.description && <p className="text-xs text-muted-foreground">{metric.description}</p>}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
