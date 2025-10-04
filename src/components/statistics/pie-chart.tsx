import React from "react";
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  LabelList,
} from "recharts";
import { BaseChart, BaseChartProps, chartColors, chartConfig, formatChartValue } from "./base-chart";

export interface PieChartData {
  name: string;
  value: number;
  color?: string;
  [key: string]: any;
}

export interface PieConfig {
  dataKey?: string;
  nameKey?: string;
  cx?: string | number;
  cy?: string | number;
  innerRadius?: number;
  outerRadius?: number;
  startAngle?: number;
  endAngle?: number;
  paddingAngle?: number;
  showLabels?: boolean;
  labelPosition?: "inside" | "outside" | "center";
  stroke?: string;
  strokeWidth?: number;
}

export interface PieChartProps extends Omit<BaseChartProps, "children"> {
  data: PieChartData[];
  config?: PieConfig;
  type?: "pie" | "donut";
  showLegend?: boolean;
  showLabels?: boolean;
  showValues?: boolean;
  showPercentages?: boolean;
  tooltipFormatter?: (value: any, name: string) => [string, string];
  labelFormatter?: (value: any, name: string, entry: any) => string;
  valueType?: "currency" | "percentage" | "number";
  legendPosition?: "top" | "bottom" | "left" | "right";
  minAngleForLabel?: number; // Don't show labels for slices smaller than this angle
  customColors?: string[];
  sortData?: boolean;
  maxSlices?: number; // Group smaller slices into "Others"
}

export function PieChart({
  data,
  config = {},
  type = "pie",
  showLegend = true,
  showLabels = true,
  showValues = true,
  showPercentages = false,
  tooltipFormatter,
  labelFormatter,
  valueType = "number",
  legendPosition = "bottom",
  minAngleForLabel = 5,
  customColors,
  sortData = true,
  maxSlices = 8,
  height = 400,
  ...baseProps
}: PieChartProps) {
  const {
    dataKey = "value",
    nameKey = "name",
    cx = "50%",
    cy = "50%",
    innerRadius = type === "donut" ? 60 : 0,
    outerRadius = Math.min(height * 0.35, 120),
    startAngle = 90,
    endAngle = 450,
    paddingAngle = 2,
    stroke = "#fff",
    strokeWidth = 2,
  } = config;

  // Process data: sort and group small slices
  const processedData = React.useMemo(() => {
    let result = [...data];

    // Sort data by value if requested
    if (sortData) {
      result = result.sort((a, b) => b.value - a.value);
    }

    // Group smaller slices into "Others" if there are too many
    if (maxSlices && result.length > maxSlices) {
      const mainSlices = result.slice(0, maxSlices - 1);
      const otherSlices = result.slice(maxSlices - 1);
      const othersValue = otherSlices.reduce((sum, item) => sum + item.value, 0);

      if (othersValue > 0) {
        result = [
          ...mainSlices,
          {
            name: "Outros",
            value: othersValue,
            color: "#9CA3AF",
            isOthers: true,
          },
        ];
      }
    }

    return result;
  }, [data, sortData, maxSlices]);

  const total = processedData.reduce((sum, item) => sum + item.value, 0);

  const getSliceColor = (index: number, item: PieChartData): string => {
    if (item.color) return item.color;
    if (customColors) return customColors[index % customColors.length];
    return chartColors.rainbow[index % chartColors.rainbow.length];
  };

  const defaultTooltipFormatter = (value: any, name: string): [string, string] => {
    const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : "0";
    const formattedValue = formatChartValue(value, valueType);
    return [`${formattedValue} (${percentage}%)`, name];
  };

  const defaultLabelFormatter = (value: any, name: string, entry: any): string => {
    if (!showLabels) return "";

    const percentage = total > 0 ? ((value / total) * 100) : 0;

    // Don't show label for small slices
    if (percentage < minAngleForLabel) return "";

    if (showPercentages && showValues) {
      return `${percentage.toFixed(1)}%\n${formatChartValue(value, valueType)}`;
    } else if (showPercentages) {
      return `${percentage.toFixed(1)}%`;
    } else if (showValues) {
      return formatChartValue(value, valueType);
    }

    return name;
  };

  // Custom label component for better positioning
  const CustomLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    value,
    name,
    index,
    ...props
  }: any) => {
    const entry = processedData[index];
    const percentage = total > 0 ? ((value / total) * 100) : 0;

    // Don't render label for small slices
    if (percentage < minAngleForLabel) return null;

    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    const labelText = labelFormatter
      ? labelFormatter(value, name, entry)
      : defaultLabelFormatter(value, name, entry);

    if (!labelText) return null;

    const lines = labelText.split('\n');

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central"
        className="text-xs font-medium"
        style={{ filter: "drop-shadow(1px 1px 1px rgba(0,0,0,0.5))" }}
      >
        {lines.map((line, i) => (
          <tspan key={i} x={x} dy={i === 0 ? 0 : "1.2em"}>
            {line}
          </tspan>
        ))}
      </text>
    );
  };

  // Custom legend content
  const CustomLegend = (props: any) => {
    const { payload } = props;

    return (
      <div className={`flex ${legendPosition === "bottom" || legendPosition === "top"
        ? "flex-wrap justify-center gap-x-4 gap-y-2"
        : "flex-col gap-2"
      } mt-4`}>
        {payload.map((entry: any, index: number) => {
          const item = processedData[index];
          const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : "0";

          return (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-foreground">
                {entry.value}: {formatChartValue(item.value, valueType)} ({percentage}%)
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <BaseChart height={height} {...baseProps}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsPieChart>
          <Pie
            data={processedData}
            cx={cx}
            cy={cy}
            labelLine={false}
            label={showLabels ? CustomLabel : false}
            outerRadius={outerRadius}
            innerRadius={innerRadius}
            startAngle={startAngle}
            endAngle={endAngle}
            paddingAngle={paddingAngle}
            fill="#8884d8"
            dataKey={dataKey}
            nameKey={nameKey}
            stroke={stroke}
            strokeWidth={strokeWidth}
          >
            {processedData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={getSliceColor(index, entry)}
              />
            ))}
          </Pie>

          <Tooltip
            formatter={tooltipFormatter || defaultTooltipFormatter}
            contentStyle={chartConfig.tooltip.contentStyle}
            labelStyle={chartConfig.tooltip.labelStyle}
          />

          {showLegend && (
            <Legend
              content={CustomLegend}
              wrapperStyle={chartConfig.legend.wrapperStyle}
            />
          )}
        </RechartsPieChart>
      </ResponsiveContainer>
    </BaseChart>
  );
}

// Preset configurations for common use cases
export const PieChartPresets = {
  // Simple pie chart
  simple: (data: PieChartData[]): Partial<PieChartProps> => ({
    type: "pie",
    showLabels: true,
    showPercentages: true,
  }),

  // Donut chart
  donut: (data: PieChartData[]): Partial<PieChartProps> => ({
    type: "donut",
    showLabels: true,
    showPercentages: true,
  }),

  // Financial breakdown
  financial: (data: PieChartData[]): Partial<PieChartProps> => ({
    type: "donut",
    valueType: "currency" as const,
    showValues: true,
    showPercentages: true,
    customColors: chartColors.success,
  }),

  // Status distribution
  status: (data: PieChartData[]): Partial<PieChartProps> => ({
    type: "pie",
    showPercentages: true,
    customColors: [
      chartColors.success[0], // Active/Completed
      chartColors.warning[0], // Pending/In Progress
      chartColors.danger[0],  // Error/Cancelled
      chartColors.neutral[0], // Others
    ],
  }),

  // Category breakdown with legend on side
  category: (data: PieChartData[]): Partial<PieChartProps> => ({
    type: "donut",
    legendPosition: "right" as const,
    showLabels: false,
    showValues: true,
    maxSlices: 6,
  }),

  // Minimal chart without labels
  minimal: (data: PieChartData[]): Partial<PieChartProps> => ({
    type: "pie",
    showLabels: false,
    showLegend: true,
    legendPosition: "bottom" as const,
  }),
};

// Example usage component for documentation
export function PieChartExample() {
  const statusData = [
    { name: "Concluído", value: 45, color: chartColors.success[0] },
    { name: "Em Andamento", value: 30, color: chartColors.warning[0] },
    { name: "Pendente", value: 20, color: chartColors.primary[0] },
    { name: "Cancelado", value: 5, color: chartColors.danger[0] },
  ];

  const categoryData = [
    { name: "Categoria A", value: 2400 },
    { name: "Categoria B", value: 1398 },
    { name: "Categoria C", value: 980 },
    { name: "Categoria D", value: 390 },
    { name: "Categoria E", value: 480 },
    { name: "Categoria F", value: 200 },
    { name: "Categoria G", value: 150 },
    { name: "Categoria H", value: 100 },
    { name: "Categoria I", value: 80 },
  ];

  const expenseData = [
    { name: "Matéria Prima", value: 45000 },
    { name: "Mão de Obra", value: 25000 },
    { name: "Equipamentos", value: 15000 },
    { name: "Transporte", value: 8000 },
    { name: "Outros", value: 7000 },
  ];

  return (
    <div className="space-y-6">
      {/* Simple Pie Chart */}
      <PieChart
        title="Status dos Projetos"
        description="Distribuição dos projetos por status"
        data={statusData}
        type="pie"
        showPercentages
        showValues={false}
      />

      {/* Donut Chart */}
      <PieChart
        title="Distribuição de Categorias"
        description="Produtos agrupados por categoria (máximo 8 categorias)"
        data={categoryData}
        type="donut"
        maxSlices={8}
        showLabels={false}
        legendPosition="right"
      />

      {/* Financial Donut Chart */}
      <PieChart
        title="Distribuição de Gastos"
        description="Breakdown dos gastos mensais por categoria"
        data={expenseData}
        type="donut"
        valueType="currency"
        showPercentages
        showValues
        customColors={[
          chartColors.primary[0],
          chartColors.success[0],
          chartColors.warning[0],
          chartColors.purple[0],
          chartColors.neutral[0],
        ]}
      />

      {/* Minimal Chart */}
      <PieChart
        title="Gráfico Simples"
        description="Visualização limpa sem labels nos segmentos"
        data={statusData}
        type="pie"
        showLabels={false}
        showLegend
        legendPosition="bottom"
      />
    </div>
  );
}