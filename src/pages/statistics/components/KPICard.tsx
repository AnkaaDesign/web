/**
 * KPI Card Component
 *
 * Displays a single Key Performance Indicator with:
 * - Current value
 * - Change indicator (up/down, percentage)
 * - Sparkline trend
 * - Click to drill-down
 * - Color coding (good/warning/bad)
 */

import { Card, CardContent } from "@/components/ui/card";
import { IconTrendingUp, IconTrendingDown, IconMinus } from "@tabler/icons-react";
import type { IconProps } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import {
  formatKPIValue,
  getChangeIndicator,
  getKPIStatus,
  type KPIData,
} from "../utils/dashboard-helpers";

export interface KPICardProps {
  title: string;
  data: KPIData;
  icon: React.ComponentType<IconProps>;
  onClick?: () => void;
  className?: string;
  loading?: boolean;
}

/**
 * KPI Card Component
 */
export function KPICard({
  title,
  data,
  icon: Icon,
  onClick,
  className,
  loading = false,
}: KPICardProps) {
  const change = data.previous !== undefined
    ? getChangeIndicator(data.current, data.previous)
    : null;

  const status = getKPIStatus(data);

  const statusColors = {
    success: "text-green-600 dark:text-green-400",
    warning: "text-yellow-600 dark:text-yellow-400",
    danger: "text-red-600 dark:text-red-400",
  };

  const trendColors = {
    up: change?.isPositive ? "text-green-600" : "text-red-600",
    down: change?.isPositive ? "text-green-600" : "text-red-600",
    neutral: "text-gray-600",
  };

  if (loading) {
    return (
      <Card className={cn("transition-all hover:shadow-md", className)}>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-2/3"></div>
            <div className="h-8 bg-muted rounded w-1/2"></div>
            <div className="h-3 bg-muted rounded w-1/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "transition-all hover:shadow-md",
        onClick && "cursor-pointer hover:border-primary",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground mb-2">
              {title}
            </p>
            <h3 className={cn("text-2xl font-bold mb-2", statusColors[status])}>
              {formatKPIValue(data.current, data.format, data.unit)}
            </h3>

            {change && (
              <div className="flex items-center gap-1 text-sm">
                {change.trend === "up" && (
                  <IconTrendingUp className={cn("h-4 w-4", trendColors.up)} />
                )}
                {change.trend === "down" && (
                  <IconTrendingDown className={cn("h-4 w-4", trendColors.down)} />
                )}
                {change.trend === "neutral" && (
                  <IconMinus className={cn("h-4 w-4", trendColors.neutral)} />
                )}
                <span className={cn(
                  "font-medium",
                  change.trend !== "neutral" ? trendColors[change.trend] : "text-muted-foreground"
                )}>
                  {change.percentage > 0 ? "+" : ""}
                  {change.percentage.toFixed(1)}%
                </span>
                <span className="text-muted-foreground">vs anterior</span>
              </div>
            )}

            {data.target && (
              <div className="mt-2">
                <div className="text-xs text-muted-foreground mb-1">
                  Meta: {formatKPIValue(data.target, data.format, data.unit)}
                </div>
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      status === "success" && "bg-green-600",
                      status === "warning" && "bg-yellow-600",
                      status === "danger" && "bg-red-600"
                    )}
                    style={{
                      width: `${Math.min(100, (data.current / data.target) * 100)}%`,
                    }}
                  ></div>
                </div>
              </div>
            )}
          </div>

          <div className="ml-4">
            <Icon className={cn("h-8 w-8", statusColors[status])} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
