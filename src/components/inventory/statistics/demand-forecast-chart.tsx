import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, AlertTriangle, Info } from "lucide-react";
import {
  LineChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  ComposedChart,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select } from "@/components/ui/select";

interface ForecastData {
  date: string;
  actual?: number;
  forecast?: number;
  lowerBound?: number;
  upperBound?: number;
  seasonalComponent?: number;
  trend?: number;
}

interface ItemForecast {
  itemId: string;
  itemName: string;
  currentStock: number;
  reorderPoint: number;
  predictedStockout?: string;
  recommendedOrder?: {
    quantity: number;
    date: string;
  };
}

export function DemandForecastChart() {
  const [selectedItem, setSelectedItem] = useState("item-1");
  const [forecastHorizon, setForecastHorizon] = useState<7 | 14 | 30 | 90>(30);

  // Generate historical and forecast data
  const generateForecastData = (): ForecastData[] => {
    const data: ForecastData[] = [];
    const today = new Date();

    // Historical data (past 60 days)
    for (let i = -60; i <= 0; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);

      // Simulate seasonal pattern with trend
      const dayOfWeek = date.getDay();
      const weekOfMonth = Math.floor(date.getDate() / 7);
      const baseValue = 100;
      const trend = i * 0.5; // Gradual increase
      const seasonal = Math.sin((i + 30) * 0.1) * 20; // Seasonal component
      const weekdayFactor = dayOfWeek === 0 || dayOfWeek === 6 ? 0.6 : 1.2; // Lower on weekends
      const noise = (Math.random() - 0.5) * 20;

      data.push({
        date: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        actual: Math.max(0, baseValue + trend + seasonal * weekdayFactor + noise),
        seasonalComponent: seasonal,
        trend: baseValue + trend,
      });
    }

    // Forecast data (next N days based on horizon)
    for (let i = 1; i <= forecastHorizon; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);

      const dayOfWeek = date.getDay();
      const baseValue = 100;
      const trend = i * 0.5;
      const seasonal = Math.sin((i + 30) * 0.1) * 20;
      const weekdayFactor = dayOfWeek === 0 || dayOfWeek === 6 ? 0.6 : 1.2;

      const forecast = baseValue + trend + seasonal * weekdayFactor;
      const uncertainty = i * 2; // Uncertainty increases with time

      data.push({
        date: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        forecast: Math.max(0, forecast),
        lowerBound: Math.max(0, forecast - uncertainty),
        upperBound: forecast + uncertainty,
        seasonalComponent: seasonal,
        trend: baseValue + trend,
      });
    }

    return data;
  };

  const forecastData = generateForecastData();

  // Calculate forecast accuracy metrics
  const calculateMetrics = () => {
    const historicalData = forecastData.filter(d => d.actual !== undefined);
    const mean = historicalData.reduce((sum, d) => sum + (d.actual || 0), 0) / historicalData.length;
    const variance = historicalData.reduce(
      (sum, d) => sum + Math.pow((d.actual || 0) - mean, 2),
      0
    ) / historicalData.length;
    const standardDeviation = Math.sqrt(variance);

    return {
      mean: mean.toFixed(0),
      stdDev: standardDeviation.toFixed(0),
      confidence: "85%", // Mock confidence level
      mape: "12.3%", // Mock MAPE (Mean Absolute Percentage Error)
    };
  };

  const metrics = calculateMetrics();

  // Generate item recommendations
  const generateRecommendations = (): ItemForecast[] => {
    return [
      {
        itemId: "item-1",
        itemName: "Parafuso M8x50",
        currentStock: 250,
        reorderPoint: 100,
        predictedStockout: "15/02/2024",
        recommendedOrder: {
          quantity: 500,
          date: "08/02/2024",
        },
      },
      {
        itemId: "item-2",
        itemName: "Luva Nitrílica G",
        currentStock: 180,
        reorderPoint: 200,
        predictedStockout: "12/02/2024",
        recommendedOrder: {
          quantity: 400,
          date: "05/02/2024",
        },
      },
      {
        itemId: "item-3",
        itemName: "Óleo Lubrificante 1L",
        currentStock: 45,
        reorderPoint: 50,
        predictedStockout: "10/02/2024",
        recommendedOrder: {
          quantity: 100,
          date: "03/02/2024",
        },
      },
    ];
  };

  const recommendations = generateRecommendations();

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border">
          <p className="font-semibold mb-2">{label}</p>
          <div className="space-y-1 text-sm">
            {data.actual !== undefined && (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Real:</span>
                <span className="font-medium">{data.actual?.toFixed(0)}</span>
              </div>
            )}
            {data.forecast !== undefined && (
              <>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Previsão:</span>
                  <span className="font-medium text-blue-600">
                    {data.forecast?.toFixed(0)}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Intervalo:</span>
                  <span className="text-xs">
                    {data.lowerBound?.toFixed(0)} - {data.upperBound?.toFixed(0)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle>Previsão de Demanda com IA</CardTitle>
          </div>
          <div className="flex gap-2">
            {[7, 14, 30, 90].map(days => (
              <button
                key={days}
                onClick={() => setForecastHorizon(days as any)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  forecastHorizon === days
                    ? "bg-primary text-primary-foreground"
                    : "bg-gray-100 dark:bg-gray-800"
                }`}
              >
                {days}d
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Forecast Accuracy Metrics */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Média Histórica</div>
              <div className="text-xl font-bold">{metrics.mean}</div>
              <div className="text-xs text-muted-foreground">unidades/dia</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Desvio Padrão</div>
              <div className="text-xl font-bold">±{metrics.stdDev}</div>
              <div className="text-xs text-muted-foreground">unidades</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Confiança</div>
              <div className="text-xl font-bold text-green-600">{metrics.confidence}</div>
              <div className="text-xs text-muted-foreground">precisão</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">MAPE</div>
              <div className="text-xl font-bold">{metrics.mape}</div>
              <div className="text-xs text-muted-foreground">erro médio</div>
            </div>
          </div>

          {/* Main Forecast Chart */}
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={forecastData}>
              <defs>
                <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                interval={Math.floor(forecastData.length / 10)}
              />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              <Legend />

              {/* Confidence interval area */}
              <Area
                type="monotone"
                dataKey="upperBound"
                stackId="1"
                stroke="none"
                fill="url(#forecastGradient)"
                name="Limite Superior"
              />
              <Area
                type="monotone"
                dataKey="lowerBound"
                stackId="2"
                stroke="none"
                fill="#fff"
                name="Limite Inferior"
              />

              {/* Historical data */}
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#10B981"
                strokeWidth={2}
                dot={false}
                name="Consumo Real"
              />

              {/* Forecast line */}
              <Line
                type="monotone"
                dataKey="forecast"
                stroke="#3B82F6"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                name="Previsão"
              />

              {/* Trend line */}
              <Line
                type="monotone"
                dataKey="trend"
                stroke="#9CA3AF"
                strokeWidth={1}
                strokeDasharray="3 3"
                dot={false}
                name="Tendência"
              />

              {/* Today marker */}
              <ReferenceLine
                x={forecastData[60]?.date}
                stroke="#EF4444"
                strokeWidth={2}
                label={{ value: "Hoje", position: "top" }}
              />
            </ComposedChart>
          </ResponsiveContainer>

          {/* AI Insights Alert */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Insights da IA:</strong> Detectado padrão sazonal com picos às terças e quintas.
              Consumo médio crescendo 2.5% ao mês. Recomenda-se aumentar estoque de segurança em 15%
              para os próximos 30 dias devido à tendência de alta.
            </AlertDescription>
          </Alert>

          {/* Critical Items Recommendations */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              Itens Críticos - Ação Recomendada
            </h3>
            <div className="space-y-3">
              {recommendations.map(item => (
                <div
                  key={item.itemId}
                  className="flex items-center justify-between p-3 rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-900/20"
                >
                  <div>
                    <div className="font-medium">{item.itemName}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Estoque atual: {item.currentStock} | Ponto de pedido: {item.reorderPoint}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="destructive" className="mb-1">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Ruptura em {item.predictedStockout}
                    </Badge>
                    <div className="text-sm">
                      Pedir <span className="font-semibold">{item.recommendedOrder?.quantity}</span> até{" "}
                      <span className="font-semibold">{item.recommendedOrder?.date}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Seasonal Patterns */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <h4 className="text-sm font-medium mb-2">Padrão Semanal Detectado</h4>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>📈 Picos: Terça e Quinta (135% da média)</div>
                <div>📉 Baixas: Sábado e Domingo (60% da média)</div>
                <div>➡️ Média: Segunda, Quarta e Sexta</div>
              </div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <h4 className="text-sm font-medium mb-2">Tendência Mensal</h4>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>📊 Crescimento: +2.5% ao mês</div>
                <div>🎯 Projeção 3 meses: +7.8% demanda</div>
                <div>⚠️ Ajustar estoque de segurança</div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}