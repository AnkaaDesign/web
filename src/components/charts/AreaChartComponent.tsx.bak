/**
 * AreaChartComponent
 * Area chart with support for:
 * - Stacked area
 * - Percentage area
 * - Stream graph
 * - Gradient fills
 * - Comparison mode
 */

import React, { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChartWrapper, ExportData } from './base/ChartWrapper';
import { ChartTooltip } from './base/ChartTooltip';
import { COLOR_PALETTES, getColorFromPalette, withOpacity } from './utils/chart-colors';
import { formatAxisDate, createFormatter } from './utils/chart-formatters';

export interface AreaChartDataPoint {
  date?: Date | string;
  name?: string;
  [key: string]: any;
}

export interface AreaSeriesConfig {
  key: string;
  name: string;
  color?: string;
  stackId?: string;
  hide?: boolean;
}

export interface AreaChartComponentProps {
  data: AreaChartDataPoint[];
  series: AreaSeriesConfig[];
  className?: string;

  // Header props
  title?: string;
  description?: string;
  icon?: React.ReactNode;

  // Chart configuration
  height?: number;
  layout?: 'default' | 'stacked' | 'percentage' | 'stream';
  showGrid?: boolean;
  showLegend?: boolean;
  curved?: boolean;
  fillOpacity?: number;
  useGradient?: boolean;

  // Axis configuration
  xAxisKey?: string;
  xAxisType?: 'category' | 'date';
  yAxisType?: 'number' | 'currency' | 'percentage';
  dateGranularity?: 'day' | 'week' | 'month' | 'year';

  // Callbacks
  onRefresh?: () => void;
  onAreaClick?: (data: AreaChartDataPoint) => void;

  // State
  isLoading?: boolean;
  error?: Error | string | null;
}

export const AreaChartComponent = React.memo<AreaChartComponentProps>(({
  data,
  series,
  className,
  title = 'Gráfico de Área',
  description,
  icon,
  height = 400,
  layout = 'default',
  showGrid = true,
  showLegend = true,
  curved = true,
  fillOpacity = 0.6,
  useGradient = true,
  xAxisKey = 'date',
  xAxisType = 'date',
  yAxisType = 'number',
  dateGranularity = 'day',
  onRefresh,
  onAreaClick,
  isLoading,
  error,
}) => {
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

  // Process data for percentage layout
  const processedData = useMemo(() => {
    if (layout !== 'percentage') return data;

    return data.map(item => {
      const total = series.reduce((sum, s) => sum + (item[s.key] || 0), 0);
      const processed: any = { [xAxisKey]: item[xAxisKey] };

      series.forEach(s => {
        processed[s.key] = total > 0 ? (item[s.key] / total) * 100 : 0;
      });

      return processed;
    });
  }, [data, layout, series, xAxisKey]);

  // Prepare export data
  const exportData: ExportData = useMemo(() => {
    const headers = [xAxisKey, ...series.map(s => s.name)];
    const rows = data.map(item => [
      xAxisType === 'date' ? new Date(item[xAxisKey]).toLocaleDateString('pt-BR') : item[xAxisKey],
      ...series.map(s => item[s.key] || 0),
    ]);

    return { headers, rows };
  }, [data, series, xAxisKey, xAxisType]);

  // Value formatter
  const yAxisFormatter = createFormatter(
    layout === 'percentage' ? 'percentage' : yAxisType
  );

  // X-axis formatter
  const xAxisFormatter = useMemo(() => {
    if (xAxisType === 'date') {
      return (value: any) => formatAxisDate(value, dateGranularity);
    }
    return undefined;
  }, [xAxisType, dateGranularity]);

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

  // Determine stack ID
  const getStackId = (seriesConfig: AreaSeriesConfig): string | undefined => {
    if (layout === 'default') return undefined;
    return seriesConfig.stackId || 'stack1';
  };

  // Determine offset type for stream graph
  const offsetType = layout === 'stream' ? 'wiggle' : layout === 'percentage' ? 'expand' : undefined;

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
      emptyMessage="Nenhum dado disponível"
      onRefresh={onRefresh}
      exportData={exportData}
      exportFilename={`area-chart-${Date.now()}`}
      showRefresh={!!onRefresh}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={processedData}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          onClick={(e) => {
            if (e?.activePayload?.[0]?.payload && onAreaClick) {
              onAreaClick(e.activePayload[0].payload);
            }
          }}
        >
          <defs>
            {useGradient && series.map((s, index) => {
              const color = s.color || getColorFromPalette(COLOR_PALETTES.primary, index);
              return (
                <linearGradient
                  key={`gradient-${s.key}`}
                  id={`gradient-${s.key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor={color} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.1} />
                </linearGradient>
              );
            })}
          </defs>

          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              opacity={0.5}
            />
          )}

          <XAxis
            dataKey={xAxisKey}
            tickFormatter={xAxisFormatter}
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
          />

          <YAxis
            tickFormatter={yAxisFormatter}
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
          />

          <Tooltip
            content={(props) => <ChartTooltip {...props} />}
          />

          {showLegend && (
            <Legend
              onClick={(e) => handleLegendClick(e.dataKey)}
              wrapperStyle={{ cursor: 'pointer' }}
            />
          )}

          {series.map((s, index) => {
            if (hiddenSeries.has(s.key)) return null;

            const color = s.color || getColorFromPalette(COLOR_PALETTES.primary, index);
            const fill = useGradient ? `url(#gradient-${s.key})` : withOpacity(color, fillOpacity);

            return (
              <Area
                key={s.key}
                type={curved ? 'monotone' : 'linear'}
                dataKey={s.key}
                name={s.name}
                stroke={color}
                strokeWidth={2}
                fill={fill}
                fillOpacity={useGradient ? 1 : fillOpacity}
                stackId={getStackId(s)}
                isAnimationActive={true}
                activeDot={{ r: 5 }}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
});

AreaChartComponent.displayName = 'AreaChartComponent';
