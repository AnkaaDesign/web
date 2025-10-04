import React, { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, ComposedChart } from "recharts";
import { format } from "date-fns";
import { Loader2, Activity, TrendingUp, TrendingDown } from "lucide-react";

// Types
interface StatisticsFilters {
  dateRange: {
    from: Date;
    to: Date;
  };
  period: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
  categoryId?: string;
  brandId?: string;
  supplierId?: string;
  userId?: string;
  sectorId?: string;
}

interface ActivityVolumeDataPoint {
  date: string;
  totalActivities: number;
  incomingActivities: number;
  outgoingActivities: number;
  adjustmentActivities: number;
  peakHour: string;
  averagePerHour: number;
}

interface ActivityVolumeChartProps {
  filters: StatisticsFilters;
}

// Mock data generator
const generateMockActivityData = (filters: StatisticsFilters): ActivityVolumeDataPoint[] => {
  const days = Math.ceil((filters.dateRange.to.getTime() - filters.dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
  const data: ActivityVolumeDataPoint[] = [];

  for (let i = 0; i <= days; i++) {
    const date = new Date(filters.dateRange.from);
    date.setDate(date.getDate() + i);

    // More activities on weekdays, weekend pattern
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const baseActivity = isWeekend ? 15 : 45;

    const randomVariation = Math.random() * 20 - 10;
    const seasonalFactor = Math.sin(i * 0.1) * 10;

    const totalActivities = Math.max(5, Math.floor(baseActivity + randomVariation + seasonalFactor));
    const incomingActivities = Math.floor(totalActivities * (0.4 + Math.random() * 0.3));
    const outgoingActivities = Math.floor(totalActivities * (0.3 + Math.random() * 0.3));
    const adjustmentActivities = totalActivities - incomingActivities - outgoingActivities;

    // Peak hours typically around 10-11 AM or 2-3 PM
    const peakHours = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];
    const peakHour = peakHours[Math.floor(Math.random() * peakHours.length)];

    data.push({
      date: format(date, 'dd/MM'),
      totalActivities,
      incomingActivities,
      outgoingActivities,
      adjustmentActivities,
      peakHour,
      averagePerHour: Number((totalActivities / 8).toFixed(1)), // 8 working hours
    });
  }

  return data;
};

export const ActivityVolumeChart: React.FC<ActivityVolumeChartProps> = ({ filters }) => {
  const { data, isLoading, error } = useMemo(() => {
    try {
      const mockData = generateMockActivityData(filters);
      return { data: mockData, isLoading: false, error: null };
    } catch (err) {
      return { data: [], isLoading: false, error: 'Erro ao carregar dados' };
    }
  }, [filters]);

  const summary = useMemo(() => {
    if (!data || data.length === 0) return null;

    const totalActivities = data.reduce((acc, item) => acc + item.totalActivities, 0);
    const avgDaily = totalActivities / data.length;
    const maxDay = data.reduce((max, item) => item.totalActivities > max.totalActivities ? item : max, data[0]);
    const minDay = data.reduce((min, item) => item.totalActivities < min.totalActivities ? item : min, data[0]);

    // Calculate trend
    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));

    const firstHalfAvg = firstHalf.reduce((acc, item) => acc + item.totalActivities, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((acc, item) => acc + item.totalActivities, 0) / secondHalf.length;

    const trendPercentage = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;

    return {
      totalActivities,
      avgDaily: Number(avgDaily.toFixed(1)),
      maxDay: { date: maxDay.date, count: maxDay.totalActivities },
      minDay: { date: minDay.date, count: minDay.totalActivities },
      trend: {
        percentage: Number(trendPercentage.toFixed(1)),
        isPositive: trendPercentage >= 0,
      },
    };
  }, [data]);

  const formatTooltipValue = (value: number, name: string) => {
    const nameMap: { [key: string]: string } = {
      totalActivities: 'Total de Atividades',
      incomingActivities: 'Entradas',
      outgoingActivities: 'Saídas',
      adjustmentActivities: 'Ajustes',
      averagePerHour: 'Média por Hora',
    };
    return [value.toLocaleString('pt-BR'), nameMap[name] || name];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Carregando dados...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        <span>{error}</span>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <span>Nenhum dado disponível para o período selecionado</span>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4 text-xs">
          <div className="p-2 rounded-lg border bg-card">
            <div className="flex items-center gap-1 mb-1">
              <Activity className="h-3 w-3" />
              <span className="text-muted-foreground">Total</span>
            </div>
            <div className="font-semibold">{summary.totalActivities}</div>
            <div className="text-muted-foreground">atividades</div>
          </div>

          <div className="p-2 rounded-lg border bg-card">
            <div className="flex items-center gap-1 mb-1">
              <div className="h-3 w-3 rounded bg-primary"></div>
              <span className="text-muted-foreground">Média Diária</span>
            </div>
            <div className="font-semibold">{summary.avgDaily}</div>
            <div className="text-muted-foreground">por dia</div>
          </div>

          <div className="p-2 rounded-lg border bg-card">
            <div className="flex items-center gap-1 mb-1">
              <div className="h-3 w-3 rounded bg-green-500"></div>
              <span className="text-muted-foreground">Pico</span>
            </div>
            <div className="font-semibold">{summary.maxDay.count}</div>
            <div className="text-muted-foreground">{summary.maxDay.date}</div>
          </div>

          <div className="p-2 rounded-lg border bg-card">
            <div className="flex items-center gap-1 mb-1">
              {summary.trend.isPositive ? (
                <TrendingUp className="h-3 w-3 text-green-600" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-600" />
              )}
              <span className="text-muted-foreground">Tendência</span>
            </div>
            <div className={`font-semibold ${summary.trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {summary.trend.isPositive ? '+' : ''}{summary.trend.percentage}%
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10 }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10 }}
            />
            <Tooltip
              formatter={formatTooltipValue}
              labelFormatter={(label) => `Data: ${label}`}
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
                fontSize: '11px',
              }}
            />

            {/* Stacked bars for activity types */}
            <Bar dataKey="incomingActivities" stackId="a" fill="hsl(var(--chart-1))" name="Entradas" />
            <Bar dataKey="outgoingActivities" stackId="a" fill="hsl(var(--chart-2))" name="Saídas" />
            <Bar dataKey="adjustmentActivities" stackId="a" fill="hsl(var(--chart-3))" name="Ajustes" />

            {/* Line for total activities */}
            <Line
              type="monotone"
              dataKey="totalActivities"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 3 }}
              name="Total"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Additional Info */}
      <div className="mt-3 text-xs text-muted-foreground">
        <p>As barras mostram a distribuição por tipo de atividade, enquanto a linha representa o volume total diário.</p>
      </div>
    </div>
  );
};