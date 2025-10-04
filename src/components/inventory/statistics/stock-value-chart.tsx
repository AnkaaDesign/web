import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, AlertTriangle } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "../../../utils";

interface ValueData {
  date: string;
  value: number;
  cost: number;
  profit: number;
}

export function StockValueChart() {
  // Generate mock data
  const generateValueData = (): ValueData[] => {
    const data: ValueData[] = [];
    const today = new Date();
    let baseValue = 500000;

    for (let i = 90; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);

      // Simulate value fluctuation
      const dailyChange = (Math.random() - 0.5) * 20000;
      baseValue = Math.max(300000, Math.min(700000, baseValue + dailyChange));

      const value = baseValue;
      const cost = value * 0.6; // 60% cost
      const profit = value - cost;

      data.push({
        date: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        value,
        cost,
        profit,
      });
    }

    return data;
  };

  const valueData = generateValueData();
  const currentValue = valueData[valueData.length - 1].value;
  const previousValue = valueData[valueData.length - 30].value;
  const monthlyChange = ((currentValue - previousValue) / previousValue) * 100;

  // Calculate metrics
  const avgValue = valueData.reduce((sum, d) => sum + d.value, 0) / valueData.length;
  const maxValue = Math.max(...valueData.map(d => d.value));
  const minValue = Math.min(...valueData.map(d => d.value));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <CardTitle>Valor Total do Estoque</CardTitle>
          </div>
          <Badge variant={monthlyChange > 0 ? "default" : "destructive"}>
            {monthlyChange > 0 ? "+" : ""}{monthlyChange.toFixed(1)}% no mês
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Valor Atual</div>
              <div className="text-lg font-bold text-primary">
                {formatCurrency(currentValue)}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Média 90d</div>
              <div className="text-lg font-bold">
                {formatCurrency(avgValue)}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Máximo</div>
              <div className="text-lg font-bold text-green-600">
                {formatCurrency(maxValue)}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Mínimo</div>
              <div className="text-lg font-bold text-red-600">
                {formatCurrency(minValue)}
              </div>
            </div>
          </div>

          {/* Chart */}
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={valueData}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                interval={Math.floor(valueData.length / 8)}
              />
              <YAxis
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                labelFormatter={(label) => `Data: ${label}`}
              />

              {/* Average line */}
              <ReferenceLine
                y={avgValue}
                stroke="#9CA3AF"
                strokeDasharray="5 5"
                label={{ value: "Média", position: "left" }}
              />

              <Area
                type="monotone"
                dataKey="value"
                stroke="#3B82F6"
                fillOpacity={1}
                fill="url(#colorValue)"
                strokeWidth={2}
                name="Valor Total"
              />
              <Area
                type="monotone"
                dataKey="profit"
                stroke="#10B981"
                fillOpacity={1}
                fill="url(#colorProfit)"
                strokeWidth={2}
                name="Margem"
              />
            </AreaChart>
          </ResponsiveContainer>

          {/* Alerts */}
          {currentValue < avgValue * 0.8 && (
            <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <span className="text-sm">
                Valor do estoque 20% abaixo da média histórica
              </span>
            </div>
          )}

          {/* Insights */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center justify-between p-2 border rounded">
              <span className="text-muted-foreground">Giro do Estoque</span>
              <span className="font-medium">4.2x/ano</span>
            </div>
            <div className="flex items-center justify-between p-2 border rounded">
              <span className="text-muted-foreground">Dias de Cobertura</span>
              <span className="font-medium">87 dias</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}