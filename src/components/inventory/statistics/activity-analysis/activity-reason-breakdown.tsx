import React, { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Loader2 } from "lucide-react";

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

interface ActivityReasonData {
  reason: string;
  count: number;
  percentage: number;
  color: string;
}

interface ActivityReasonBreakdownProps {
  filters: StatisticsFilters;
}

// Mock data generator
const generateMockReasonData = (): ActivityReasonData[] => {
  const reasons = [
    { name: 'Recebimento de Pedido', baseCount: 120, color: '#3b82f6' },
    { name: 'Saída para Produção', baseCount: 95, color: '#ef4444' },
    { name: 'Transferência', baseCount: 45, color: '#f59e0b' },
    { name: 'Ajuste de Inventário', baseCount: 30, color: '#10b981' },
    { name: 'Devolução', baseCount: 25, color: '#8b5cf6' },
    { name: 'Perda/Avaria', baseCount: 15, color: '#ef4444' },
    { name: 'Empréstimo', baseCount: 20, color: '#06b6d4' },
    { name: 'Manutenção', baseCount: 12, color: '#f97316' },
    { name: 'Outros', baseCount: 8, color: '#6b7280' },
  ];

  const data = reasons.map(reason => {
    const variation = Math.random() * 0.4 - 0.2; // ±20% variation
    const count = Math.max(1, Math.floor(reason.baseCount * (1 + variation)));
    return {
      reason: reason.name,
      count,
      percentage: 0, // Will be calculated below
      color: reason.color,
    };
  });

  // Calculate percentages
  const total = data.reduce((sum, item) => sum + item.count, 0);
  data.forEach(item => {
    item.percentage = Number(((item.count / total) * 100).toFixed(1));
  });

  return data.sort((a, b) => b.count - a.count);
};

const RADIAN = Math.PI / 180;

const renderCustomLabel = ({
  cx, cy, midAngle, innerRadius, outerRadius, percent
}: any) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return percent > 0.05 ? ( // Only show label if slice is > 5%
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      fontSize={10}
      fontWeight="bold"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  ) : null;
};

export const ActivityReasonBreakdown: React.FC<ActivityReasonBreakdownProps> = ({ filters }) => {
  const { data, isLoading, error } = useMemo(() => {
    try {
      const mockData = generateMockReasonData();
      return { data: mockData, isLoading: false, error: null };
    } catch (err) {
      return { data: [], isLoading: false, error: 'Erro ao carregar dados' };
    }
  }, [filters]);

  const summary = useMemo(() => {
    if (!data || data.length === 0) return null;

    const total = data.reduce((sum, item) => sum + item.count, 0);
    const topReason = data[0];
    const diversityIndex = data.length; // Number of different reasons

    return {
      total,
      topReason: topReason ? { name: topReason.reason, percentage: topReason.percentage } : null,
      diversityIndex,
    };
  }, [data]);

  const formatTooltipValue = (value: number, name: string) => {
    return [`${value} atividades (${((value / summary!.total) * 100).toFixed(1)}%)`, 'Quantidade'];
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
      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
          <div className="text-center p-2 rounded bg-muted/50">
            <div className="font-semibold">{summary.total}</div>
            <div className="text-muted-foreground">Total</div>
          </div>
          <div className="text-center p-2 rounded bg-muted/50">
            <div className="font-semibold">{summary.diversityIndex}</div>
            <div className="text-muted-foreground">Tipos</div>
          </div>
          <div className="text-center p-2 rounded bg-muted/50">
            <div className="font-semibold text-primary">
              {summary.topReason?.percentage}%
            </div>
            <div className="text-muted-foreground">Principal</div>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomLabel}
              outerRadius={60}
              fill="#8884d8"
              dataKey="count"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={formatTooltipValue}
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
                fontSize: '11px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="mt-4 space-y-1">
        <div className="grid grid-cols-1 gap-1 text-xs">
          {data.slice(0, 6).map((item, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: item.color }}
                />
                <span className="truncate">{item.reason}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="font-mono">{item.count}</span>
                <span>({item.percentage}%)</span>
              </div>
            </div>
          ))}
        </div>

        {data.length > 6 && (
          <div className="text-xs text-muted-foreground text-center pt-1 border-t">
            +{data.length - 6} outros motivos
          </div>
        )}
      </div>

      {/* Top Reason Highlight */}
      {summary?.topReason && (
        <div className="mt-3 p-2 rounded bg-primary/10 border border-primary/20">
          <div className="text-xs text-center">
            <span className="text-muted-foreground">Motivo mais comum: </span>
            <span className="font-semibold text-primary">
              {summary.topReason.name}
            </span>
            <span className="text-muted-foreground"> ({summary.topReason.percentage}% das atividades)</span>
          </div>
        </div>
      )}
    </div>
  );
};