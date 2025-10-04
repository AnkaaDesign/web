import React, { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { Loader2, TrendingUp, TrendingDown } from "lucide-react";

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

interface StockValueDataPoint {
  date: string;
  totalValue: number;
  incomingValue: number;
  outgoingValue: number;
  netValue: number;
}

interface StockValueChartProps {
  filters: StatisticsFilters;
}

// Mock data generator
const generateMockValueData = (filters: StatisticsFilters): StockValueDataPoint[] => {
  const days = Math.ceil((filters.dateRange.to.getTime() - filters.dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
  const data: StockValueDataPoint[] = [];

  let currentValue = 125000; // Starting value

  for (let i = 0; i <= days; i++) {
    const date = new Date(filters.dateRange.from);
    date.setDate(date.getDate() + i);

    // Generate realistic variation
    const incomingValue = Math.random() * 15000 + 5000;
    const outgoingValue = Math.random() * 12000 + 3000;
    const netValue = incomingValue - outgoingValue;

    currentValue += netValue;
    currentValue = Math.max(50000, currentValue); // Minimum threshold

    data.push({
      date: format(date, 'dd/MM'),
      totalValue: currentValue,
      incomingValue,
      outgoingValue,
      netValue,
    });
  }

  return data;
};

const formatCurrency = (value: number): string => {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

export const StockValueChart: React.FC<StockValueChartProps> = ({ filters }) => {
  const { data, isLoading, error } = useMemo(() => {
    try {
      const mockData = generateMockValueData(filters);
      return { data: mockData, isLoading: false, error: null };
    } catch (err) {
      return { data: [], isLoading: false, error: 'Erro ao carregar dados' };
    }
  }, [filters]);

  // Calculate trend
  const trend = useMemo(() => {
    if (!data || data.length < 2) return null;

    const firstValue = data[0].totalValue;
    const lastValue = data[data.length - 1].totalValue;
    const change = ((lastValue - firstValue) / firstValue) * 100;

    return {
      percentage: change,
      isPositive: change >= 0,
      absolute: lastValue - firstValue,
    };
  }, [data]);

  const formatTooltipValue = (value: number, name: string) => {
    const formattedValue = formatCurrency(value);
    const nameMap: { [key: string]: string } = {
      totalValue: 'Valor Total',
      incomingValue: 'Entradas',
      outgoingValue: 'Saídas',
      netValue: 'Valor Líquido',
    };
    return [formattedValue, nameMap[name] || name];
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
      {trend && (
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="p-3 rounded-lg border bg-card">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Valor Atual</span>
              {trend.isPositive ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
            </div>
            <div className="text-lg font-semibold">
              {formatCurrency(data[data.length - 1].totalValue)}
            </div>
            <div className={`text-sm ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {trend.isPositive ? '+' : ''}{trend.percentage.toFixed(1)}% ({formatCurrency(trend.absolute)})
            </div>
          </div>

          <div className="p-3 rounded-lg border bg-card">
            <span className="text-sm text-muted-foreground">Média Diária</span>
            <div className="text-lg font-semibold">
              {formatCurrency(data.reduce((acc, item) => acc + item.netValue, 0) / data.length)}
            </div>
            <span className="text-sm text-muted-foreground">Variação líquida</span>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <defs>
              <linearGradient id="totalValueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => formatCurrency(value).replace('R$', 'R$').slice(0, -3) + 'K'}
            />
            <Tooltip
              formatter={formatTooltipValue}
              labelFormatter={(label) => `Data: ${label}`}
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
              }}
            />
            <Area
              type="monotone"
              dataKey="totalValue"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#totalValueGradient)"
              name="Valor Total do Estoque"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};