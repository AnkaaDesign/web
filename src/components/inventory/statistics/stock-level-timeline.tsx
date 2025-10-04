import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Package } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Badge } from "@/components/ui/badge";

interface StockData {
  date: string;
  item1: number;
  item2: number;
  item3: number;
  item4: number;
  item5: number;
}

export function StockLevelTimeline() {
  // Generate mock data
  const generateStockData = (): StockData[] => {
    const data: StockData[] = [];
    const today = new Date();

    for (let i = 30; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);

      data.push({
        date: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        item1: Math.floor(100 + Math.random() * 50 - i * 1.5),
        item2: Math.floor(200 + Math.random() * 100 - i * 2),
        item3: Math.floor(150 + Math.random() * 75 + i * 0.5),
        item4: Math.floor(80 + Math.random() * 40),
        item5: Math.floor(300 + Math.random() * 150 - i * 3),
      });
    }

    return data;
  };

  const stockData = generateStockData();

  // Calculate trends
  const calculateTrend = (data: number[]) => {
    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    return ((secondAvg - firstAvg) / firstAvg) * 100;
  };

  const items = [
    { name: "Parafuso M8", color: "#3B82F6", key: "item1", reorderPoint: 50 },
    { name: "Luva Nitrílica", color: "#10B981", key: "item2", reorderPoint: 100 },
    { name: "Óleo Lubrif.", color: "#F59E0B", key: "item3", reorderPoint: 75 },
    { name: "Capacete", color: "#8B5CF6", key: "item4", reorderPoint: 40 },
    { name: "Disco de Corte", color: "#EF4444", key: "item5", reorderPoint: 150 },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <CardTitle>Níveis de Estoque - Linha do Tempo</CardTitle>
          </div>
          <Badge variant="outline">Últimos 30 dias</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-5 gap-2 mb-4">
            {items.map((item) => {
              const values = stockData.map(d => d[item.key as keyof StockData] as number);
              const trend = calculateTrend(values);
              const currentValue = values[values.length - 1];
              const isCritical = currentValue < item.reorderPoint;

              return (
                <div
                  key={item.key}
                  className={`p-2 rounded-lg border ${isCritical ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : ''}`}
                >
                  <div className="text-xs text-muted-foreground truncate">{item.name}</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm font-semibold">{currentValue}</span>
                    <span className={`text-xs flex items-center ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {Math.abs(trend).toFixed(0)}%
                    </span>
                  </div>
                  {isCritical && (
                    <div className="text-xs text-red-600 mt-1">Crítico!</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Chart */}
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={stockData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                interval={Math.floor(stockData.length / 8)}
              />
              <YAxis />
              <Tooltip
                formatter={(value: number) => value.toLocaleString("pt-BR")}
                labelFormatter={(label) => `Data: ${label}`}
              />
              <Legend />

              {/* Reference lines for reorder points */}
              {items.map((item) => (
                <ReferenceLine
                  key={`ref-${item.key}`}
                  y={item.reorderPoint}
                  stroke={item.color}
                  strokeDasharray="5 5"
                  opacity={0.5}
                />
              ))}

              {/* Data lines */}
              {items.map((item) => (
                <Line
                  key={item.key}
                  type="monotone"
                  dataKey={item.key}
                  stroke={item.color}
                  strokeWidth={2}
                  dot={false}
                  name={item.name}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span>Linhas tracejadas = Ponto de Pedido</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}