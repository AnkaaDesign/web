/**
 * ChartHeader Component
 * Header component for charts with title, description, and actions
 */

import React from 'react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Info, Calendar } from 'lucide-react';

export interface TimeRange {
  label: string;
  value: string;
  days?: number;
}

export interface ChartHeaderProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  info?: string;
  children?: React.ReactNode;
  className?: string;

  // Time range selector
  timeRange?: string;
  timeRanges?: TimeRange[];
  onTimeRangeChange?: (value: string) => void;
  showTimeRange?: boolean;
}

export const ChartHeader = React.memo<ChartHeaderProps>(({
  title,
  description,
  icon,
  badge,
  info,
  children,
  className,
  timeRange,
  timeRanges = [
    { label: 'Últimos 7 dias', value: '7d', days: 7 },
    { label: 'Últimos 30 dias', value: '30d', days: 30 },
    { label: 'Últimos 90 dias', value: '90d', days: 90 },
    { label: 'Este ano', value: 'year' },
    { label: 'Todo período', value: 'all' },
  ],
  onTimeRangeChange,
  showTimeRange = false,
}) => {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {icon && (
          <div className="flex-shrink-0 mt-1 text-primary">
            {icon}
          </div>
        )}

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-semibold leading-tight text-foreground">
              {title}
            </h3>

            {badge && (
              <div className="flex-shrink-0">
                {badge}
              </div>
            )}

            {info && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 flex-shrink-0"
                    >
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <p className="text-sm">{info}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          {description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {showTimeRange && onTimeRangeChange && (
          <Select value={timeRange} onValueChange={onTimeRangeChange}>
            <SelectTrigger className="w-40">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              {timeRanges.map((range) => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {children}
      </div>
    </div>
  );
});

ChartHeader.displayName = 'ChartHeader';
