import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart as PieChartIcon, TrendingUp } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { Badge } from "@/components/ui/badge";

interface ReasonData {
  name: string;
  value: number;
  percentage: number;
  color: string;
  trend: number;
}

export function ActivityReasonBreakdown() {
  // Generate mock data based on Brazilian activity reasons
  const generateReasonData = (): ReasonData[] => {
    const reasons = [
      { name: "Uso em Produção", baseValue: 2500, color: "#3B82F6" },
      { name: "Pedido Recebido", baseValue: 1800, color: "#10B981" },
      { name: "Entrega de EPI", baseValue: 1200, color: "#F59E0B" },
      { name: "Empréstimo", baseValue: 800, color: "#8B5CF6" },
      { name: "Devolução", baseValue: 600, color: "#06B6D4" },
      { name: "Manutenção", baseValue: 500, color: "#EC4899" },
      { name: "Ajuste Manual", baseValue: 400, color: "#14B8A6" },
      { name: "Contagem", baseValue: 300, color: "#F97316" },
      { name: "Perda/Dano", baseValue: 200, color: "#EF4444" },
      { name: "Outros", baseValue: 150, color: "#6B7280" },
    ];

    const total = reasons.reduce((sum, r) => sum + r.baseValue, 0);

    return reasons.map(reason => {
      const value = reason.baseValue + Math.floor((Math.random() - 0.5) * reason.baseValue * 0.2);
      const trend = (Math.random() - 0.5) * 40; // -20% to +20%

      return {
        name: reason.name,
        value,
        percentage: (value / total) * 100,
        color: reason.color,
        trend,
      };
    });
  };

  const reasonData = generateReasonData();
  const totalActivities = reasonData.reduce((sum, d) => sum + d.value, 0);

  // Sort by value for better visualization
  const sortedData = [...reasonData].sort((a, b) => b.value - a.value);
  const top5Reasons = sortedData.slice(0, 5);
  const otherReasons = sortedData.slice(5);
  const otherTotal = otherReasons.reduce((sum, d) => sum + d.value, 0);

  // Data for pie chart (top 5 + others grouped)
  const pieData = [
    ...top5Reasons,
    {
      name: "Outros",
      value: otherTotal,
      percentage: (otherTotal / totalActivities) * 100,
      color: "#9CA3AF",
      trend: 0,
    },
  ];

  // Custom label
  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
  }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if (percent < 0.05) return null; // Don't show labels for small slices

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central"
        className="text-xs font-medium"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PieChartIcon className="h-5 w-5 text-primary" />
            <CardTitle>Distribuição por Motivo</CardTitle>
          </div>
          <Badge variant="outline">
            {totalActivities.toLocaleString("pt-BR")} atividades
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie Chart */}
          <div>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomizedLabel}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => value.toLocaleString("pt-BR")}
                  contentStyle={{
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Detailed List */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium mb-3">Detalhamento</h4>
            {sortedData.map((reason) => (
              <div
                key={reason.name}
                className="flex items-center justify-between p-2 border rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: reason.color }}
                  />
                  <span className="text-sm">{reason.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {reason.value.toLocaleString("pt-BR")}
                  </span>
                  <Badge variant="secondary" className="min-w-[50px] justify-center">
                    {reason.percentage.toFixed(1)}%
                  </Badge>
                  {reason.trend > 0 && (
                    <TrendingUp className="h-3 w-3 text-green-600" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Insights Section */}
        <div className="mt-6 space-y-3">
          <h4 className="text-sm font-medium">Insights</h4>

          {/* Top Reason Alert */}
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: sortedData[0].color }}
              />
              <p className="text-sm">
                <strong>{sortedData[0].name}</strong> representa {sortedData[0].percentage.toFixed(1)}%
                de todas as movimentações, totalizando {sortedData[0].value.toLocaleString("pt-BR")} atividades.
              </p>
            </div>
          </div>

          {/* Comparison Bars */}
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Proporção de Entradas vs Saídas por Motivo</div>
            {top5Reasons.map((reason) => {
              const inboundPercentage = Math.random() * 100; // Mock data
              return (
                <div key={reason.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span>{reason.name}</span>
                    <span className="text-muted-foreground">
                      {inboundPercentage.toFixed(0)}% entrada | {(100 - inboundPercentage).toFixed(0)}% saída
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div
                      className="bg-gradient-to-r from-green-500 to-red-500 h-1.5 rounded-full"
                      style={{ width: `${inboundPercentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}