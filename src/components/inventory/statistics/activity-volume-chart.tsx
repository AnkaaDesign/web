import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, ArrowDown, ArrowUp } from "lucide-react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ActivityData {
  period: string;
  inbound: number;
  outbound: number;
  total: number;
  avgPerDay: number;
}

export function ActivityVolumeChart() {
  const [viewMode, setViewMode] = useState<"daily" | "weekly" | "monthly">("daily");

  // Generate mock data based on view mode
  const generateActivityData = (): ActivityData[] => {
    const data: ActivityData[] = [];

    if (viewMode === "daily") {
      for (let i = 30; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dayOfWeek = date.getDay();

        // Simulate realistic patterns
        let baseInbound = 50;
        let baseOutbound = 80;

        // Lower activity on weekends
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          baseInbound *= 0.3;
          baseOutbound *= 0.2;
        }

        const inbound = Math.floor(baseInbound + Math.random() * 30);
        const outbound = Math.floor(baseOutbound + Math.random() * 50);

        data.push({
          period: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
          inbound,
          outbound,
          total: inbound + outbound,
          avgPerDay: inbound + outbound,
        });
      }
    } else if (viewMode === "weekly") {
      for (let i = 11; i >= 0; i--) {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - i * 7);

        const inbound = Math.floor(300 + Math.random() * 150);
        const outbound = Math.floor(500 + Math.random() * 200);
        const total = inbound + outbound;

        data.push({
          period: `Sem ${12 - i}`,
          inbound,
          outbound,
          total,
          avgPerDay: Math.floor(total / 7),
        });
      }
    } else {
      const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      for (let i = 0; i < 12; i++) {
        const inbound = Math.floor(1200 + Math.random() * 600);
        const outbound = Math.floor(2000 + Math.random() * 800);
        const total = inbound + outbound;

        data.push({
          period: months[i],
          inbound,
          outbound,
          total,
          avgPerDay: Math.floor(total / 30),
        });
      }
    }

    return data;
  };

  const activityData = generateActivityData();

  // Calculate statistics
  const totalInbound = activityData.reduce((sum, d) => sum + d.inbound, 0);
  const totalOutbound = activityData.reduce((sum, d) => sum + d.outbound, 0);
  const avgDaily = Math.floor((totalInbound + totalOutbound) / activityData.length);

  // Calculate trend
  const firstHalf = activityData.slice(0, Math.floor(activityData.length / 2));
  const secondHalf = activityData.slice(Math.floor(activityData.length / 2));
  const firstHalfAvg = firstHalf.reduce((sum, d) => sum + d.total, 0) / firstHalf.length;
  const secondHalfAvg = secondHalf.reduce((sum, d) => sum + d.total, 0) / secondHalf.length;
  const trendPercentage = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle>Volume de Atividades</CardTitle>
          </div>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
            <TabsList>
              <TabsTrigger value="daily">Diário</TabsTrigger>
              <TabsTrigger value="weekly">Semanal</TabsTrigger>
              <TabsTrigger value="monthly">Mensal</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
              <div className="flex items-center gap-1 text-green-600 mb-1">
                <ArrowDown className="h-4 w-4" />
                <span className="text-xs">Entradas</span>
              </div>
              <div className="text-lg font-bold">{totalInbound.toLocaleString("pt-BR")}</div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
              <div className="flex items-center gap-1 text-red-600 mb-1">
                <ArrowUp className="h-4 w-4" />
                <span className="text-xs">Saídas</span>
              </div>
              <div className="text-lg font-bold">{totalOutbound.toLocaleString("pt-BR")}</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Média/Dia</div>
              <div className="text-lg font-bold">{avgDaily}</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Tendência</div>
              <div className={`text-lg font-bold flex items-center gap-1 ${
                trendPercentage > 0 ? "text-green-600" : "text-red-600"
              }`}>
                {trendPercentage > 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                {Math.abs(trendPercentage).toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Chart */}
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={activityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 11 }}
                interval={viewMode === "monthly" ? 0 : Math.floor(activityData.length / 8)}
              />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip
                formatter={(value: number) => value.toLocaleString("pt-BR")}
                labelFormatter={(label) => `Período: ${label}`}
              />
              <Legend />

              <Bar
                yAxisId="left"
                dataKey="inbound"
                stackId="a"
                fill="#10B981"
                name="Entradas"
              />
              <Bar
                yAxisId="left"
                dataKey="outbound"
                stackId="a"
                fill="#EF4444"
                name="Saídas"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="avgPerDay"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={false}
                name="Média/Dia"
              />
            </ComposedChart>
          </ResponsiveContainer>

          {/* Peak Activity Indicators */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Picos de Atividade</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-2 border rounded">
                <span className="text-sm text-muted-foreground">Maior Entrada</span>
                <Badge variant="default" className="bg-green-600">
                  {Math.max(...activityData.map(d => d.inbound))} ({
                    activityData.find(d => d.inbound === Math.max(...activityData.map(d => d.inbound)))?.period
                  })
                </Badge>
              </div>
              <div className="flex items-center justify-between p-2 border rounded">
                <span className="text-sm text-muted-foreground">Maior Saída</span>
                <Badge variant="destructive">
                  {Math.max(...activityData.map(d => d.outbound))} ({
                    activityData.find(d => d.outbound === Math.max(...activityData.map(d => d.outbound)))?.period
                  })
                </Badge>
              </div>
            </div>
          </div>

          {/* Activity Balance */}
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Balanço de Atividades</span>
              <span className={`text-sm font-bold ${
                totalInbound > totalOutbound ? "text-green-600" : "text-red-600"
              }`}>
                {totalInbound > totalOutbound ? "+" : ""}{(totalInbound - totalOutbound).toLocaleString("pt-BR")}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-green-600 to-red-600 h-2 rounded-full"
                style={{
                  width: `${(totalInbound / (totalInbound + totalOutbound)) * 100}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Entradas: {((totalInbound / (totalInbound + totalOutbound)) * 100).toFixed(1)}%</span>
              <span>Saídas: {((totalOutbound / (totalInbound + totalOutbound)) * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}