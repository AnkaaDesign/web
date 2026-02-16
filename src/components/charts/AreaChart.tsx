/**
 * Area Chart Component
 *
 * Renders area charts using Recharts for cumulative trends.
 */

import * as React from 'react';
import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
} from 'recharts';
import type { ChartConfiguration } from '@/lib/charts/chart-config';
import { ChartTooltip } from './ChartTooltip';
import { ChartLegend } from './ChartLegend';

export interface AreaChartProps {
  config: ChartConfiguration;
  data: any[];
}

export const AreaChart: React.FC<AreaChartProps> = ({ config, data }) => {
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
    if (config.xAxis?.type === 'time') {
      return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
        <RechartsAreaChart
          data={data}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <defs>
            {visibleSeries.map((series) => (
              <linearGradient
                key={`gradient-${series.dataKey}`}
                id={`gradient-${series.dataKey}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor={series.color || '#3b82f6'}
                  stopOpacity={series.areaStyle?.opacity || 0.8}
                />
                <stop
                  offset="95%"
                  stopColor={series.color || '#3b82f6'}
                  stopOpacity={0.1}
                />
              </linearGradient>
            ))}
          </defs>

          {config.style?.grid?.show !== false && (
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
          )}

          <XAxis
            dataKey={config.xAxis?.dataKey}
            type={config.xAxis?.type === 'time' ? 'number' : config.xAxis?.type}
            tickFormatter={formatXAxisTick}
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            hide={config.xAxis?.hide}
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
            type={config.yAxis?.type === 'time' ? 'number' : config.yAxis?.type}
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
              cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
            />
          )}

          {!config.legend && <Legend />}

          {visibleSeries.map((series) => (
            <Area
              key={series.dataKey}
              type="monotone"
              dataKey={series.dataKey}
              name={series.name}
              stroke={series.color || '#3b82f6'}
              fill={`url(#gradient-${series.dataKey})`}
              strokeWidth={2}
              stackId={series.stackId}
              animationDuration={300}
              connectNulls
            />
          ))}

          {config.interaction?.brush?.enabled && (
            <Brush dataKey={config.xAxis?.dataKey} height={30} stroke="hsl(var(--primary))" />
          )}
        </RechartsAreaChart>
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

AreaChart.displayName = 'AreaChart';
