/**
 * ChartTooltip Component
 * Rich tooltip content for charts with multi-series support
 */

import React from 'react';
import { cn } from '@/lib/utils';
import {
  formatCurrency,
  formatPercentage,
  formatNumber,
  formatDate,
} from '../utils/chart-formatters';

export type TooltipDataType = 'number' | 'currency' | 'percentage' | 'date' | 'duration' | 'custom';

export interface TooltipItem {
  name: string;
  value: number | string;
  color?: string;
  dataType?: TooltipDataType;
  formatter?: (value: any) => string;
}

export interface ChartTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  title?: string;
  className?: string;
  labelFormatter?: (label: any) => string;
  valueFormatter?: (value: any, name: string) => string;
  customContent?: (payload: any[], label: string) => React.ReactNode;
  showTotal?: boolean;
  totalLabel?: string;
}

export const ChartTooltip = React.memo<ChartTooltipProps>(({
  active,
  payload,
  label,
  title,
  className,
  labelFormatter,
  valueFormatter,
  customContent,
  showTotal = false,
  totalLabel = 'Total',
}) => {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  // Custom content override
  if (customContent) {
    return (
      <div className={cn('chart-tooltip', className)}>
        {customContent(payload, label ?? '')}
      </div>
    );
  }

  // Default formatter
  const defaultFormatter = (value: any, item: any) => {
    if (valueFormatter) {
      return valueFormatter(value, item.name);
    }

    const dataType = item.dataType || 'number';

    switch (dataType) {
      case 'currency':
        return formatCurrency(value);
      case 'percentage':
        return formatPercentage(value);
      case 'number':
        return formatNumber(value);
      case 'date':
        return formatDate(value);
      default:
        return String(value);
    }
  };

  // Format label
  const formattedLabel = labelFormatter
    ? labelFormatter(label)
    : label;

  // Calculate total if needed
  const total = showTotal
    ? payload.reduce((sum, item) => sum + (typeof item.value === 'number' ? item.value : 0), 0)
    : 0;

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-background/95 backdrop-blur-sm shadow-sm p-3 min-w-[200px]',
        className
      )}
    >
      {/* Title */}
      {title && (
        <div className="font-medium text-foreground mb-2 pb-2 border-b border-border">
          {title}
        </div>
      )}

      {/* Label */}
      {formattedLabel && (
        <div className="text-sm font-medium text-foreground mb-2">
          {formattedLabel}
        </div>
      )}

      {/* Items */}
      <div className="space-y-1.5">
        {payload.map((item, index) => {
          const color = item.color || item.fill || item.stroke || '#888';
          const name = item.name || item.dataKey;
          const value = item.value;

          return (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-sm text-muted-foreground truncate">
                  {name}
                </span>
              </div>
              <span className="text-sm font-medium text-foreground whitespace-nowrap">
                {defaultFormatter(value, item)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Total */}
      {showTotal && payload.length > 1 && (
        <div className="mt-2 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              {totalLabel}
            </span>
            <span className="text-sm font-bold text-foreground">
              {defaultFormatter(total, { dataType: payload[0]?.dataType })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
});

ChartTooltip.displayName = 'ChartTooltip';

/**
 * Simple Tooltip (for basic use cases)
 */
export interface SimpleTooltipProps {
  label: string;
  value: number | string;
  color?: string;
  formatter?: (value: any) => string;
  className?: string;
}

export const SimpleTooltip = React.memo<SimpleTooltipProps>(({
  label,
  value,
  color = '#888',
  formatter = (v) => String(v),
  className,
}) => {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-background/95 backdrop-blur-sm shadow-sm p-2',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-2 h-2 rounded-sm"
          style={{ backgroundColor: color }}
        />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="mt-1 text-sm font-medium text-foreground">
        {formatter(value)}
      </div>
    </div>
  );
});

SimpleTooltip.displayName = 'SimpleTooltip';

/**
 * Custom Tooltip Content Builder
 */
export const createCustomTooltip = (
  renderContent: (payload: any[], label: string) => React.ReactNode
) => {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) {
      return null;
    }

    return (
      <div className="rounded-lg border border-border bg-background/95 backdrop-blur-sm shadow-sm p-3">
        {renderContent(payload, label)}
      </div>
    );
  };

  return CustomTooltip;
};
