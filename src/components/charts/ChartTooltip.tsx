/**
 * Chart Tooltip
 *
 * Customizable tooltip component for charts.
 * Provides formatted data display on hover.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { TooltipConfig } from '@/lib/charts/chart-config';

export interface ChartTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: any;
  config?: TooltipConfig;
  className?: string;
}

export const ChartTooltip: React.FC<ChartTooltipProps> = ({
  active,
  payload,
  label,
  config = {},
  className,
}) => {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const { labelFormatter, valueFormatter, formatter } = config;

  // If custom formatter provided, use it
  if (formatter) {
    const customContent = formatter({ active, payload, label });
    if (typeof customContent === 'string') {
      return (
        <div
          className={cn(
            'rounded-lg border border-border bg-popover p-3 shadow-sm',
            className
          )}
          dangerouslySetInnerHTML={{ __html: customContent }}
        />
      );
    }
    return <>{customContent}</>;
  }

  // Default tooltip rendering
  const formattedLabel = labelFormatter ? labelFormatter(label) : label;

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-popover p-3 shadow-sm',
        className
      )}
    >
      {formattedLabel && (
        <p className="font-semibold text-sm text-foreground mb-2">
          {formattedLabel}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((entry, index) => {
          const value = entry.value;
          const name = entry.name || entry.dataKey;
          const color = entry.color || entry.fill || entry.stroke || '#3b82f6';

          const formattedValue = valueFormatter
            ? valueFormatter(value, name)
            : typeof value === 'number'
            ? value.toLocaleString()
            : value;

          return (
            <div key={`${name}-${index}`} className="flex items-center gap-2 text-xs">
              <span
                className="h-2 w-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-muted-foreground">{name}:</span>
              <span className="font-medium text-foreground ml-auto">
                {formattedValue}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

ChartTooltip.displayName = 'ChartTooltip';
