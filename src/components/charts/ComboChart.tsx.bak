/**
 * Combo Chart Component
 *
 * Renders combination charts with multiple chart types (line, bar, area).
 */

import * as React from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChartConfiguration } from '@/lib/charts/chart-config';
import { ChartTooltip } from './ChartTooltip';
import { ChartLegend } from './ChartLegend';

export interface ComboChartProps {
  config: ChartConfiguration;
  data: any[];
}

export const ComboChart: React.FC<ComboChartProps> = ({ config, data }) => {
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

  const formatSecondaryYAxisTick = (value: any) => {
    if (config.secondaryYAxis?.tickFormatter) {
      return config.secondaryYAxis.tickFormatter(value);
    }
    if (config.secondaryYAxis?.unit) {
      return `${value}${config.secondaryYAxis.unit}`;
    }
    return value;
  };

  // Render the appropriate chart component based on series type
  const renderSeries = (series: any) => {
    const seriesType = series.type || 'bar';

    const commonProps = {
      key: series.dataKey,
      dataKey: series.dataKey,
      name: series.name,
      yAxisId: series.yAxisId || 'left',
      animationDuration: 300,
    };

    switch (seriesType) {
      case 'line':
        return (
          <Line
            {...commonProps}
            type="monotone"
            stroke={series.color || '#3b82f6'}
            strokeWidth={series.lineStyle?.width || 2}
            strokeDasharray={series.lineStyle?.type === 'dashed' ? '5 5' : undefined}
            dot={{ fill: series.color || '#3b82f6', r: 3 }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        );

      case 'area':
        return (
          <>
            <defs>
              <linearGradient
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
            </defs>
            <Area
              {...commonProps}
              type="monotone"
              stroke={series.color || '#3b82f6'}
              fill={`url(#gradient-${series.dataKey})`}
              strokeWidth={2}
              stackId={series.stackId}
              connectNulls
            />
          </>
        );

      case 'bar':
      default:
        return (
          <Bar
            {...commonProps}
            fill={series.color || '#3b82f6'}
            stackId={series.stackId}
            radius={[4, 4, 0, 0]}
          />
        );
    }
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
        <ComposedChart
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
            type={config.xAxis?.type}
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
            yAxisId="left"
            type={config.yAxis?.type}
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

          {config.secondaryYAxis && (
            <YAxis
              yAxisId="right"
              orientation="right"
              type={config.secondaryYAxis.type}
              tickFormatter={formatSecondaryYAxisTick}
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              hide={config.secondaryYAxis.hide}
              domain={config.secondaryYAxis.domain}
              allowDecimals={config.secondaryYAxis.allowDecimals}
              label={
                config.secondaryYAxis.label
                  ? {
                      value: config.secondaryYAxis.label,
                      angle: 90,
                      position: 'insideRight',
                      style: { fill: 'hsl(var(--muted-foreground))' },
                    }
                  : undefined
              }
            />
          )}

          {config.tooltip?.show !== false && (
            <Tooltip
              content={<ChartTooltip config={config.tooltip} />}
              cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
            />
          )}

          {!config.legend && <Legend />}

          {visibleSeries.map((series) => renderSeries(series))}
        </ComposedChart>
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

ComboChart.displayName = 'ComboChart';
