import React from "react";
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
  Dot,
} from "recharts";
import { BaseChart, BaseChartProps, chartColors, chartConfig, formatChartValue } from "./base-chart";

export interface LineChartData {
  name: string;
  [key: string]: any;
}

export interface LineConfig {
  dataKey: string;
  name?: string;
  color?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  dot?: boolean | React.ReactElement;
  activeDot?: boolean | React.ReactElement;
  connectNulls?: boolean;
  area?: boolean; // Whether to fill area under the line
  areaOpacity?: number;
}

export interface LineChartProps extends Omit<BaseChartProps, "children"> {
  data: LineChartData[];
  lines: LineConfig[];
  xAxisKey?: string;
  showGrid?: boolean;
  showLegend?: boolean;
  showDots?: boolean;
  smooth?: boolean;
  referenceLines?: Array<{
    value: number;
    label?: string;
    color?: string;
    orientation?: "horizontal" | "vertical";
  }>;
  xAxisFormatter?: (value: any) => string;
  yAxisFormatter?: (value: any) => string;
  tooltipFormatter?: (value: any, name: string) => [string, string];
  valueType?: "currency" | "percentage" | "number";
  connectNulls?: boolean;
  strokeWidth?: number;
  chartType?: "line" | "area" | "composed"; // Type of chart to render
}

export function LineChart({
  data,
  lines,
  xAxisKey = "name",
  showGrid = true,
  showLegend = true,
  showDots = true,
  smooth = false,
  referenceLines = [],
  xAxisFormatter,
  yAxisFormatter,
  tooltipFormatter,
  valueType = "number",
  connectNulls = false,
  strokeWidth = 2,
  chartType = "line",
  height = 400,
  ...baseProps
}: LineChartProps) {
  const getLineColor = (index: number, customColor?: string): string => {
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

  // Custom dot component
  const CustomDot = (props: any) => {
    const { cx, cy, fill, payload, dataKey } = props;

    // You can customize dot appearance based on data
    if (payload && payload[dataKey] === null) {
      return null; // Don't render dot for null values
    }

    return <Dot cx={cx} cy={cy} r={4} fill={fill} stroke="#fff" strokeWidth={2} />;
  };

  // Custom active dot component
  const CustomActiveDot = (props: any) => {
    const { cx, cy, fill } = props;
    return (
      <Dot
        cx={cx}
        cy={cy}
        r={6}
        fill={fill}
        stroke="#fff"
        strokeWidth={3}
        style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))" }}
      />
    );
  };

  const ChartComponent = chartType === "composed" ? ComposedChart : RechartsLineChart;

  return (
    <BaseChart height={height} {...baseProps}>
      <ResponsiveContainer width="100%" height="100%">
        <ChartComponent data={data} margin={chartConfig.margin}>
          {showGrid && (
            <CartesianGrid
              strokeDasharray={chartConfig.grid.strokeDasharray}
              stroke={chartConfig.grid.stroke}
            />
          )}

          <XAxis
            dataKey={xAxisKey}
            tick={{ ...chartConfig.axis }}
            tickFormatter={xAxisFormatter || defaultXAxisFormatter}
            interval={0}
            angle={-45}
            textAnchor="end"
            height={60}
          />

          <YAxis
            tick={{ ...chartConfig.axis }}
            tickFormatter={yAxisFormatter || defaultYAxisFormatter}
            width={80}
          />

          <Tooltip
            formatter={tooltipFormatter || defaultTooltipFormatter}
            labelFormatter={(label) => `${xAxisKey === "name" ? "Período" : "Categoria"}: ${label}`}
            contentStyle={chartConfig.tooltip.contentStyle}
            labelStyle={chartConfig.tooltip.labelStyle}
          />

          {showLegend && (
            <Legend
              wrapperStyle={chartConfig.legend.wrapperStyle}
              iconType="line"
            />
          )}

          {/* Reference Lines */}
          {referenceLines.map((line, index) => (
            <ReferenceLine
              key={index}
              {...(line.orientation === "vertical" ? { x: line.value } : { y: line.value })}
              stroke={line.color || "#9CA3AF"}
              strokeDasharray="5 5"
              label={{
                value: line.label || formatChartValue(line.value, valueType),
                position: line.orientation === "vertical" ? "top" : "left",
              }}
            />
          ))}

          {/* Lines */}
          {lines.map((line, index) => {
            const color = line.color || getLineColor(index);

            if (chartType === "composed" && line.area) {
              return (
                <Area
                  key={`area-${line.dataKey}`}
                  type={smooth ? "monotone" : "linear"}
                  dataKey={line.dataKey}
                  name={line.name || line.dataKey}
                  stroke={color}
                  fill={color}
                  fillOpacity={line.areaOpacity || 0.3}
                  strokeWidth={line.strokeWidth || strokeWidth}
                  strokeDasharray={line.strokeDasharray}
                  connectNulls={line.connectNulls ?? connectNulls}
                  dot={
                    showDots && (line.dot !== false)
                      ? line.dot === true || line.dot === undefined
                        ? <CustomDot />
                        : line.dot
                      : false
                  }
                  activeDot={
                    line.activeDot !== false
                      ? line.activeDot === true || line.activeDot === undefined
                        ? <CustomActiveDot />
                        : line.activeDot
                      : false
                  }
                />
              );
            }

            return (
              <Line
                key={line.dataKey}
                type={smooth ? "monotone" : "linear"}
                dataKey={line.dataKey}
                name={line.name || line.dataKey}
                stroke={color}
                strokeWidth={line.strokeWidth || strokeWidth}
                strokeDasharray={line.strokeDasharray}
                connectNulls={line.connectNulls ?? connectNulls}
                dot={
                  showDots && (line.dot !== false)
                    ? line.dot === true || line.dot === undefined
                      ? <CustomDot />
                      : line.dot
                    : false
                }
                activeDot={
                  line.activeDot !== false
                    ? line.activeDot === true || line.activeDot === undefined
                      ? <CustomActiveDot />
                      : line.activeDot
                    : false
                }
              />
            );
          })}
        </ChartComponent>
      </ResponsiveContainer>
    </BaseChart>
  );
}

// Preset configurations for common use cases
export const LineChartPresets = {
  // Simple single line chart
  simple: (data: LineChartData[], dataKey: string = "value"): Partial<LineChartProps> => ({
    lines: [{ dataKey, color: chartColors.primary[0] }],
    showLegend: false,
  }),

  // Multi-line comparison chart
  comparison: (data: LineChartData[], keys: string[]): Partial<LineChartProps> => ({
    lines: keys.map((key, index) => ({
      dataKey: key,
      name: key,
      color: chartColors.rainbow[index % chartColors.rainbow.length],
    })),
  }),

  // Trend analysis with area fill
  trend: (data: LineChartData[], dataKey: string = "value"): Partial<LineChartProps> => ({
    lines: [{
      dataKey,
      color: chartColors.primary[0],
      area: true,
      areaOpacity: 0.2,
    }],
    chartType: "composed" as const,
    smooth: true,
    showLegend: false,
  }),

  // Performance chart with target line
  performance: (
    data: LineChartData[],
    dataKey: string = "value",
    target: number
  ): Partial<LineChartProps> => ({
    lines: [{
      dataKey,
      color: chartColors.primary[0],
      strokeWidth: 3,
    }],
    referenceLines: [{ value: target, label: "Meta", color: chartColors.success[0] }],
    showLegend: false,
    valueType: "number" as const,
  }),

  // Financial time series
  financial: (data: LineChartData[], dataKey: string = "value"): Partial<LineChartProps> => ({
    lines: [{
      dataKey,
      color: chartColors.success[0],
      strokeWidth: 2,
      area: true,
      areaOpacity: 0.1,
    }],
    chartType: "composed" as const,
    valueType: "currency" as const,
    smooth: true,
    showLegend: false,
  }),

  // Dotted line for predictions
  prediction: (data: LineChartData[], actualKey: string, predictedKey: string): Partial<LineChartProps> => ({
    lines: [
      {
        dataKey: actualKey,
        name: "Real",
        color: chartColors.primary[0],
        strokeWidth: 2,
      },
      {
        dataKey: predictedKey,
        name: "Previsto",
        color: chartColors.warning[0],
        strokeWidth: 2,
        strokeDasharray: "5 5",
      },
    ],
    connectNulls: true,
  }),

  // Multi-metric dashboard
  dashboard: (data: LineChartData[], metrics: string[]): Partial<LineChartProps> => ({
    lines: metrics.map((metric, index) => ({
      dataKey: metric,
      name: metric,
      color: chartColors.rainbow[index % chartColors.rainbow.length],
      strokeWidth: 2,
    })),
    smooth: true,
    showDots: false,
  }),
};

// Example usage component for documentation
export function LineChartExample() {
  const sampleData = [
    { name: "Jan", vendas: 4000, meta: 3500, previsao: 3800 },
    { name: "Fev", vendas: 3000, meta: 3500, previsao: 3200 },
    { name: "Mar", vendas: 5000, meta: 3500, previsao: 4800 },
    { name: "Abr", vendas: 4500, meta: 3500, previsao: 4300 },
    { name: "Mai", vendas: 6000, meta: 3500, previsao: 5800 },
    { name: "Jun", vendas: 5500, meta: 3500, previsao: 5300 },
    { name: "Jul", vendas: null, meta: 3500, previsao: 5600 },
    { name: "Ago", vendas: null, meta: 3500, previsao: 5900 },
  ];

  const stockData = [
    { name: "Jan", estoque: 120000, minimo: 80000 },
    { name: "Fev", estoque: 95000, minimo: 80000 },
    { name: "Mar", estoque: 140000, minimo: 80000 },
    { name: "Abr", estoque: 110000, minimo: 80000 },
    { name: "Mai", estoque: 85000, minimo: 80000 },
    { name: "Jun", estoque: 75000, minimo: 80000 },
  ];

  return (
    <div className="space-y-6">
      {/* Simple Line Chart */}
      <LineChart
        title="Vendas Mensais"
        description="Evolução das vendas ao longo do tempo"
        data={sampleData}
        lines={[{ dataKey: "vendas", name: "Vendas", color: chartColors.primary[0] }]}
        valueType="currency"
        smooth
      />

      {/* Multi-line Chart */}
      <LineChart
        title="Vendas vs Meta vs Previsão"
        description="Comparação entre valores reais, meta e previsão"
        data={sampleData}
        lines={[
          { dataKey: "vendas", name: "Vendas", color: chartColors.primary[0] },
          { dataKey: "meta", name: "Meta", color: chartColors.success[0], strokeDasharray: "5 5" },
          { dataKey: "previsao", name: "Previsão", color: chartColors.warning[0], strokeDasharray: "10 5" },
        ]}
        valueType="currency"
        connectNulls
      />

      {/* Area Chart */}
      <LineChart
        title="Valor do Estoque"
        description="Evolução do valor total do estoque"
        data={stockData}
        lines={[
          {
            dataKey: "estoque",
            name: "Estoque",
            color: chartColors.primary[0],
            area: true,
            areaOpacity: 0.3,
          }
        ]}
        chartType="composed"
        referenceLines={[
          { value: 80000, label: "Estoque Mínimo", color: chartColors.danger[0] }
        ]}
        valueType="currency"
        smooth
        showLegend={false}
      />

      {/* Performance Chart with Dots */}
      <LineChart
        title="Performance com Indicadores"
        description="Gráfico com pontos destacados para eventos importantes"
        data={sampleData}
        lines={[
          {
            dataKey: "vendas",
            name: "Vendas",
            color: chartColors.success[0],
            strokeWidth: 3,
          }
        ]}
        showDots
        valueType="currency"
        referenceLines={[
          { value: 3500, label: "Meta", color: chartColors.neutral[0] }
        ]}
      />
    </div>
  );
}