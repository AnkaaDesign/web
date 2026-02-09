/**
 * Bar Chart Component
 *
 * Renders bar charts using Recharts for categorical comparisons.
 */

import * as React from 'react';
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { ChartConfiguration } from '@/lib/charts/chart-config';
import { ChartTooltip } from './ChartTooltip';
import { ChartLegend } from './ChartLegend';

export interface BarChartProps {
  config: ChartConfiguration;
  data: any[];
}

export const BarChart: React.FC<BarChartProps> = ({ config, data }) => {
  const [hiddenSeries, setHiddenSeries] = React.useState<Set<string>>(new Set());

  const handleToggleSeries = (seriesName: string) => {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(seriesName)) {
        next.delete(seriesName);
      } else {
        next.add(seriesName);
      }
      return next;
    });
  };

  const visibleSeries = config.series.filter((s) => !hiddenSeries.has(s.name));

  // Format tick values
  const formatXAxisTick = (value: any) => {
    if (config.xAxis?.tickFormatter) {
      return config.xAxis.tickFormatter(value);
    }
    return value;
  };

  const formatYAxisTick = (value: any) => {
    if (config.yAxis?.tickFormatter) {
      return config.yAxis.tickFormatter(value);
    }
    if (config.yAxis?.unit) {
      return `${value}${config.yAxis.unit}`;
    }
    return value;
  };

  // Use single series colors if only one series
  const isSingleSeries = config.series.length === 1;
  const colors = config.style?.colors || [
    '#3b82f6',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#06b6d4',
  ];

  return (
    <div className="w-full h-full flex flex-col">
      {config.legend?.position === 'top' && (
        <ChartLegend
          series={config.series}
          config={config.legend}
          hiddenSeries={hiddenSeries}
          onToggleSeries={handleToggleSeries}
        />
      )}

      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={data}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
          layout={config.xAxis?.type === 'number' ? 'horizontal' : 'vertical'}
        >
          {config.style?.grid?.show !== false && (
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
          )}

          <XAxis
            dataKey={config.xAxis?.dataKey}
            type={config.xAxis?.type === 'number' ? 'number' : 'category'}
            tickFormatter={formatXAxisTick}
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            hide={config.xAxis?.hide}
            angle={-45}
            textAnchor="end"
            height={80}
            label={
              config.xAxis?.label
                ? {
                    value: config.xAxis.label,
                    position: 'insideBottom',
                    offset: -5,
                    style: { fill: 'hsl(var(--muted-foreground))' },
                  }
                : undefined
            }
          />

          <YAxis
            type={config.yAxis?.type === 'category' ? 'category' : 'number'}
            tickFormatter={formatYAxisTick}
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            hide={config.yAxis?.hide}
            domain={config.yAxis?.domain}
            allowDecimals={config.yAxis?.allowDecimals}
            label={
              config.yAxis?.label
                ? {
                    value: config.yAxis.label,
                    angle: -90,
                    position: 'insideLeft',
                    style: { fill: 'hsl(var(--muted-foreground))' },
                  }
                : undefined
            }
          />

          {config.tooltip?.show !== false && (
            <Tooltip
              content={<ChartTooltip config={config.tooltip} />}
              cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
            />
          )}

          {!config.legend && <Legend />}

          {visibleSeries.map((series) => (
            <Bar
              key={series.dataKey}
              dataKey={series.dataKey}
              name={series.name}
              fill={series.color || '#3b82f6'}
              stackId={series.stackId}
              radius={[4, 4, 0, 0]}
              animationDuration={300}
            >
              {isSingleSeries &&
                data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
            </Bar>
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>

      {config.legend?.position === 'bottom' && (
        <ChartLegend
          series={config.series}
          config={config.legend}
          hiddenSeries={hiddenSeries}
          onToggleSeries={handleToggleSeries}
        />
      )}
    </div>
  );
};

BarChart.displayName = 'BarChart';
