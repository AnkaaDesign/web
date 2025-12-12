/**
 * ChartLegend Component
 * Interactive legend component with show/hide functionality
 */

import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatNumber } from '../utils/chart-formatters';
import { Eye, EyeOff } from 'lucide-react';

export interface LegendItem {
  key: string;
  label: string;
  color: string;
  value?: number;
  percentage?: number;
  hidden?: boolean;
}

export interface ChartLegendProps {
  items: LegendItem[];
  onToggle?: (key: string, hidden: boolean) => void;
  position?: 'top' | 'bottom' | 'left' | 'right';
  orientation?: 'horizontal' | 'vertical';
  showValues?: boolean;
  showPercentage?: boolean;
  interactive?: boolean;
  className?: string;
  valueFormatter?: (value: number) => string;
}

export const ChartLegend = React.memo<ChartLegendProps>(({
  items,
  onToggle,
  position = 'bottom',
  orientation = 'horizontal',
  showValues = false,
  showPercentage = false,
  interactive = true,
  className,
  valueFormatter = formatNumber,
}) => {
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(
    new Set(items.filter(item => item.hidden).map(item => item.key))
  );

  const handleToggle = useCallback((key: string) => {
    if (!interactive) return;

    const newHiddenKeys = new Set(hiddenKeys);
    const isHidden = newHiddenKeys.has(key);

    if (isHidden) {
      newHiddenKeys.delete(key);
    } else {
      newHiddenKeys.add(key);
    }

    setHiddenKeys(newHiddenKeys);
    onToggle?.(key, !isHidden);
  }, [hiddenKeys, interactive, onToggle]);

  const isHorizontal = orientation === 'horizontal';

  return (
    <div
      className={cn(
        'flex gap-3',
        isHorizontal ? 'flex-row flex-wrap items-center' : 'flex-col',
        position === 'top' && 'mb-4',
        position === 'bottom' && 'mt-4',
        position === 'left' && 'mr-4',
        position === 'right' && 'ml-4',
        className
      )}
    >
      {items.map((item) => {
        const isHidden = hiddenKeys.has(item.key);

        return (
          <div
            key={item.key}
            className={cn(
              'flex items-center gap-2 transition-opacity',
              interactive && 'cursor-pointer hover:opacity-80',
              isHidden && 'opacity-40'
            )}
            onClick={() => handleToggle(item.key)}
          >
            {/* Color indicator */}
            <div
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />

            {/* Label */}
            <span className="text-sm text-foreground whitespace-nowrap">
              {item.label}
            </span>

            {/* Value */}
            {showValues && item.value !== undefined && (
              <span className="text-sm font-medium text-foreground">
                {valueFormatter(item.value)}
              </span>
            )}

            {/* Percentage */}
            {showPercentage && item.percentage !== undefined && (
              <Badge variant="secondary" className="text-xs">
                {item.percentage.toFixed(1)}%
              </Badge>
            )}

            {/* Hidden indicator */}
            {interactive && isHidden && (
              <EyeOff className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
        );
      })}
    </div>
  );
});

ChartLegend.displayName = 'ChartLegend';

/**
 * Simple legend (non-interactive)
 */
export interface SimpleLegendProps {
  items: Array<{
    label: string;
    color: string;
    value?: string | number;
  }>;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export const SimpleLegend = React.memo<SimpleLegendProps>(({
  items,
  orientation = 'horizontal',
  className,
}) => {
  const isHorizontal = orientation === 'horizontal';

  return (
    <div
      className={cn(
        'flex gap-4',
        isHorizontal ? 'flex-row flex-wrap' : 'flex-col',
        className
      )}
    >
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-sm flex-shrink-0"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-sm text-muted-foreground">
            {item.label}
          </span>
          {item.value !== undefined && (
            <span className="text-sm font-medium text-foreground">
              {item.value}
            </span>
          )}
        </div>
      ))}
    </div>
  );
});

SimpleLegend.displayName = 'SimpleLegend';
