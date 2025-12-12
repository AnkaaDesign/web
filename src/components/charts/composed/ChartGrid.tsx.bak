/**
 * ChartGrid Component
 * Responsive grid layout for dashboard charts
 */

import React from 'react';
import { cn } from '@/lib/utils';

export interface ChartGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
  equalHeight?: boolean;
}

export const ChartGrid = React.memo<ChartGridProps>(({
  children,
  columns = 2,
  gap = 'md',
  className,
  equalHeight = false,
}) => {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 lg:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4',
  };

  const gapSize = {
    sm: 'gap-4',
    md: 'gap-6',
    lg: 'gap-8',
  };

  return (
    <div
      className={cn(
        'grid',
        gridCols[columns],
        gapSize[gap],
        equalHeight && 'auto-rows-fr',
        className
      )}
    >
      {children}
    </div>
  );
});

ChartGrid.displayName = 'ChartGrid';

/**
 * Responsive chart container
 */
export interface ResponsiveChartContainerProps {
  children: React.ReactNode;
  className?: string;
  minHeight?: number;
  aspectRatio?: number;
}

export const ResponsiveChartContainer = React.memo<ResponsiveChartContainerProps>(({
  children,
  className,
  minHeight = 300,
  aspectRatio,
}) => {
  return (
    <div
      className={cn('w-full', className)}
      style={{
        minHeight,
        aspectRatio: aspectRatio ? `${aspectRatio}` : undefined,
      }}
    >
      {children}
    </div>
  );
});

ResponsiveChartContainer.displayName = 'ResponsiveChartContainer';
