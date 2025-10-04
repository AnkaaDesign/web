import { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts/core";
import {
  BarChart,
  LineChart,
  PieChart,
  RadarChart,
  HeatmapChart,
  TreemapChart,
} from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  ToolboxComponent,
  DataZoomComponent,
  VisualMapComponent,
  RadarComponent,
  PolarComponent,
  AriaComponent,
  DatasetComponent,
  MarkLineComponent,
  MarkPointComponent,
  GraphicComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import ReactEChartsCore from "echarts-for-react/lib/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  IconChartBar,
  IconChartLine,
  IconChartPie,
  IconChartDots,
  IconChartTreemap,
  IconChartRadar,
} from "@tabler/icons-react";
import { formatCurrency } from "../../utils";

// Register ECharts components
echarts.use([
  BarChart,
  LineChart,
  PieChart,
  RadarChart,
  HeatmapChart,
  TreemapChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  ToolboxComponent,
  DataZoomComponent,
  VisualMapComponent,
  RadarComponent,
  PolarComponent,
  AriaComponent,
  DatasetComponent,
  MarkLineComponent,
  MarkPointComponent,
  GraphicComponent,
  CanvasRenderer,
]);

export type ChartType = "bar" | "line" | "pie" | "donut" | "radar" | "treemap" | "area" | "stacked-bar" | "horizontal-bar";

interface ConsumptionDataPoint {
  id: string;
  name: string;
  value: number;
  percentage: number;
  trend?: number;
  color?: string;
  description?: string;
  previousPeriodValue?: number;
}

interface ConsumptionChartProps {
  data: ConsumptionDataPoint[];
  metric: "quantity" | "totalPrice";
  groupBy: "sector" | "user" | "item";
  showPercentages?: boolean;
  showTrend?: boolean;
  showLabels?: "always" | "hover" | "never";
  loading?: boolean;
  height?: number;
  chartType?: ChartType;
  onChartTypeChange?: (type: ChartType) => void;
}

const chartTypeConfig: Record<ChartType, { icon: React.ElementType; label: string; suitable: string[] }> = {
  bar: {
    icon: IconChartBar,
    label: "Barras",
    suitable: ["comparison", "distribution"],
  },
  line: {
    icon: IconChartLine,
    label: "Linha",
    suitable: ["trend", "time-series"],
  },
  pie: {
    icon: IconChartPie,
    label: "Pizza",
    suitable: ["proportion", "composition"],
  },
  donut: {
    icon: IconChartPie,
    label: "Rosca",
    suitable: ["proportion", "composition"],
  },
  radar: {
    icon: IconChartRadar,
    label: "Radar",
    suitable: ["comparison", "multi-dimensional"],
  },
  treemap: {
    icon: IconChartTreemap,
    label: "Mapa de Árvore",
    suitable: ["hierarchical", "proportion"],
  },
  area: {
    icon: IconChartLine,
    label: "Área",
    suitable: ["trend", "cumulative"],
  },
  "stacked-bar": {
    icon: IconChartBar,
    label: "Barras Empilhadas",
    suitable: ["composition", "comparison"],
  },
  "horizontal-bar": {
    icon: IconChartBar,
    label: "Barras Horizontais",
    suitable: ["ranking", "comparison"],
  },
};

export function ConsumptionChart({
  data,
  metric,
  groupBy,
  showPercentages = true,
  showTrend = true,
  showLabels = "hover",
  loading = false,
  height = 400,
  chartType = "bar",
  onChartTypeChange,
}: ConsumptionChartProps) {
  const chartRef = useRef<ReactEChartsCore>(null);
  const [selectedChart, setSelectedChart] = useState<ChartType>(chartType);

  useEffect(() => {
    setSelectedChart(chartType);
  }, [chartType]);

  const handleChartTypeChange = (type: ChartType) => {
    setSelectedChart(type);
    onChartTypeChange?.(type);
  };

  const formatValue = (value: number) => {
    if (metric === "quantity") {
      return value.toLocaleString("pt-BR");
    }
    return formatCurrency(value);
  };

  const getChartOption = useMemo(() => {
    const theme = {
      primary: "#3b82f6",
      secondary: "#8b5cf6",
      success: "#10b981",
      warning: "#f59e0b",
      danger: "#ef4444",
      muted: "#6b7280",
      background: "#ffffff",
      foreground: "#111827",
      border: "#e5e7eb",
    };

    const colors = [
      theme.primary,
      theme.secondary,
      theme.success,
      theme.warning,
      theme.danger,
      "#06b6d4",
      "#ec4899",
      "#14b8a6",
      "#f97316",
      "#8b5cf6",
      "#84cc16",
      "#eab308",
    ];

    const baseOption = {
      color: colors,
      backgroundColor: "transparent",
      textStyle: {
        fontFamily: "Inter, system-ui, sans-serif",
      },
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(255, 255, 255, 0.95)",
        borderColor: theme.border,
        borderWidth: 1,
        textStyle: {
          color: theme.foreground,
          fontSize: 12,
        },
        formatter: (params: any) => {
          const item = data.find((d) => d.name === params.name);
          if (!item) return "";

          let html = `<div style="padding: 4px;">
            <div style="font-weight: 600; margin-bottom: 4px;">${params.name}</div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background-color: ${params.color};"></span>
              <span>${formatValue(params.value)}</span>
            </div>`;

          if (showPercentages) {
            html += `<div style="color: ${theme.muted}; font-size: 11px; margin-top: 4px;">
              ${item.percentage.toFixed(1)}% do total
            </div>`;
          }

          if (showTrend && item.trend !== undefined) {
            const trendColor = item.trend >= 0 ? theme.success : theme.danger;
            const trendIcon = item.trend >= 0 ? "↑" : "↓";
            html += `<div style="color: ${trendColor}; font-size: 11px; margin-top: 4px;">
              ${trendIcon} ${Math.abs(item.trend).toFixed(1)}% vs período anterior
            </div>`;
          }

          html += "</div>";
          return html;
        },
      },
      animation: true,
      animationDuration: 800,
      animationEasing: "cubicInOut",
    };

    switch (selectedChart) {
      case "bar":
      case "stacked-bar":
        return {
          ...baseOption,
          tooltip: {
            ...baseOption.tooltip,
            trigger: "axis",
            axisPointer: {
              type: "shadow",
            },
          },
          grid: {
            left: "3%",
            right: "4%",
            bottom: "15%",
            top: "5%",
            containLabel: true,
          },
          xAxis: {
            type: "category",
            data: data.map((d) => d.name),
            axisLabel: {
              rotate: data.length > 10 ? 45 : 0,
              interval: 0,
              fontSize: 11,
              color: theme.muted,
            },
            axisLine: {
              lineStyle: {
                color: theme.border,
              },
            },
          },
          yAxis: {
            type: "value",
            axisLabel: {
              formatter: (value: number) => {
                if (metric === "totalPrice") {
                  return `R$ ${(value / 1000).toFixed(0)}k`;
                }
                return value.toLocaleString("pt-BR");
              },
              fontSize: 11,
              color: theme.muted,
            },
            splitLine: {
              lineStyle: {
                color: theme.border,
                type: "dashed",
              },
            },
            axisLine: {
              show: false,
            },
          },
          series: [
            {
              name: metric === "quantity" ? "Quantidade" : "Valor Total",
              type: "bar",
              data: data.map((d, i) => ({
                value: d.value,
                itemStyle: {
                  color: colors[i % colors.length],
                  borderRadius: [4, 4, 0, 0],
                },
              })),
              label: {
                show: showLabels === "always",
                position: "top",
                formatter: (params: any) => formatValue(params.value),
                fontSize: 10,
                color: theme.muted,
              },
              emphasis: {
                itemStyle: {
                  shadowBlur: 10,
                  shadowColor: "rgba(0, 0, 0, 0.1)",
                },
                label: {
                  show: showLabels !== "never",
                },
              },
            },
          ],
        };

      case "horizontal-bar":
        return {
          ...baseOption,
          tooltip: {
            ...baseOption.tooltip,
            trigger: "axis",
            axisPointer: {
              type: "shadow",
            },
          },
          grid: {
            left: "3%",
            right: "4%",
            bottom: "3%",
            top: "5%",
            containLabel: true,
          },
          xAxis: {
            type: "value",
            axisLabel: {
              formatter: (value: number) => {
                if (metric === "totalPrice") {
                  return `R$ ${(value / 1000).toFixed(0)}k`;
                }
                return value.toLocaleString("pt-BR");
              },
              fontSize: 11,
              color: theme.muted,
            },
            splitLine: {
              lineStyle: {
                color: theme.border,
                type: "dashed",
              },
            },
            axisLine: {
              show: false,
            },
          },
          yAxis: {
            type: "category",
            data: data.map((d) => d.name).reverse(),
            axisLabel: {
              fontSize: 11,
              color: theme.muted,
            },
            axisLine: {
              lineStyle: {
                color: theme.border,
              },
            },
          },
          series: [
            {
              name: metric === "quantity" ? "Quantidade" : "Valor Total",
              type: "bar",
              data: data
                .map((d, i) => ({
                  value: d.value,
                  itemStyle: {
                    color: colors[i % colors.length],
                    borderRadius: [0, 4, 4, 0],
                  },
                }))
                .reverse(),
              label: {
                show: showLabels === "always",
                position: "right",
                formatter: (params: any) => formatValue(params.value),
                fontSize: 10,
                color: theme.muted,
              },
              emphasis: {
                itemStyle: {
                  shadowBlur: 10,
                  shadowColor: "rgba(0, 0, 0, 0.1)",
                },
                label: {
                  show: showLabels !== "never",
                },
              },
            },
          ],
        };

      case "line":
      case "area":
        return {
          ...baseOption,
          tooltip: {
            ...baseOption.tooltip,
            trigger: "axis",
          },
          grid: {
            left: "3%",
            right: "4%",
            bottom: "15%",
            top: "5%",
            containLabel: true,
          },
          xAxis: {
            type: "category",
            data: data.map((d) => d.name),
            axisLabel: {
              rotate: data.length > 10 ? 45 : 0,
              interval: 0,
              fontSize: 11,
              color: theme.muted,
            },
            axisLine: {
              lineStyle: {
                color: theme.border,
              },
            },
            boundaryGap: false,
          },
          yAxis: {
            type: "value",
            axisLabel: {
              formatter: (value: number) => {
                if (metric === "totalPrice") {
                  return `R$ ${(value / 1000).toFixed(0)}k`;
                }
                return value.toLocaleString("pt-BR");
              },
              fontSize: 11,
              color: theme.muted,
            },
            splitLine: {
              lineStyle: {
                color: theme.border,
                type: "dashed",
              },
            },
            axisLine: {
              show: false,
            },
          },
          series: [
            {
              name: metric === "quantity" ? "Quantidade" : "Valor Total",
              type: "line",
              data: data.map((d) => d.value),
              smooth: true,
              symbol: "circle",
              symbolSize: 8,
              lineStyle: {
                width: 3,
                color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                  { offset: 0, color: colors[0] },
                  { offset: 1, color: colors[1] },
                ]),
              },
              itemStyle: {
                color: colors[0],
                borderWidth: 2,
                borderColor: "#fff",
              },
              areaStyle: selectedChart === "area"
                ? {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                      { offset: 0, color: `${colors[0]}40` },
                      { offset: 1, color: `${colors[0]}10` },
                    ]),
                  }
                : undefined,
              label: {
                show: showLabels === "always",
                formatter: (params: any) => formatValue(params.value),
                fontSize: 10,
                color: theme.muted,
              },
              emphasis: {
                scale: 1.5,
                label: {
                  show: showLabels !== "never",
                },
              },
            },
          ],
        };

      case "pie":
      case "donut":
        return {
          ...baseOption,
          legend: {
            type: "scroll",
            orient: "horizontal",
            bottom: "0%",
            itemWidth: 10,
            itemHeight: 10,
            textStyle: {
              fontSize: 11,
              color: theme.muted,
            },
          },
          series: [
            {
              name: metric === "quantity" ? "Quantidade" : "Valor Total",
              type: "pie",
              radius: selectedChart === "donut" ? ["40%", "70%"] : "70%",
              center: ["50%", "45%"],
              data: data.map((d, i) => ({
                value: d.value,
                name: d.name,
                itemStyle: {
                  color: colors[i % colors.length],
                },
              })),
              emphasis: {
                itemStyle: {
                  shadowBlur: 10,
                  shadowOffsetX: 0,
                  shadowColor: "rgba(0, 0, 0, 0.5)",
                },
                label: {
                  show: true,
                  fontSize: 12,
                  fontWeight: "bold",
                },
              },
              label: {
                show: showLabels === "always",
                formatter: "{b}\n{d}%",
                fontSize: 11,
                color: theme.foreground,
              },
              labelLine: {
                show: showLabels === "always",
                smooth: 0.2,
                length: 10,
                length2: 20,
              },
            },
          ],
        };

      case "radar":
        const maxValue = Math.max(...data.map((d) => d.value));
        return {
          ...baseOption,
          radar: {
            indicator: data.map((d) => ({
              name: d.name,
              max: maxValue * 1.2,
            })),
            shape: "polygon",
            splitNumber: 5,
            axisName: {
              color: theme.muted,
              fontSize: 11,
            },
            splitLine: {
              lineStyle: {
                color: theme.border,
              },
            },
            splitArea: {
              show: true,
              areaStyle: {
                color: ["rgba(59, 130, 246, 0.05)", "rgba(139, 92, 246, 0.05)"],
              },
            },
            axisLine: {
              lineStyle: {
                color: theme.border,
              },
            },
          },
          series: [
            {
              name: metric === "quantity" ? "Quantidade" : "Valor Total",
              type: "radar",
              data: [
                {
                  value: data.map((d) => d.value),
                  name: "Valores",
                  lineStyle: {
                    color: colors[0],
                    width: 2,
                  },
                  areaStyle: {
                    color: new echarts.graphic.RadialGradient(0.5, 0.5, 0.5, [
                      { offset: 0, color: `${colors[0]}60` },
                      { offset: 1, color: `${colors[0]}20` },
                    ]),
                  },
                  itemStyle: {
                    color: colors[0],
                  },
                },
              ],
              emphasis: {
                lineStyle: {
                  width: 4,
                },
              },
            },
          ],
        };

      case "treemap":
        return {
          ...baseOption,
          series: [
            {
              name: metric === "quantity" ? "Quantidade" : "Valor Total",
              type: "treemap",
              data: data.map((d, i) => ({
                name: d.name,
                value: d.value,
                itemStyle: {
                  color: colors[i % colors.length],
                },
                label: {
                  show: true,
                  formatter: (params: any) => {
                    const item = data.find((d) => d.name === params.name);
                    return `{name|${params.name}}\n{value|${formatValue(params.value)}}\n{percent|${item?.percentage.toFixed(1)}%}`;
                  },
                  rich: {
                    name: {
                      fontSize: 12,
                      fontWeight: "bold",
                      color: "#fff",
                    },
                    value: {
                      fontSize: 11,
                      color: "#fff",
                      padding: [2, 0],
                    },
                    percent: {
                      fontSize: 10,
                      color: "#fff",
                      opacity: 0.8,
                    },
                  },
                },
                emphasis: {
                  itemStyle: {
                    shadowBlur: 10,
                    shadowColor: "rgba(0, 0, 0, 0.3)",
                  },
                },
              })),
              breadcrumb: {
                show: false,
              },
              roam: false,
              nodeClick: false,
              levels: [
                {
                  itemStyle: {
                    borderWidth: 0,
                    gapWidth: 2,
                  },
                },
              ],
            },
          ],
        };

      default:
        return baseOption;
    }
  }, [data, metric, selectedChart, showLabels, showPercentages, showTrend]);

  const recommendedCharts = useMemo(() => {
    // Recommend charts based on data characteristics
    const dataCount = data.length;
    const hasNegativeTrend = data.some((d) => d.trend && d.trend < 0);
    const isRanking = groupBy === "item" || groupBy === "user";

    const recommendations: ChartType[] = [];

    if (dataCount <= 7) {
      recommendations.push("pie", "donut", "radar");
    }

    if (isRanking || dataCount > 10) {
      recommendations.push("horizontal-bar");
    }

    if (dataCount <= 20) {
      recommendations.push("bar", "treemap");
    }

    if (hasNegativeTrend) {
      recommendations.push("line", "area");
    }

    return recommendations.slice(0, 4);
  }, [data, groupBy]);

  // If chartType is controlled externally (passed as prop), don't render Card wrapper
  if (chartType && !onChartTypeChange) {
    return (
      <div style={{ height: `${height}px` }}>
        <ReactEChartsCore
          ref={chartRef}
          echarts={echarts}
          option={getChartOption}
          notMerge={true}
          lazyUpdate={true}
          theme="light"
          style={{ height: "100%", width: "100%" }}
          opts={{ renderer: "canvas" }}
        />
      </div>
    );
  }

  // Render with Card wrapper for standalone usage
  return (
    <Card className="h-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            Visualização de Dados
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {Object.entries(chartTypeConfig).map(([type, config]) => {
                const Icon = config.icon;
                const isRecommended = recommendedCharts.includes(type as ChartType);
                return (
                  <Button
                    key={type}
                    variant={selectedChart === type ? "default" : "ghost"}
                    size="sm"
                    onClick={() => handleChartTypeChange(type as ChartType)}
                    className={`p-2 h-8 w-8 ${
                      isRecommended && selectedChart !== type
                        ? "ring-2 ring-primary/20"
                        : ""
                    }`}
                    title={`${config.label}${isRecommended ? " (Recomendado)" : ""}`}
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div style={{ height: `${height}px` }}>
          <ReactEChartsCore
            ref={chartRef}
            echarts={echarts}
            option={getChartOption}
            notMerge={true}
            lazyUpdate={true}
            theme="light"
            style={{ height: "100%", width: "100%" }}
            opts={{ renderer: "canvas" }}
          />
        </div>
      </CardContent>
    </Card>
  );
}