/**
 * Goal Progress Bar Component
 *
 * Visual representation of progress towards a goal
 * with target line, current position, and trend indicator.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { IconTrendingUp, IconTrendingDown, IconFlag, IconAlertTriangle } from '@tabler/icons-react';
import { Progress } from '@/components/ui/progress';

export interface GoalProgressBarProps {
  title: string;
  current: number;
  target: number;
  unit?: string;
  format?: 'number' | 'currency' | 'percentage';
  historicalData?: Array<{ date: Date; value: number }>;
  deadline?: Date;
  status?: 'on-track' | 'at-risk' | 'off-track' | 'completed';
  className?: string;
}

export function GoalProgressBar({
  title,
  current,
  target,
  unit,
  format = 'number',
  historicalData = [],
  deadline,
  status,
  className
}: GoalProgressBarProps) {
  // Calculate progress percentage
  const progressPercentage = target > 0 ? Math.min(100, (current / target) * 100) : 0;

  // Calculate trend
  const trend = calculateTrend(historicalData);

  // Determine status if not provided
  const goalStatus = status || determineStatus(current, target, trend, deadline);

  // Calculate projected completion
  const projection = projectCompletion(historicalData, current, target, deadline);

  // Format values
  const formattedCurrent = formatValue(current, format, unit);
  const formattedTarget = formatValue(target, format, unit);

  // Status colors
  const statusConfig = {
    'on-track': {
      color: 'text-green-600',
      bgColor: 'bg-green-600',
      label: 'On Track',
      icon: IconTrendingUp
    },
    'at-risk': {
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-600',
      label: 'At Risk',
      icon: IconAlertTriangle
    },
    'off-track': {
      color: 'text-red-600',
      bgColor: 'bg-red-600',
      label: 'Off Track',
      icon: IconTrendingDown
    },
    'completed': {
      color: 'text-green-600',
      bgColor: 'bg-green-600',
      label: 'Completed',
      icon: IconFlag
    }
  };

  const config = statusConfig[goalStatus];
  const StatusIcon = config.icon;

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription className="mt-1">
              {formattedCurrent} of {formattedTarget}
            </CardDescription>
          </div>
          <div className={cn('flex items-center gap-1 text-sm font-semibold', config.color)}>
            <StatusIcon className="h-4 w-4" />
            <span>{config.label}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-semibold">{progressPercentage.toFixed(1)}%</span>
          </div>
          <div className="relative">
            <Progress
              value={progressPercentage}
              className="h-3"
              indicatorClassName={config.bgColor}
            />
            {/* Target marker (if progress exceeds 100%) */}
            {progressPercentage > 100 && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-gray-400"
                style={{ left: '100%' }}
              >
                <div className="absolute -top-1 -left-2 w-4 h-4 rotate-45 bg-gray-400"></div>
              </div>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-xs text-muted-foreground">Remaining</div>
            <div className="text-lg font-semibold">
              {formatValue(Math.max(0, target - current), format, unit)}
            </div>
          </div>
          {deadline && (
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-xs text-muted-foreground">Deadline</div>
              <div className="text-lg font-semibold">
                {deadline.toLocaleDateString()}
              </div>
              <div className="text-xs text-muted-foreground">
                ({getDaysUntil(deadline)} days)
              </div>
            </div>
          )}
        </div>

        {/* Trend Information */}
        {trend && (
          <div className="p-3 bg-muted rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Trend</div>
                <div className={cn('text-sm font-semibold', trend.direction === 'up' ? 'text-green-600' : trend.direction === 'down' ? 'text-red-600' : 'text-gray-600')}>
                  {trend.direction === 'up' && '↗ Increasing'}
                  {trend.direction === 'down' && '↘ Decreasing'}
                  {trend.direction === 'stable' && '→ Stable'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Rate</div>
                <div className="text-sm font-semibold">
                  {formatValue(trend.rate, format, unit)}/day
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Projection */}
        {projection && (
          <div className="p-3 border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950/20 rounded">
            <div className="text-xs text-muted-foreground mb-1">Projected Completion</div>
            <div className="text-sm font-semibold">
              {projection.date.toLocaleDateString()}
            </div>
            {deadline && (
              <div className="text-xs text-muted-foreground mt-1">
                {projection.onTime ? (
                  <span className="text-green-600">On track to meet deadline</span>
                ) : (
                  <span className="text-red-600">
                    {Math.abs(getDaysUntil(projection.date))} days after deadline
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper Functions

function formatValue(
  value: number,
  format: 'number' | 'currency' | 'percentage',
  unit?: string
): string {
  let formatted: string;

  switch (format) {
    case 'currency':
      formatted = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(value);
      break;
    case 'percentage':
      formatted = `${value.toFixed(2)}%`;
      break;
    case 'number':
    default:
      formatted = new Intl.NumberFormat('pt-BR').format(value);
      break;
  }

  return unit ? `${formatted} ${unit}` : formatted;
}

function calculateTrend(
  data: Array<{ date: Date; value: number }>
): { direction: 'up' | 'down' | 'stable'; rate: number } | null {
  if (data.length < 2) return null;

  // Sort by date
  const sorted = [...data].sort((a, b) => a.date.getTime() - b.date.getTime());

  // Calculate linear regression
  const n = sorted.length;
  const xValues = sorted.map((_, i) => i);
  const yValues = sorted.map(d => d.value);

  const xMean = xValues.reduce((a, b) => a + b, 0) / n;
  const yMean = yValues.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    numerator += (xValues[i] - xMean) * (yValues[i] - yMean);
    denominator += Math.pow(xValues[i] - xMean, 2);
  }

  const slope = denominator !== 0 ? numerator / denominator : 0;

  // Determine direction
  let direction: 'up' | 'down' | 'stable';
  if (Math.abs(slope) < 0.1) {
    direction = 'stable';
  } else if (slope > 0) {
    direction = 'up';
  } else {
    direction = 'down';
  }

  return { direction, rate: Math.abs(slope) };
}

function determineStatus(
  current: number,
  target: number,
  trend: ReturnType<typeof calculateTrend>,
  deadline?: Date
): 'on-track' | 'at-risk' | 'off-track' | 'completed' {
  const progressPercentage = (current / target) * 100;

  if (progressPercentage >= 100) {
    return 'completed';
  }

  if (!deadline || !trend) {
    // Simple threshold-based status
    if (progressPercentage >= 80) return 'on-track';
    if (progressPercentage >= 50) return 'at-risk';
    return 'off-track';
  }

  // Calculate required rate to meet deadline
  const daysUntil = getDaysUntil(deadline);
  const remaining = target - current;
  const requiredRate = daysUntil > 0 ? remaining / daysUntil : Infinity;

  if (trend.rate >= requiredRate * 0.9) {
    return 'on-track';
  } else if (trend.rate >= requiredRate * 0.6) {
    return 'at-risk';
  } else {
    return 'off-track';
  }
}

function projectCompletion(
  data: Array<{ date: Date; value: number }>,
  current: number,
  target: number,
  deadline?: Date
): { date: Date; onTime: boolean } | null {
  const trend = calculateTrend(data);
  if (!trend || trend.rate <= 0) return null;

  const remaining = target - current;
  const daysNeeded = Math.ceil(remaining / trend.rate);

  const projectedDate = new Date();
  projectedDate.setDate(projectedDate.getDate() + daysNeeded);

  const onTime = deadline ? projectedDate <= deadline : true;

  return { date: projectedDate, onTime };
}

function getDaysUntil(date: Date): number {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
