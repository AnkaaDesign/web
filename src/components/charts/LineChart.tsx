/**
 * Line Chart Component
 *
 * Renders line charts using Recharts for time series and trend data.
 */

import * as React from 'react';
import {
  LineChart as RechartsLineChart,
  Line,
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

export interface LineChartProps {
  config: ChartConfiguration;
  data: any[];
}

export const LineChart: React.FC<LineChartProps> = ({ config, data }) => {
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
        <RechartsLineChart
          data={data}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
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
            <Line
              key={series.dataKey}
              type="monotone"
              dataKey={series.dataKey}
              name={series.name}
              stroke={series.color || '#3b82f6'}
              strokeWidth={series.lineStyle?.width || 2}
              strokeDasharray={series.lineStyle?.type === 'dashed' ? '5 5' : undefined}
              dot={{ fill: series.color || '#3b82f6', r: 3 }}
              activeDot={{ r: 5 }}
              animationDuration={300}
              connectNulls
            />
          ))}

          {config.interaction?.brush?.enabled && <Brush dataKey={config.xAxis?.dataKey} height={30} stroke="hsl(var(--primary))" />}
        </RechartsLineChart>
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

LineChart.displayName = 'LineChart';
