import React from "react";
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  LabelList,
} from "recharts";
import { BaseChart, BaseChartProps, chartColors, chartConfig, formatChartValue } from "./base-chart";

export interface BarChartData {
  name: string;
  [key: string]: any;
}

export interface BarConfig {
  dataKey: string;
  name?: string;
  color?: string;
  stackId?: string;
  fill?: string;
  showLabel?: boolean;
}

export interface BarChartProps extends Omit<BaseChartProps, "children"> {
  data: BarChartData[];
  bars: BarConfig[];
  xAxisKey?: string;
  orientation?: "horizontal" | "vertical";
  stacked?: boolean;
  showGrid?: boolean;
  showLegend?: boolean;
  showLabels?: boolean;
  referenceLines?: Array<{
    value: number;
    label?: string;
    color?: string;
  }>;
  xAxisFormatter?: (value: any) => string;
  yAxisFormatter?: (value: any) => string;
  tooltipFormatter?: (value: any, name: string) => [string, string];
  valueType?: "currency" | "percentage" | "number";
  maxBarSize?: number;
  layout?: "horizontal" | "vertical";
}

export function BarChart({
  data,
  bars,
  xAxisKey = "name",
  orientation = "vertical",
  stacked = false,
  showGrid = true,
  showLegend = true,
  showLabels = false,
  referenceLines = [],
  xAxisFormatter,
  yAxisFormatter,
  tooltipFormatter,
  valueType = "number",
  maxBarSize = 50,
  layout = "horizontal",
  height = 400,
  ...baseProps
}: BarChartProps) {
  const getBarColor = (index: number, customColor?: string): string => {
    if (customColor) return customColor;
    return chartColors.rainbow[index % chartColors.rainbow.length];
  };

  const defaultTooltipFormatter = (value: any, name: string): [string, string] => {
    return [formatChartValue(value, valueType), name];
  };

  const defaultXAxisFormatter = (value: any): string => {
    if (typeof value === "string" && value.length > 15) {
      return value.substring(0, 12) + "...";
    }
    return String(value);
  };

  const defaultYAxisFormatter = (value: any): string => {
    return formatChartValue(value, valueType);
  };

  const isHorizontal = layout === "horizontal";

  return (
    <BaseChart height={height} {...baseProps}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={data}
          margin={chartConfig.margin}
          layout={layout}
          maxBarSize={maxBarSize}
        >
          {showGrid && (
            <CartesianGrid
              strokeDasharray={chartConfig.grid.strokeDasharray}
              stroke={chartConfig.grid.stroke}
              horizontal={!isHorizontal}
              vertical={isHorizontal}
            />
          )}

          {/* X Axis */}
          <XAxis
            type={isHorizontal ? "number" : "category"}
            dataKey={isHorizontal ? undefined : xAxisKey}
            tick={{ ...chartConfig.axis }}
            tickFormatter={isHorizontal ? (yAxisFormatter || defaultYAxisFormatter) : (xAxisFormatter || defaultXAxisFormatter)}
            interval={isHorizontal ? undefined : 0}
            angle={isHorizontal ? 0 : -45}
            textAnchor={isHorizontal ? "middle" : "end"}
            height={isHorizontal ? 30 : 60}
          />

          {/* Y Axis */}
          <YAxis
            type={isHorizontal ? "category" : "number"}
            dataKey={isHorizontal ? xAxisKey : undefined}
            tick={{ ...chartConfig.axis }}
            tickFormatter={isHorizontal ? (xAxisFormatter || defaultXAxisFormatter) : (yAxisFormatter || defaultYAxisFormatter)}
            width={isHorizontal ? 120 : 60}
          />

          <Tooltip
            formatter={tooltipFormatter || defaultTooltipFormatter}
            labelFormatter={(label) => `${xAxisKey === "name" ? "Categoria" : "Período"}: ${label}`}
            contentStyle={chartConfig.tooltip.contentStyle}
            labelStyle={chartConfig.tooltip.labelStyle}
          />

          {showLegend && (
            <Legend
              wrapperStyle={chartConfig.legend.wrapperStyle}
              iconType="rect"
            />
          )}

          {/* Reference Lines */}
          {referenceLines.map((line, index) => (
            <ReferenceLine
              key={index}
              {...(isHorizontal ? { x: line.value } : { y: line.value })}
              stroke={line.color || "#9CA3AF"}
              strokeDasharray="5 5"
              label={{
                value: line.label || formatChartValue(line.value, valueType),
                position: isHorizontal ? "top" : "left",
              }}
            />
          ))}

          {/* Bars */}
          {bars.map((bar, index) => (
            <Bar
              key={bar.dataKey}
              dataKey={bar.dataKey}
              name={bar.name || bar.dataKey}
              fill={bar.fill || bar.color || getBarColor(index)}
              stackId={stacked ? (bar.stackId || "stack") : undefined}
              radius={[4, 4, 0, 0]}
              stroke="transparent"
              strokeWidth={0}
            >
              {(showLabels || bar.showLabel) && (
                <LabelList
                  dataKey={bar.dataKey}
                  position={isHorizontal ? "right" : "top"}
                  formatter={(value: any) => formatChartValue(value, valueType)}
                  style={{
                    fill: "hsl(var(--muted-foreground))",
                    fontSize: "12px",
                    fontWeight: "500",
                  }}
                />
              )}
            </Bar>
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </BaseChart>
  );
}

// Preset configurations for common use cases
export const BarChartPresets = {
  // Simple single bar chart
  simple: (data: BarChartData[], dataKey: string = "value"): Partial<BarChartProps> => ({
    bars: [{ dataKey, color: chartColors.primary[0] }],
    showLegend: false,
  }),

  // Stacked bar chart
  stacked: (data: BarChartData[], bars: string[]): Partial<BarChartProps> => ({
    bars: bars.map((key, index) => ({
      dataKey: key,
      name: key,
      color: chartColors.rainbow[index % chartColors.rainbow.length],
    })),
    stacked: true,
  }),

  // Horizontal bar chart
  horizontal: (data: BarChartData[], dataKey: string = "value"): Partial<BarChartProps> => ({
    layout: "horizontal",
    bars: [{ dataKey, color: chartColors.primary[0] }],
    showLegend: false,
  }),

  // Comparison chart (two bars)
  comparison: (data: BarChartData[], key1: string, key2: string): Partial<BarChartProps> => ({
    bars: [
      { dataKey: key1, name: key1, color: chartColors.primary[0] },
      { dataKey: key2, name: key2, color: chartColors.success[0] },
    ],
  }),

  // Performance chart with reference line
  performance: (
    data: BarChartData[],
    dataKey: string = "value",
    target: number
  ): Partial<BarChartProps> => ({
    bars: [{ dataKey, color: chartColors.primary[0], showLabel: true }],
    referenceLines: [{ value: target, label: "Meta", color: chartColors.success[0] }],
    showLegend: false,
    valueType: "number" as const,
  }),

  // Financial chart
  financial: (data: BarChartData[], dataKey: string = "value"): Partial<BarChartProps> => ({
    bars: [{ dataKey, color: chartColors.success[0] }],
    valueType: "currency" as const,
    showLabels: true,
    showLegend: false,
  }),
};

// Example usage component for documentation
export function BarChartExample() {
  const sampleData = [
    { name: "Jan", vendas: 4000, meta: 3500 },
    { name: "Fev", vendas: 3000, meta: 3500 },
    { name: "Mar", vendas: 5000, meta: 3500 },
    { name: "Abr", vendas: 4500, meta: 3500 },
    { name: "Mai", vendas: 6000, meta: 3500 },
    { name: "Jun", vendas: 5500, meta: 3500 },
  ];

  return (
    <div className="space-y-6">
      {/* Simple Bar Chart */}
      <BarChart
        title="Vendas Mensais"
        description="Vendas realizadas nos últimos 6 meses"
        data={sampleData}
        bars={[{ dataKey: "vendas", name: "Vendas", color: chartColors.primary[0] }]}
        valueType="currency"
        showLabels
      />

      {/* Comparison Bar Chart */}
      <BarChart
        title="Vendas vs Meta"
        description="Comparação entre vendas realizadas e meta estabelecida"
        data={sampleData}
        bars={[
          { dataKey: "vendas", name: "Vendas", color: chartColors.primary[0] },
          { dataKey: "meta", name: "Meta", color: chartColors.warning[0] },
        ]}
        valueType="currency"
      />

      {/* Horizontal Bar Chart */}
      <BarChart
        title="Ranking de Produtos"
        description="Produtos mais vendidos do mês"
        data={[
          { name: "Produto A", valor: 12000 },
          { name: "Produto B", valor: 9800 },
          { name: "Produto C", valor: 8600 },
          { name: "Produto D", valor: 7200 },
          { name: "Produto E", valor: 6400 },
        ]}
        layout="horizontal"
        bars={[{ dataKey: "valor", color: chartColors.success[0] }]}
        valueType="currency"
        showLabels
        showLegend={false}
      />
    </div>
  );
}