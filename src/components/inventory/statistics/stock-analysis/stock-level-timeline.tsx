import React, { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

// Types for component props
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

interface StockDataPoint {
  date: string;
  totalItems: number;
  totalValue: number;
  lowStockItems: number;
  criticalItems: number;
}

interface StockLevelTimelineProps {
  filters: StatisticsFilters;
}

// Mock data generator for demonstration
const generateMockStockData = (filters: StatisticsFilters): StockDataPoint[] => {
  const days = Math.ceil((filters.dateRange.to.getTime() - filters.dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
  const data: StockDataPoint[] = [];

  for (let i = 0; i <= days; i++) {
    const date = new Date(filters.dateRange.from);
    date.setDate(date.getDate() + i);

    // Generate realistic mock data with some variation
    const baseItems = 850;
    const variation = Math.sin(i * 0.1) * 50 + Math.random() * 30 - 15;
    const totalItems = Math.max(0, Math.floor(baseItems + variation));

    data.push({
      date: format(date, 'dd/MM'),
      totalItems,
      totalValue: totalItems * 45.5, // Average item value
      lowStockItems: Math.floor(totalItems * 0.12 + Math.random() * 10),
      criticalItems: Math.floor(totalItems * 0.03 + Math.random() * 5),
    });
  }

  return data;
};

export const StockLevelTimeline: React.FC<StockLevelTimelineProps> = ({ filters }) => {
  // In a real implementation, this would be fetched from an API
  const { data, isLoading, error } = useMemo(() => {
    try {
      const mockData = generateMockStockData(filters);
      return { data: mockData, isLoading: false, error: null };
    } catch (err) {
      return { data: [], isLoading: false, error: 'Erro ao carregar dados' };
    }
  }, [filters]);

  const formatTooltipValue = (value: number, name: string) => {
    if (name === 'totalValue') {
      return [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Valor Total'];
    }
    return [value.toLocaleString('pt-BR'), name];
  };

  const formatTooltipLabel = (label: string) => {
    return `Data: ${label}`;
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
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
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
            tick={{ fontSize: 12 }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 12 }}
            domain={['dataMin - 10', 'dataMax + 10']}
          />
          <Tooltip
            formatter={formatTooltipValue}
            labelFormatter={formatTooltipLabel}
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="totalItems"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6 }}
            name="Total de Itens"
          />
          <Line
            type="monotone"
            dataKey="lowStockItems"
            stroke="hsl(var(--warning))"
            strokeWidth={2}
            dot={{ fill: 'hsl(var(--warning))', strokeWidth: 2, r: 4 }}
            name="Estoque Baixo"
          />
          <Line
            type="monotone"
            dataKey="criticalItems"
            stroke="hsl(var(--destructive))"
            strokeWidth={2}
            dot={{ fill: 'hsl(var(--destructive))', strokeWidth: 2, r: 4 }}
            name="Estoque Crítico"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};