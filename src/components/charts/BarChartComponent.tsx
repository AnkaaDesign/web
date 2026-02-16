/**
 * BarChartComponent
 * Versatile bar chart with support for:
 * - Vertical/horizontal orientation
 * - Stacked vs grouped
 * - Multiple datasets
 * - Value labels
 * - Comparison bars
 * - Target lines
 * - Drill-down capability
 */

import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  LabelList,
  ReferenceLine,
} from 'recharts';
import { ChartWrapper } from './base/ChartWrapper';
import type { ExportData } from './base/ChartWrapper';
import { ChartTooltip } from './base/ChartTooltip';
import { COLOR_PALETTES, getColorFromPalette } from './utils/chart-colors';
import { createFormatter } from './utils/chart-formatters';

export interface BarChartDataPoint {
  name: string;
  [key: string]: any;
}

export interface BarSeriesConfig {
  key: string;
  name: string;
  color?: string;
  stackId?: string;
  hide?: boolean;
}

export interface BarChartComponentProps {
  data: BarChartDataPoint[];
  series: BarSeriesConfig[];
  className?: string;

  // Header props
  title?: string;
  description?: string;
  icon?: React.ReactNode;

  // Chart configuration
  height?: number;
  orientation?: 'vertical' | 'horizontal';
  layout?: 'grouped' | 'stacked' | 'stacked-percentage';
  showGrid?: boolean;
  showLegend?: boolean;
  showValueLabels?: boolean;
  barSize?: number;
  barGap?: number;
  barCategoryGap?: number;

  // Axis configuration
  categoryKey?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  valueType?: 'number' | 'currency' | 'percentage';

  // Target line
  targetValue?: number;
  targetLabel?: string;

  // Color customization
  colorByValue?: boolean;
  colorThresholds?: Array<{ min: number; max: number; color: string }>;

  // Callbacks
  onRefresh?: () => void;
  onBarClick?: (data: BarChartDataPoint) => void;

  // State
  isLoading?: boolean;
  error?: Error | string | null;
}

export const BarChartComponent = React.memo<BarChartComponentProps>(({
  data,
  series,
  className,
  title = 'Gráfico de Barras',
  description,
  icon,
  height = 400,
  orientation = 'vertical',
  layout = 'grouped',
  showGrid = true,
  showLegend = true,
  showValueLabels = false,
  barSize,
  barGap = 4,
  barCategoryGap = '20%',
  categoryKey = 'name',
  xAxisLabel,
  yAxisLabel,
  valueType = 'number',
  targetValue,
  targetLabel = 'Meta',
  colorByValue = false,
  colorThresholds,
  onRefresh,
  onBarClick,
  isLoading,
  error,
}) => {
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

  // Calculate percentage for stacked percentage mode
  const processedData = useMemo(() => {
    if (layout !== 'stacked-percentage') return data;

    return data.map(item => {
      const total = series.reduce((sum, s) => sum + (item[s.key] || 0), 0);
      const processed: any = { [categoryKey]: item[categoryKey] };

      series.forEach(s => {
        processed[s.key] = total > 0 ? (item[s.key] / total) * 100 : 0;
      });

      return processed;
    });
  }, [data, layout, series, categoryKey]);

  // Prepare export data
  const exportData: ExportData = useMemo(() => {
    const headers = [categoryKey, ...series.map(s => s.name)];
    const rows = data.map(item => [
      item[categoryKey],
      ...series.map(s => item[s.key] || 0),
    ]);

    return { headers, rows };
  }, [data, series, categoryKey]);

  // Value formatter
  const valueFormatter = createFormatter(
    layout === 'stacked-percentage' ? 'percentage' : valueType
  );

  // Check if empty
  const isEmpty = !data || data.length === 0;

  // Get color for value
  const getBarColor = (value: number, defaultColor: string): string => {
    if (!colorByValue || !colorThresholds) return defaultColor;

    const threshold = colorThresholds.find(
      t => value >= t.min && value <= t.max
    );

    return threshold?.color || defaultColor;
  };

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
  const getStackId = (seriesConfig: BarSeriesConfig): string | undefined => {
    if (layout === 'grouped') return undefined;
    return seriesConfig.stackId || 'stack1';
  };

  const isHorizontal = orientation === 'horizontal';

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
      exportFilename={`bar-chart-${Date.now()}`}
      showRefresh={!!onRefresh}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={processedData}
          layout={isHorizontal ? 'horizontal' : 'vertical'}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          barGap={barGap}
          barCategoryGap={barCategoryGap}
          onClick={(e) => {
            if ((e as any)?.activePayload?.[0]?.payload && onBarClick) {
              onBarClick((e as any).activePayload[0].payload);
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

          {isHorizontal ? (
            <>
              <XAxis
                type="number"
                tickFormatter={valueFormatter}
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                label={xAxisLabel ? {
                  value: xAxisLabel,
                  position: 'insideBottom',
                  offset: -5
                } : undefined}
              />
              <YAxis
                type="category"
                dataKey={categoryKey}
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                width={100}
                label={yAxisLabel ? {
                  value: yAxisLabel,
                  angle: -90,
                  position: 'insideLeft'
                } : undefined}
              />
            </>
          ) : (
            <>
              <XAxis
                type="category"
                dataKey={categoryKey}
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                label={xAxisLabel ? {
                  value: xAxisLabel,
                  position: 'insideBottom',
                  offset: -5
                } : undefined}
              />
              <YAxis
                type="number"
                tickFormatter={valueFormatter}
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                label={yAxisLabel ? {
                  value: yAxisLabel,
                  angle: -90,
                  position: 'insideLeft'
                } : undefined}
              />
            </>
          )}

          <Tooltip
            content={<ChartTooltip />}
            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
          />

          {showLegend && (
            <Legend
              onClick={(e) => handleLegendClick(String(e.dataKey ?? ''))}
              wrapperStyle={{ cursor: 'pointer' }}
            />
          )}

          {/* Target line */}
          {targetValue !== undefined && (
            <ReferenceLine
              y={isHorizontal ? undefined : targetValue}
              x={isHorizontal ? targetValue : undefined}
              stroke="#f59e0b"
              strokeDasharray="5 5"
              label={{
                value: targetLabel,
                position: 'top',
                fill: '#f59e0b',
              }}
            />
          )}

          {/* Bars */}
          {series.map((s, index) => {
            if (hiddenSeries.has(s.key)) return null;

            const color = s.color || getColorFromPalette(COLOR_PALETTES.primary, index);

            return (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.name}
                fill={color}
                stackId={getStackId(s)}
                maxBarSize={barSize || 50}
                radius={layout === 'stacked' ? undefined : [4, 4, 0, 0]}
                isAnimationActive={true}
              >
                {colorByValue && (
                  processedData.map((entry, idx) => (
                    <Cell
                      key={`cell-${idx}`}
                      fill={getBarColor(entry[s.key], color)}
                    />
                  ))
                )}

                {showValueLabels && (
                  <LabelList
                    dataKey={s.key}
                    position={isHorizontal ? 'right' : 'top'}
                    formatter={valueFormatter}
                    fontSize={11}
                    fill="hsl(var(--muted-foreground))"
                  />
                )}
              </Bar>
            );
          })}
        </BarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
});

BarChartComponent.displayName = 'BarChartComponent';
