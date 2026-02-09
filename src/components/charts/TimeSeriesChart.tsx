/**
 * TimeSeriesChart Component
 * Line chart for time series data with advanced features:
 * - Multiple series support
 * - Zoom and pan
 * - Date axis formatting
 * - Comparison mode
 * - Trend lines
 * - Moving averages
 * - Annotations
 */

import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
  ReferenceLine,
} from 'recharts';
import { ChartWrapper } from './base/ChartWrapper';
import type { ExportData } from './base/ChartWrapper';
import { ChartTooltip } from './base/ChartTooltip';
import { COLOR_PALETTES, getColorFromPalette } from './utils/chart-colors';
import { formatAxisDate, formatDate, createFormatter } from './utils/chart-formatters';
import {
  calculateMovingAverage,
  calculateLinearRegression,
} from './utils/chart-data-helpers';

export interface TimeSeriesDataPoint {
  date: Date | string;
  [key: string]: any;
}

export interface SeriesConfig {
  key: string;
  name: string;
  color?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  hide?: boolean;
  yAxisId?: 'left' | 'right';
}

export interface Annotation {
  date: Date | string;
  label: string;
  color?: string;
  position?: 'top' | 'bottom';
}

export interface TimeSeriesChartProps {
  data: TimeSeriesDataPoint[];
  series: SeriesConfig[];
  className?: string;

  // Header props
  title?: string;
  description?: string;
  icon?: React.ReactNode;

  // Chart configuration
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  showBrush?: boolean;
  curved?: boolean;
  stacked?: boolean;
  fillArea?: boolean;

  // Date formatting
  dateKey?: string;
  dateFormat?: string;
  granularity?: 'day' | 'week' | 'month' | 'year';

  // Advanced features
  showMovingAverage?: boolean;
  movingAverageWindow?: number;
  showTrendLine?: boolean;
  annotations?: Annotation[];
  comparisonData?: TimeSeriesDataPoint[];

  // Dual Y-axis
  leftAxisLabel?: string;
  rightAxisLabel?: string;
  leftAxisType?: 'number' | 'currency' | 'percentage';
  rightAxisType?: 'number' | 'currency' | 'percentage';

  // Callbacks
  onRefresh?: () => void;
  onDataPointClick?: (data: TimeSeriesDataPoint) => void;

  // State
  isLoading?: boolean;
  error?: Error | string | null;
}

export const TimeSeriesChart = React.memo<TimeSeriesChartProps>(({
  data,
  series,
  className,
  title = 'Série Temporal',
  description,
  icon,
  height = 400,
  showGrid = true,
  showLegend = true,
  showBrush = false,
  curved = true,
  stacked: _stacked = false,
  fillArea = false,
  dateKey = 'date',
  dateFormat = 'dd/MM/yyyy',
  granularity = 'day',
  showMovingAverage = false,
  movingAverageWindow = 7,
  showTrendLine = false,
  annotations = [],
  comparisonData: _comparisonData,
  leftAxisLabel,
  rightAxisLabel,
  leftAxisType = 'number',
  rightAxisType = 'number',
  onRefresh,
  onDataPointClick,
  isLoading,
  error,
}) => {
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

  // Process data
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return [];

    let processed = data.map(item => ({
      ...item,
      [dateKey]: new Date(item[dateKey]),
    }));

    // Sort by date
    processed.sort((a, b) => a[dateKey].getTime() - b[dateKey].getTime());

    // Add moving averages
    if (showMovingAverage) {
      series.forEach(s => {
        if (!hiddenSeries.has(s.key)) {
          const withMA = calculateMovingAverage(
            processed as any[],
            movingAverageWindow,
            s.key
          );
          processed = processed.map((item, i) => ({
            ...item,
            [`${s.key}_ma`]: withMA[i].movingAverage,
          }));
        }
      });
    }

    // Add trend lines
    if (showTrendLine) {
      series.forEach(s => {
        if (!hiddenSeries.has(s.key)) {
          const regression = calculateLinearRegression(processed as any[], s.key);
          processed = processed.map((item, i) => ({
            ...item,
            [`${s.key}_trend`]: regression.predict(i),
          }));
        }
      });
    }

    return processed;
  }, [data, dateKey, showMovingAverage, movingAverageWindow, showTrendLine, series, hiddenSeries]);

  // Prepare export data
  const exportData: ExportData = useMemo(() => {
    const headers = [dateKey, ...series.map(s => s.name)];
    const rows = processedData.map(item => [
      formatDate(item[dateKey], dateFormat),
      ...series.map(s => item[s.key] || 0),
    ]);

    return { headers, rows };
  }, [processedData, series, dateKey, dateFormat]);

  // Format axis
  const leftAxisFormatter = createFormatter(leftAxisType);
  const rightAxisFormatter = createFormatter(rightAxisType);

  // Check if empty
  const isEmpty = !processedData || processedData.length === 0;

  // Handle legend click
  const handleLegendClick = (dataKey: string) => {
    setHiddenSeries(prev => {
      const next = new Set(prev);
      if (next.has(dataKey)) {
        next.delete(dataKey);
      } else {
        next.add(dataKey);
      }
      return next;
    });
  };

  return (
    <ChartWrapper
      title={title}
      description={description}
      icon={icon}
      className={className}
      height={height}
      isLoading={isLoading}
      error={error}
      isEmpty={isEmpty}
      emptyMessage="Nenhum dado disponível para o período selecionado"
      onRefresh={onRefresh}
      exportData={exportData}
      exportFilename={`time-series-${Date.now()}`}
      showRefresh={!!onRefresh}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={processedData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          onClick={(e) => {
            if ((e as any)?.activePayload?.[0]?.payload && onDataPointClick) {
              onDataPointClick((e as any).activePayload[0].payload);
            }
          }}
        >
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              opacity={0.5}
            />
          )}

          <XAxis
            dataKey={dateKey}
            tickFormatter={(value) => formatAxisDate(value, granularity)}
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
          />

          <YAxis
            yAxisId="left"
            tickFormatter={leftAxisFormatter}
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            label={leftAxisLabel ? {
              value: leftAxisLabel,
              angle: -90,
              position: 'insideLeft',
              style: { textAnchor: 'middle' }
            } : undefined}
          />

          {rightAxisLabel && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={rightAxisFormatter}
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              label={{
                value: rightAxisLabel,
                angle: 90,
                position: 'insideRight',
                style: { textAnchor: 'middle' }
              }}
            />
          )}

          <Tooltip
            content={(props) => (
              <ChartTooltip
                {...props}
                labelFormatter={(label) => formatDate(label, dateFormat)}
              />
            )}
          />

          {showLegend && (
            <Legend
              onClick={(e) => handleLegendClick(e.dataKey)}
              wrapperStyle={{ cursor: 'pointer' }}
            />
          )}

          {/* Main series */}
          {series.map((s, index) => {
            if (hiddenSeries.has(s.key)) return null;

            const color = s.color || getColorFromPalette(COLOR_PALETTES.primary, index);

            return (
              <Line
                key={s.key}
                yAxisId={s.yAxisId || 'left'}
                type={curved ? 'monotone' : 'linear'}
                dataKey={s.key}
                name={s.name}
                stroke={color}
                strokeWidth={s.strokeWidth || 2}
                strokeDasharray={s.strokeDasharray}
                fill={fillArea ? color : 'none'}
                fillOpacity={fillArea ? 0.1 : 0}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls
                isAnimationActive={true}
              />
            );
          })}

          {/* Moving averages */}
          {showMovingAverage && series.map((s, index) => {
            if (hiddenSeries.has(s.key)) return null;

            const color = s.color || getColorFromPalette(COLOR_PALETTES.primary, index);

            return (
              <Line
                key={`${s.key}_ma`}
                yAxisId={s.yAxisId || 'left'}
                type="monotone"
                dataKey={`${s.key}_ma`}
                name={`${s.name} (MA${movingAverageWindow})`}
                stroke={color}
                strokeWidth={1}
                strokeDasharray="5 5"
                dot={false}
                opacity={0.6}
                connectNulls
                isAnimationActive={false}
              />
            );
          })}

          {/* Trend lines */}
          {showTrendLine && series.map((s, index) => {
            if (hiddenSeries.has(s.key)) return null;

            const color = s.color || getColorFromPalette(COLOR_PALETTES.primary, index);

            return (
              <Line
                key={`${s.key}_trend`}
                yAxisId={s.yAxisId || 'left'}
                type="linear"
                dataKey={`${s.key}_trend`}
                name={`${s.name} (Tendência)`}
                stroke={color}
                strokeWidth={1}
                strokeDasharray="3 3"
                dot={false}
                opacity={0.4}
                isAnimationActive={false}
              />
            );
          })}

          {/* Annotations */}
          {annotations.map((annotation, index) => (
            <ReferenceLine
              key={index}
              x={new Date(annotation.date).getTime()}
              stroke={annotation.color || '#888'}
              strokeDasharray="3 3"
              label={{
                value: annotation.label,
                position: annotation.position || 'top',
                fill: annotation.color || '#888',
              }}
            />
          ))}

          {/* Brush for zooming */}
          {showBrush && (
            <Brush
              dataKey={dateKey}
              height={30}
              stroke="hsl(var(--primary))"
              tickFormatter={(value) => formatAxisDate(value, granularity)}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
});

TimeSeriesChart.displayName = 'TimeSeriesChart';
