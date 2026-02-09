/**
 * Pie Chart Component
 *
 * Renders pie and donut charts using Recharts for proportional data.
 */

import * as React from 'react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { ChartConfiguration } from '@/lib/charts/chart-config';
import { ChartTooltip } from './ChartTooltip';
import { ChartLegend } from './ChartLegend';

export interface PieChartProps {
  config: ChartConfiguration;
  data: any[];
  variant?: 'pie' | 'donut';
}

export const PieChart: React.FC<PieChartProps> = ({ config, data, variant = 'pie' }) => {
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);
  const [hiddenSlices, setHiddenSlices] = React.useState<Set<string>>(new Set());

  const colors = config.style?.colors || [
    '#3b82f6',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#06b6d4',
    '#ec4899',
    '#14b8a6',
  ];

  // Get the value key from the first series
  const valueKey = config.series[0]?.dataKey || 'value';
  const nameKey = config.xAxis?.dataKey || 'name';

  // Filter data based on hidden slices
  const visibleData = data.filter((item) => !hiddenSlices.has(item[nameKey]));

  // Calculate percentages
  const total = visibleData.reduce((sum, item) => sum + (Number(item[valueKey]) || 0), 0);

  const dataWithPercentages = visibleData.map((item) => ({
    ...item,
    percentage: total > 0 ? ((Number(item[valueKey]) / total) * 100).toFixed(1) : 0,
  }));

  const handleToggleSlice = (name: string) => {
    setHiddenSlices((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  const onPieLeave = () => {
    setActiveIndex(null);
  };

  // Custom label renderer
  const renderLabel = (entry: any) => {
    if (config.series[0]?.label?.show === false) {
      return null;
    }
    return `${entry.percentage}%`;
  };

  // Create series for legend
  const legendSeries = data.map((item) => ({
    name: item[nameKey],
    dataKey: valueKey,
    color: colors[data.indexOf(item) % colors.length],
  }));

  return (
    <div className="w-full h-full flex flex-col">
      {config.legend?.position === 'top' && (
        <ChartLegend
          series={legendSeries}
          config={config.legend}
          hiddenSeries={hiddenSlices}
          onToggleSeries={handleToggleSlice}
        />
      )}

      <ResponsiveContainer width="100%" height="100%">
        <RechartsPieChart>
          <Pie
            data={dataWithPercentages}
            dataKey={valueKey}
            nameKey={nameKey}
            cx="50%"
            cy="50%"
            outerRadius={variant === 'donut' ? '80%' : '70%'}
            innerRadius={variant === 'donut' ? '50%' : 0}
            label={renderLabel}
            labelLine={variant === 'pie'}
            onMouseEnter={onPieEnter}
            onMouseLeave={onPieLeave}
            animationDuration={300}
          >
            {dataWithPercentages.map((_entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={colors[index % colors.length]}
                opacity={activeIndex !== null && activeIndex !== index ? 0.6 : 1}
                stroke="hsl(var(--background))"
                strokeWidth={2}
              />
            ))}
          </Pie>

          {config.tooltip?.show !== false && (
            <Tooltip content={<ChartTooltip config={config.tooltip} />} />
          )}

          {!config.legend && <Legend />}
        </RechartsPieChart>
      </ResponsiveContainer>

      {config.legend?.position === 'bottom' && (
        <ChartLegend
          series={legendSeries}
          config={config.legend}
          hiddenSeries={hiddenSlices}
          onToggleSeries={handleToggleSlice}
        />
      )}

      {variant === 'donut' && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
          <div className="text-3xl font-bold text-foreground">{total.toLocaleString()}</div>
          <div className="text-sm text-muted-foreground mt-1">Total</div>
        </div>
      )}
    </div>
  );
};

PieChart.displayName = 'PieChart';
