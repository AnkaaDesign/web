/**
 * Comparison View Component
 *
 * Side-by-side comparison of two time periods with:
 * - Dual charts
 * - Difference highlighting
 * - Percentage changes
 * - Visual indicators
 */

import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendIndicator } from "./TrendIndicator";
import { cn } from "@/lib/utils";
import { formatKPIValue, type KPIData } from "../utils/dashboard-helpers";

export interface ComparisonPeriod {
  /**
   * Period label (e.g., "Este mês", "Mês anterior")
   */
  label: string;

  /**
   * Period data
   */
  data: any;

  /**
   * Optional chart content
   */
  chart?: ReactNode;
}

export interface ComparisonViewProps {
  /**
   * Title for comparison
   */
  title: string;

  /**
   * First period (usually current/recent)
   */
  periodA: ComparisonPeriod;

  /**
   * Second period (usually previous)
   */
  periodB: ComparisonPeriod;

  /**
   * Metrics to compare
   */
  metrics: Array<{
    key: string;
    label: string;
    format?: "number" | "currency" | "percentage";
    unit?: string;
    higherIsBetter?: boolean;
  }>;

  /**
   * Show difference column
   */
  showDifference?: boolean;

  /**
   * Show charts
   */
  showCharts?: boolean;

  /**
   * Additional className
   */
  className?: string;
}

/**
 * Comparison View Component
 *
 * Displays side-by-side comparison of two time periods with metrics
 * and visual indicators.
 */
export function ComparisonView({
  title,
  periodA,
  periodB,
  metrics,
  showDifference = true,
  showCharts = true,
  className,
}: ComparisonViewProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Metrics Comparison Table */}
        <div className="space-y-3">
          {/* Header Row */}
          <div className="grid grid-cols-12 gap-4 pb-2 border-b font-medium text-sm">
            <div className="col-span-3">Métrica</div>
            <div className="col-span-3 text-center">{periodA.label}</div>
            <div className="col-span-3 text-center">{periodB.label}</div>
            {showDifference && (
              <div className="col-span-3 text-center">Diferença</div>
            )}
          </div>

          {/* Metric Rows */}
          {metrics.map((metric) => {
            const valueA = periodA.data[metric.key] ?? 0;
            const valueB = periodB.data[metric.key] ?? 0;
            const difference = valueA - valueB;
            const percentageChange = valueB !== 0
              ? (difference / valueB) * 100
              : 0;

            return (
              <div
                key={metric.key}
                className="grid grid-cols-12 gap-4 py-2 items-center hover:bg-accent/50 rounded-md transition-colors"
              >
                {/* Metric Label */}
                <div className="col-span-3 text-sm font-medium">
                  {metric.label}
                </div>

                {/* Period A Value */}
                <div className="col-span-3 text-center font-semibold">
                  {formatKPIValue(valueA, metric.format, metric.unit)}
                </div>

                {/* Period B Value */}
                <div className="col-span-3 text-center text-muted-foreground">
                  {formatKPIValue(valueB, metric.format, metric.unit)}
                </div>

                {/* Difference */}
                {showDifference && (
                  <div className="col-span-3 flex items-center justify-center">
                    <TrendIndicator
                      current={valueA}
                      previous={valueB}
                      higherIsBetter={metric.higherIsBetter}
                      showPercentage={true}
                      showArrow={true}
                      size="sm"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Charts Side-by-Side */}
        {showCharts && (periodA.chart || periodB.chart) && (
          <div className="grid grid-cols-2 gap-4 mt-6">
            {/* Period A Chart */}
            {periodA.chart && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-center">
                  {periodA.label}
                </h4>
                <div className="border rounded-lg p-4">
                  {periodA.chart}
                </div>
              </div>
            )}

            {/* Period B Chart */}
            {periodB.chart && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-center">
                  {periodB.label}
                </h4>
                <div className="border rounded-lg p-4">
                  {periodB.chart}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
