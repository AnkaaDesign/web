/**
 * Chart Legend
 *
 * Customizable legend component for charts with interactive show/hide functionality.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { LegendConfig, SeriesConfig } from '@/lib/charts/chart-config';

export interface ChartLegendProps {
  series: SeriesConfig[];
  config?: LegendConfig;
  hiddenSeries?: Set<string>;
  onToggleSeries?: (seriesName: string) => void;
  className?: string;
}

export const ChartLegend: React.FC<ChartLegendProps> = ({
  series,
  config = {},
  hiddenSeries = new Set(),
  onToggleSeries,
  className,
}) => {
  const {
    show = true,
    position = 'bottom',
    align = 'center',
    layout = 'horizontal',
    interactive = true,
  } = config;

  if (!show || series.length === 0) {
    return null;
  }

  const handleClick = (seriesName: string) => {
    if (interactive && onToggleSeries) {
      onToggleSeries(seriesName);
    }
  };

  const positionClasses = {
    top: 'mb-4',
    bottom: 'mt-4',
    left: 'mr-4',
    right: 'ml-4',
  };

  const alignClasses = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
  };

  const layoutClasses = {
    horizontal: 'flex-row flex-wrap',
    vertical: 'flex-col',
  };

  return (
    <div
      className={cn(
        'flex gap-4',
        positionClasses[position],
        alignClasses[align],
        layoutClasses[layout],
        className
      )}
    >
      {series.map((s) => {
        const isHidden = hiddenSeries.has(s.name);
        const displayName = config.formatter ? config.formatter(s.name) : s.name;

        return (
          <button
            key={s.name}
            onClick={() => handleClick(s.name)}
            disabled={!interactive}
            className={cn(
              'flex items-center gap-2 text-sm transition-all',
              interactive && 'cursor-pointer hover:opacity-70',
              !interactive && 'cursor-default',
              isHidden && 'opacity-40'
            )}
            title={interactive ? 'Click to toggle series' : undefined}
          >
            <span
              className={cn(
                'h-3 w-3 rounded-sm transition-all',
                isHidden && 'opacity-30'
              )}
              style={{ backgroundColor: s.color || '#3b82f6' }}
            />
            <span
              className={cn(
                'font-medium transition-all',
                isHidden && 'line-through'
              )}
            >
              {displayName}
            </span>
          </button>
        );
      })}
    </div>
  );
};

ChartLegend.displayName = 'ChartLegend';
