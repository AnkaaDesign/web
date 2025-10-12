/**
 * InventoryLevelChart
 * Business-specific chart for inventory levels with:
 * - Current stock levels
 * - Reorder points visualization
 * - Safety stock indicators
 * - ABC/XYZ category colors
 */

import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  LabelList,
} from 'recharts';
import { ChartWrapper, ExportData } from '../base/ChartWrapper';
import { ChartTooltip } from '../base/ChartTooltip';
import { COLOR_PALETTES } from '../utils/chart-colors';
import { formatNumber } from '../utils/chart-formatters';
import { Package } from 'lucide-react';

export interface InventoryItem {
  id: string;
  name: string;
  currentStock: number;
  reorderPoint: number;
  safetyStock: number;
  maxStock?: number;
  unit: string;
  category?: 'A' | 'B' | 'C';
  demandPattern?: 'X' | 'Y' | 'Z';
}

export interface InventoryLevelChartProps {
  data: InventoryItem[];
  className?: string;
  title?: string;
  description?: string;
  height?: number;
  showReorderPoints?: boolean;
  showSafetyStock?: boolean;
  colorByCategory?: boolean;
  colorByStatus?: boolean;
  onRefresh?: () => void;
  onItemClick?: (item: InventoryItem) => void;
  isLoading?: boolean;
  error?: Error | string | null;
}

export const InventoryLevelChart = React.memo<InventoryLevelChartProps>(({
  data,
  className,
  title = 'Níveis de Estoque',
  description = 'Situação atual do estoque com pontos de reposição',
  height = 400,
  showReorderPoints = true,
  showSafetyStock = true,
  colorByCategory = false,
  colorByStatus = true,
  onRefresh,
  onItemClick,
  isLoading,
  error,
}) => {
  // Process data for chart
  const chartData = useMemo(() => {
    return data.map(item => ({
      name: item.name,
      currentStock: item.currentStock,
      reorderPoint: item.reorderPoint,
      safetyStock: item.safetyStock,
      maxStock: item.maxStock,
      category: item.category,
      demandPattern: item.demandPattern,
      unit: item.unit,
      status: getStockStatus(item),
      originalData: item,
    }));
  }, [data]);

  // Determine stock status
  function getStockStatus(item: InventoryItem): 'critical' | 'low' | 'normal' | 'high' {
    if (item.currentStock <= item.safetyStock) return 'critical';
    if (item.currentStock <= item.reorderPoint) return 'low';
    if (item.maxStock && item.currentStock >= item.maxStock) return 'high';
    return 'normal';
  }

  // Get color based on status or category
  const getBarColor = (entry: any): string => {
    if (colorByStatus) {
      const statusColors = {
        critical: COLOR_PALETTES.inventory.outOfStock,
        low: COLOR_PALETTES.inventory.lowStock,
        normal: COLOR_PALETTES.inventory.inStock,
        high: COLOR_PALETTES.inventory.overStock,
      };
      return statusColors[entry.status as keyof typeof statusColors];
    }

    if (colorByCategory && entry.category) {
      return COLOR_PALETTES.abc[entry.category as 'A' | 'B' | 'C'];
    }

    return COLOR_PALETTES.primary[0];
  };

  // Prepare export data
  const exportData: ExportData = useMemo(() => {
    const headers = ['Item', 'Estoque Atual', 'Ponto de Reposição', 'Estoque de Segurança', 'Status', 'Unidade'];
    const rows = data.map(item => [
      item.name,
      item.currentStock,
      item.reorderPoint,
      item.safetyStock,
      getStockStatus(item),
      item.unit,
    ]);

    return { headers, rows };
  }, [data]);

  const isEmpty = !chartData || chartData.length === 0;

  return (
    <ChartWrapper
      title={title}
      description={description}
      icon={<Package className="h-5 w-5" />}
      className={className}
      height={height}
      isLoading={isLoading}
      error={error}
      isEmpty={isEmpty}
      emptyMessage="Nenhum item de estoque disponível"
      onRefresh={onRefresh}
      exportData={exportData}
      exportFilename={`inventory-levels-${Date.now()}`}
      showRefresh={!!onRefresh}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
          onClick={(e) => {
            if (e?.activePayload?.[0]?.payload?.originalData && onItemClick) {
              onItemClick(e.activePayload[0].payload.originalData);
            }
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />

          <XAxis
            dataKey="name"
            angle={-45}
            textAnchor="end"
            height={80}
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
          />

          <YAxis
            label={{
              value: 'Quantidade',
              angle: -90,
              position: 'insideLeft',
              style: { textAnchor: 'middle' }
            }}
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
          />

          <Tooltip
            content={(props) => {
              if (!props.active || !props.payload || props.payload.length === 0) return null;

              const data = props.payload[0].payload;

              return (
                <div className="rounded-lg border border-border bg-background/95 backdrop-blur-sm shadow-lg p-3">
                  <div className="font-medium text-foreground mb-2">{data.name}</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Estoque Atual:</span>
                      <span className="font-medium">{formatNumber(data.currentStock)} {data.unit}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Ponto de Reposição:</span>
                      <span className="font-medium">{formatNumber(data.reorderPoint)} {data.unit}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Estoque de Segurança:</span>
                      <span className="font-medium">{formatNumber(data.safetyStock)} {data.unit}</span>
                    </div>
                    <div className="flex justify-between gap-4 pt-1 border-t border-border">
                      <span className="text-muted-foreground">Status:</span>
                      <span className={`font-medium ${
                        data.status === 'critical' ? 'text-red-500' :
                        data.status === 'low' ? 'text-amber-500' :
                        data.status === 'high' ? 'text-blue-500' :
                        'text-green-500'
                      }`}>
                        {data.status === 'critical' ? 'Crítico' :
                         data.status === 'low' ? 'Baixo' :
                         data.status === 'high' ? 'Alto' :
                         'Normal'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            }}
          />

          <Legend
            wrapperStyle={{ paddingTop: 20 }}
            payload={[
              { value: 'Estoque Atual', type: 'square', color: COLOR_PALETTES.primary[0] },
              ...(showReorderPoints ? [{ value: 'Ponto de Reposição', type: 'line', color: '#f59e0b' }] : []),
              ...(showSafetyStock ? [{ value: 'Estoque de Segurança', type: 'line', color: '#ef4444' }] : []),
            ]}
          />

          {/* Current stock bars */}
          <Bar
            dataKey="currentStock"
            name="Estoque Atual"
            radius={[4, 4, 0, 0]}
            maxBarSize={60}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry)} />
            ))}
            <LabelList
              dataKey="currentStock"
              position="top"
              formatter={(value: number) => formatNumber(value)}
              fontSize={10}
              fill="hsl(var(--muted-foreground))"
            />
          </Bar>

          {/* Reorder point reference lines */}
          {showReorderPoints && chartData.map((item, index) => (
            <ReferenceLine
              key={`reorder-${index}`}
              segment={[
                { x: item.name, y: item.reorderPoint },
                { x: item.name, y: item.reorderPoint },
              ]}
              stroke="#f59e0b"
              strokeDasharray="5 5"
              strokeWidth={2}
              ifOverflow="extendDomain"
            />
          ))}

          {/* Safety stock reference lines */}
          {showSafetyStock && chartData.map((item, index) => (
            <ReferenceLine
              key={`safety-${index}`}
              segment={[
                { x: item.name, y: item.safetyStock },
                { x: item.name, y: item.safetyStock },
              ]}
              stroke="#ef4444"
              strokeDasharray="3 3"
              strokeWidth={1.5}
              ifOverflow="extendDomain"
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
});

InventoryLevelChart.displayName = 'InventoryLevelChart';
