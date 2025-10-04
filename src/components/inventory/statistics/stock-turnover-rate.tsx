import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RotateCw, TrendingUp, TrendingDown } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Badge } from "@/components/ui/badge";

interface TurnoverData {
  name: string;
  turnover: number;
  target: number;
  category: string;
  trend: "up" | "down" | "stable";
}

export function StockTurnoverRate() {
  // Generate mock data
  const generateTurnoverData = (): TurnoverData[] => {
    const items = [
      { name: "Parafusos", category: "Ferramentas", baseRate: 8 },
      { name: "Luvas", category: "EPIs", baseRate: 12 },
      { name: "Óleo", category: "Consumíveis", baseRate: 6 },
      { name: "Discos", category: "Ferramentas", baseRate: 10 },
      { name: "Capacetes", category: "EPIs", baseRate: 3 },
      { name: "Cabos", category: "Eletrônicos", baseRate: 5 },
      { name: "Tintas", category: "Materiais", baseRate: 4 },
      { name: "Filtros", category: "Consumíveis", baseRate: 9 },
    ];

    return items.map(item => {
      const turnover = item.baseRate + (Math.random() - 0.5) * 4;
      const target = item.baseRate;
      const trend = turnover > target * 1.1 ? "up" : turnover < target * 0.9 ? "down" : "stable";

      return {
        name: item.name,
        turnover: Math.max(0, turnover),
        target,
        category: item.category,
        trend,
      };
    });
  };

  const data = generateTurnoverData();
  const avgTurnover = data.reduce((sum, d) => sum + d.turnover, 0) / data.length;

  // Color based on performance
  const getBarColor = (turnover: number, target: number) => {
    const ratio = turnover / target;
    if (ratio >= 1.2) return "#10B981"; // Excellent
    if (ratio >= 1) return "#3B82F6"; // Good
    if (ratio >= 0.8) return "#F59E0B"; // Warning
    return "#EF4444"; // Poor
  };

  // Calculate metrics
  const excellentCount = data.filter(d => d.turnover >= d.target * 1.2).length;
  const goodCount = data.filter(d => d.turnover >= d.target && d.turnover < d.target * 1.2).length;
  const warningCount = data.filter(d => d.turnover >= d.target * 0.8 && d.turnover < d.target).length;
  const poorCount = data.filter(d => d.turnover < d.target * 0.8).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RotateCw className="h-5 w-5 text-primary" />
            <CardTitle>Taxa de Giro do Estoque</CardTitle>
          </div>
          <Badge variant="outline">
            Média: {avgTurnover.toFixed(1)}x/ano
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Performance Summary */}
          <div className="grid grid-cols-4 gap-2">
            <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded">
              <div className="text-2xl font-bold text-green-600">{excellentCount}</div>
              <div className="text-xs text-muted-foreground">Excelente</div>
            </div>
            <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
              <div className="text-2xl font-bold text-blue-600">{goodCount}</div>
              <div className="text-xs text-muted-foreground">Bom</div>
            </div>
            <div className="text-center p-2 bg-orange-50 dark:bg-orange-900/20 rounded">
              <div className="text-2xl font-bold text-orange-600">{warningCount}</div>
              <div className="text-xs text-muted-foreground">Atenção</div>
            </div>
            <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded">
              <div className="text-2xl font-bold text-red-600">{poorCount}</div>
              <div className="text-xs text-muted-foreground">Baixo</div>
            </div>
          </div>

          {/* Bar Chart */}
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
              <YAxis
                label={{ value: "Giros/Ano", angle: -90, position: "insideLeft" }}
              />
              <Tooltip
                formatter={(value: number) => `${value.toFixed(1)}x`}
                labelFormatter={(label) => `Item: ${label}`}
              />
              <Legend />

              <Bar dataKey="turnover" name="Giro Atual" radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={getBarColor(entry.turnover, entry.target)}
                  />
                ))}
              </Bar>
              <Bar
                dataKey="target"
                name="Meta"
                fill="#9CA3AF"
                fillOpacity={0.5}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>

          {/* Detailed List */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Análise Detalhada</h4>
            {data.map((item) => {
              const performance = (item.turnover / item.target) * 100;
              return (
                <div
                  key={item.name}
                  className="flex items-center justify-between p-2 border rounded"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-2 h-8 rounded"
                      style={{ backgroundColor: getBarColor(item.turnover, item.target) }}
                    />
                    <div>
                      <div className="font-medium text-sm">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{item.category}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-medium">{item.turnover.toFixed(1)}x</div>
                      <div className="text-xs text-muted-foreground">
                        Meta: {item.target.toFixed(1)}x
                      </div>
                    </div>
                    <Badge
                      variant={performance >= 100 ? "default" : "destructive"}
                      className="min-w-[60px] justify-center"
                    >
                      {performance.toFixed(0)}%
                    </Badge>
                    {item.trend === "up" && <TrendingUp className="h-4 w-4 text-green-600" />}
                    {item.trend === "down" && <TrendingDown className="h-4 w-4 text-red-600" />}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Insights */}
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm">
              <strong>Recomendação:</strong> Itens com giro abaixo de 80% da meta devem ter seus níveis de estoque revisados para evitar capital parado.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}