/**
 * PieChartComponent
 * Versatile pie/donut chart with support for:
 * - Standard pie and donut modes
 * - Semi-circle gauge mode
 * - Percentage labels
 * - Interactive segments
 * - Legend with values
 * - Drill-down capability
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  Label,
  Sector,
} from 'recharts';
import { ChartWrapper, ExportData } from './base/ChartWrapper';
import { ChartLegend, LegendItem } from './base/ChartLegend';
import { COLOR_PALETTES, getColorFromPalette } from './utils/chart-colors';
import { formatNumber, formatPercentage } from './utils/chart-formatters';
import { convertToPercentage } from './utils/chart-data-helpers';

export interface PieChartDataPoint {
  name: string;
  value: number;
  color?: string;
  [key: string]: any;
}

export interface PieChartComponentProps {
  data: PieChartDataPoint[];
  className?: string;

  // Header props
  title?: string;
  description?: string;
  icon?: React.ReactNode;

  // Chart configuration
  height?: number;
  variant?: 'pie' | 'donut' | 'semi-circle';
  showLabels?: boolean;
  showPercentages?: boolean;
  showLegend?: boolean;
  showValues?: boolean;
  interactive?: boolean;

  // Donut configuration
  innerRadius?: number;
  outerRadius?: number;

  // Semi-circle configuration
  startAngle?: number;
  endAngle?: number;

  // Value configuration
  valueKey?: string;
  nameKey?: string;
  valueType?: 'number' | 'currency' | 'percentage';

  // Colors
  colors?: string[];

  // Center label (for donut)
  centerLabel?: string;
  centerValue?: string | number;

  // Callbacks
  onRefresh?: () => void;
  onSegmentClick?: (data: PieChartDataPoint) => void;

  // State
  isLoading?: boolean;
  error?: Error | string | null;
}

// Active shape for interactive pie
const renderActiveShape = (props: any) => {
  const {
    cx,
    cy,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    fill,
    payload,
    percent,
    value,
  } = props;

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={outerRadius + 8}
        outerRadius={outerRadius + 10}
        fill={fill}
        opacity={0.8}
      />
    </g>
  );
};

export const PieChartComponent = React.memo<PieChartComponentProps>(({
  data,
  className,
  title = 'Gráfico de Pizza',
  description,
  icon,
  height = 400,
  variant = 'pie',
  showLabels = true,
  showPercentages = true,
  showLegend = true,
  showValues = false,
  interactive = true,
  innerRadius = 0,
  outerRadius = 80,
  startAngle = 0,
  endAngle = 360,
  valueKey = 'value',
  nameKey = 'name',
  valueType = 'number',
  colors,
  centerLabel,
  centerValue,
  onRefresh,
  onSegmentClick,
  isLoading,
  error,
}) => {
  const [activeIndex, setActiveIndex] = useState<number | undefined>();
  const [hiddenItems, setHiddenItems] = useState<Set<string>>(new Set());

  // Filter hidden items
  const visibleData = useMemo(() => {
    return data.filter(item => !hiddenItems.has(item[nameKey]));
  }, [data, hiddenItems, nameKey]);

  // Add percentage to data
  const dataWithPercentage = useMemo(() => {
    return convertToPercentage(visibleData as any[], valueKey);
  }, [visibleData, valueKey]);

  // Calculate chart radii based on variant
  const chartInnerRadius = useMemo(() => {
    if (variant === 'donut') return innerRadius || 60;
    if (variant === 'semi-circle') return innerRadius || 70;
    return 0;
  }, [variant, innerRadius]);

  const chartOuterRadius = useMemo(() => {
    return outerRadius;
  }, [outerRadius]);

  // Calculate angles for semi-circle
  const chartAngles = useMemo(() => {
    if (variant === 'semi-circle') {
      return { startAngle: 180, endAngle: 0 };
    }
    return { startAngle, endAngle };
  }, [variant, startAngle, endAngle]);

  // Prepare export data
  const exportData: ExportData = useMemo(() => {
    const headers = ['Categoria', 'Valor', 'Percentual'];
    const rows = dataWithPercentage.map(item => [
      item[nameKey],
      item[valueKey],
      `${item.percentage.toFixed(1)}%`,
    ]);

    return { headers, rows };
  }, [dataWithPercentage, nameKey, valueKey]);

  // Format value based on type
  const formatValue = useCallback((value: number) => {
    switch (valueType) {
      case 'currency':
        return formatNumber(value, { minimumFractionDigits: 2 });
      case 'percentage':
        return formatPercentage(value);
      default:
        return formatNumber(value);
    }
  }, [valueType]);

  // Get colors
  const chartColors = useMemo(() => {
    return colors || COLOR_PALETTES.category;
  }, [colors]);

  // Check if empty
  const isEmpty = !visibleData || visibleData.length === 0;

  // Handle legend toggle
  const handleLegendToggle = useCallback((key: string, hidden: boolean) => {
    setHiddenItems(prev => {
      const next = new Set(prev);
      if (hidden) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }, []);

  // Legend items
  const legendItems: LegendItem[] = useMemo(() => {
    return dataWithPercentage.map((item, index) => ({
      key: item[nameKey],
      label: item[nameKey],
      color: item.color || getColorFromPalette(chartColors, index),
      value: showValues ? item[valueKey] : undefined,
      percentage: showPercentages ? item.percentage : undefined,
      hidden: hiddenItems.has(item[nameKey]),
    }));
  }, [dataWithPercentage, nameKey, valueKey, chartColors, showValues, showPercentages, hiddenItems]);

  // Custom label
  const renderLabel = (entry: any) => {
    if (!showLabels) return null;

    const percent = entry.percentage || 0;

    if (showPercentages) {
      return `${percent.toFixed(1)}%`;
    }

    return entry[nameKey];
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
      emptyMessage="Nenhum dado disponível"
      onRefresh={onRefresh}
      exportData={exportData}
      exportFilename={`pie-chart-${Date.now()}`}
      showRefresh={!!onRefresh}
    >
      <div className="flex flex-col items-center gap-4 w-full h-full">
        <ResponsiveContainer width="100%" height={showLegend ? '70%' : '100%'}>
          <PieChart>
            <Pie
              data={dataWithPercentage}
              cx="50%"
              cy={variant === 'semi-circle' ? '80%' : '50%'}
              labelLine={showLabels && !showPercentages}
              label={showLabels ? renderLabel : false}
              outerRadius={chartOuterRadius}
              innerRadius={chartInnerRadius}
              fill="#8884d8"
              dataKey={valueKey}
              nameKey={nameKey}
              startAngle={chartAngles.startAngle}
              endAngle={chartAngles.endAngle}
              activeIndex={interactive ? activeIndex : undefined}
              activeShape={interactive ? renderActiveShape : undefined}
              onMouseEnter={(_, index) => {
                if (interactive) setActiveIndex(index);
              }}
              onMouseLeave={() => {
                if (interactive) setActiveIndex(undefined);
              }}
              onClick={(entry) => {
                if (onSegmentClick) onSegmentClick(entry);
              }}
              isAnimationActive={true}
            >
              {dataWithPercentage.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color || getColorFromPalette(chartColors, index)}
                  style={{ cursor: onSegmentClick ? 'pointer' : 'default' }}
                />
              ))}

              {/* Center label for donut */}
              {variant === 'donut' && centerLabel && (
                <Label
                  value={centerLabel}
                  position="center"
                  style={{
                    fontSize: '14px',
                    fontWeight: 'bold',
                    fill: 'hsl(var(--foreground))',
                  }}
                />
              )}

              {variant === 'donut' && centerValue && (
                <Label
                  value={centerValue}
                  position="centerBottom"
                  style={{
                    fontSize: '20px',
                    fontWeight: 'bold',
                    fill: 'hsl(var(--foreground))',
                  }}
                />
              )}
            </Pie>

            <Tooltip
              formatter={(value: any) => formatValue(value)}
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {showLegend && (
          <div className="w-full px-4">
            <ChartLegend
              items={legendItems}
              onToggle={handleLegendToggle}
              showValues={showValues}
              showPercentage={showPercentages}
              valueFormatter={formatValue}
              interactive={interactive}
              orientation="horizontal"
              position="bottom"
            />
          </div>
        )}
      </div>
    </ChartWrapper>
  );
});

PieChartComponent.displayName = 'PieChartComponent';
