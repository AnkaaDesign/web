import React, { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Loader2, RotateCcw, TrendingUp } from "lucide-react";

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

interface TurnoverDataPoint {
  category: string;
  turnoverRate: number;
  avgInventory: number;
  salesVolume: number;
  performance: 'excellent' | 'good' | 'average' | 'poor';
}

interface StockTurnoverRateProps {
  filters: StatisticsFilters;
}

// Mock data generator
const generateMockTurnoverData = (): TurnoverDataPoint[] => {
  const categories = [
    'Ferramentas',
    'Materiais',
    'EPI',
    'Eletrônicos',
    'Consumíveis',
    'Peças',
    'Química',
    'Uniformes'
  ];

  return categories.map(category => {
    const salesVolume = Math.random() * 50000 + 10000;
    const avgInventory = Math.random() * 20000 + 5000;
    const turnoverRate = salesVolume / avgInventory;

    let performance: TurnoverDataPoint['performance'];
    if (turnoverRate >= 8) performance = 'excellent';
    else if (turnoverRate >= 6) performance = 'good';
    else if (turnoverRate >= 4) performance = 'average';
    else performance = 'poor';

    return {
      category,
      turnoverRate: Number(turnoverRate.toFixed(2)),
      avgInventory,
      salesVolume,
      performance,
    };
  }).sort((a, b) => b.turnoverRate - a.turnoverRate);
};

const getPerformanceColor = (performance: TurnoverDataPoint['performance']) => {
  switch (performance) {
    case 'excellent':
      return '#16a34a'; // green
    case 'good':
      return '#84cc16'; // lime
    case 'average':
      return '#eab308'; // yellow
    case 'poor':
      return '#ef4444'; // red
    default:
      return '#6b7280'; // gray
  }
};

const getPerformanceLabel = (performance: TurnoverDataPoint['performance']) => {
  switch (performance) {
    case 'excellent':
      return 'Excelente';
    case 'good':
      return 'Bom';
    case 'average':
      return 'Médio';
    case 'poor':
      return 'Ruim';
    default:
      return 'N/A';
  }
};

export const StockTurnoverRate: React.FC<StockTurnoverRateProps> = ({ filters }) => {
  const { data, isLoading, error } = useMemo(() => {
    try {
      const mockData = generateMockTurnoverData();
      return { data: mockData, isLoading: false, error: null };
    } catch (err) {
      return { data: [], isLoading: false, error: 'Erro ao carregar dados' };
    }
  }, [filters]);

  const summary = useMemo(() => {
    if (!data || data.length === 0) return null;

    const avgTurnover = data.reduce((acc, item) => acc + item.turnoverRate, 0) / data.length;
    const bestCategory = data[0];
    const worstCategory = data[data.length - 1];

    return {
      avgTurnover: Number(avgTurnover.toFixed(2)),
      bestCategory: bestCategory?.category || 'N/A',
      bestRate: bestCategory?.turnoverRate || 0,
      worstCategory: worstCategory?.category || 'N/A',
      worstRate: worstCategory?.turnoverRate || 0,
      totalCategories: data.length,
    };
  }, [data]);

  const formatTooltipValue = (value: number, name: string) => {
    if (name === 'turnoverRate') {
      return [`${value.toFixed(2)}x`, 'Taxa de Giro'];
    }
    return [value.toLocaleString('pt-BR'), name];
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
        <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
          <div className="p-2 rounded-lg border bg-card">
            <div className="flex items-center gap-1 mb-1">
              <RotateCcw className="h-3 w-3" />
              <span className="text-muted-foreground">Média Geral</span>
            </div>
            <div className="font-semibold">{summary.avgTurnover}x</div>
          </div>

          <div className="p-2 rounded-lg border bg-card">
            <div className="flex items-center gap-1 mb-1">
              <TrendingUp className="h-3 w-3 text-green-600" />
              <span className="text-muted-foreground">Melhor</span>
            </div>
            <div className="font-semibold text-green-600">
              {summary.bestCategory}
            </div>
            <div className="text-xs text-muted-foreground">
              {summary.bestRate.toFixed(2)}x
            </div>
          </div>

          <div className="p-2 rounded-lg border bg-card">
            <div className="flex items-center gap-1 mb-1">
              <div className="h-3 w-3 rounded bg-red-500"></div>
              <span className="text-muted-foreground">Pior</span>
            </div>
            <div className="font-semibold text-red-600">
              {summary.worstCategory}
            </div>
            <div className="text-xs text-muted-foreground">
              {summary.worstRate.toFixed(2)}x
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
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
              dataKey="category"
              tick={{ fontSize: 10 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis
              tick={{ fontSize: 10 }}
              tickFormatter={(value) => `${value}x`}
            />
            <Tooltip
              formatter={formatTooltipValue}
              labelFormatter={(label) => `Categoria: ${label}`}
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
                fontSize: '12px',
              }}
            />
            <Bar dataKey="turnoverRate" name="Taxa de Giro" radius={[2, 2, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getPerformanceColor(entry.performance)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Performance Legend */}
      <div className="mt-4 flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-600"></div>
          <span>Excelente (≥8x)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-lime-500"></div>
          <span>Bom (6-8x)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-yellow-500"></div>
          <span>Médio (4-6x)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-500"></div>
          <span>Ruim (&lt;4x)</span>
        </div>
      </div>

      {/* Information */}
      <div className="mt-2 text-xs text-muted-foreground">
        <p>Taxa de giro = Volume de vendas ÷ Estoque médio. Valores maiores indicam melhor eficiência.</p>
      </div>
    </div>
  );
};