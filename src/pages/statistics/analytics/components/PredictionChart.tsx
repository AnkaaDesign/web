/**
 * Prediction Chart Component
 *
 * Displays historical data alongside predicted values
 * with confidence intervals and trend lines.
 */

import React from 'react';
import {
  LineChart,
  Line,
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface PredictionChartProps {
  data: Array<{
    timestamp: Date;
    actual?: number;
    predicted?: number;
    lower?: number;
    upper?: number;
  }>;
  title?: string;
  description?: string;
  valueFormatter?: (value: number) => string;
  className?: string;
  showConfidenceIntervals?: boolean;
  showTrendLine?: boolean;
}

export function PredictionChart({
  data,
  title = 'Prediction Analysis',
  description,
  valueFormatter = (value) => value.toFixed(2),
  className,
  showConfidenceIntervals = true,
  showTrendLine = true
}: PredictionChartProps) {
  // Transform data for chart
  const chartData = data.map((item) => ({
    date: item.timestamp.toLocaleDateString(),
    timestamp: item.timestamp.getTime(),
    actual: item.actual,
    predicted: item.predicted,
    lower: item.lower,
    upper: item.upper
  }));

  // Split into historical and forecast
  const historicalData = chartData.filter(d => d.actual !== undefined);
  const forecastData = chartData.filter(d => d.predicted !== undefined && d.actual === undefined);

  // Combine for continuous line
  const combinedData = [...chartData];

  // Calculate statistics
  const stats = calculateStats(data);

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        <div className="flex gap-6 mt-2 text-sm">
          {stats.accuracy && (
            <div>
              <span className="text-muted-foreground">Accuracy: </span>
              <span className="font-semibold">{stats.accuracy}%</span>
            </div>
          )}
          {stats.trend && (
            <div>
              <span className="text-muted-foreground">Trend: </span>
              <span className={cn(
                'font-semibold',
                stats.trend === 'increasing' && 'text-green-600',
                stats.trend === 'decreasing' && 'text-red-600',
                stats.trend === 'stable' && 'text-gray-600'
              )}>
                {stats.trend}
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          {showConfidenceIntervals ? (
            <AreaChart data={combinedData}>
              <defs>
                <linearGradient id="confidenceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                className="text-xs"
                tick={{ fill: 'currentColor' }}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: 'currentColor' }}
                tickFormatter={valueFormatter}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '0.5rem'
                }}
                formatter={(value: any) => [valueFormatter(value), '']}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend />

              {/* Confidence Interval */}
              <Area
                type="monotone"
                dataKey="upper"
                stroke="none"
                fill="url(#confidenceGradient)"
                fillOpacity={1}
                name="Confidence Interval"
              />
              <Area
                type="monotone"
                dataKey="lower"
                stroke="none"
                fill="white"
                fillOpacity={1}
              />

              {/* Actual Data */}
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Actual"
                connectNulls={false}
              />

              {/* Predicted Data */}
              <Line
                type="monotone"
                dataKey="predicted"
                stroke="#3b82f6"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 3 }}
                name="Predicted"
                connectNulls={true}
              />
            </AreaChart>
          ) : (
            <LineChart data={combinedData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                className="text-xs"
                tick={{ fill: 'currentColor' }}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: 'currentColor' }}
                tickFormatter={valueFormatter}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '0.5rem'
                }}
                formatter={(value: any) => [valueFormatter(value), '']}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend />

              <Line
                type="monotone"
                dataKey="actual"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Actual"
                connectNulls={false}
              />

              <Line
                type="monotone"
                dataKey="predicted"
                stroke="#3b82f6"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 3 }}
                name="Predicted"
                connectNulls={true}
              />
            </LineChart>
          )}
        </ResponsiveContainer>

        {/* Legend for forecast period */}
        <div className="mt-4 flex items-center justify-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-green-600"></div>
            <span>Historical</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-blue-600 border-dashed border-t-2"></div>
            <span>Forecast</span>
          </div>
          {showConfidenceIntervals && (
            <div className="flex items-center gap-2">
              <div className="w-4 h-2 bg-blue-200 rounded"></div>
              <span>95% Confidence</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Helper function to calculate statistics
function calculateStats(
  data: Array<{
    timestamp: Date;
    actual?: number;
    predicted?: number;
  }>
): {
  accuracy?: number;
  trend?: 'increasing' | 'decreasing' | 'stable';
} {
  // Calculate accuracy where we have both actual and predicted
  const paired = data.filter(d => d.actual !== undefined && d.predicted !== undefined);

  let accuracy: number | undefined;
  if (paired.length > 0) {
    const errors = paired.map(d => {
      const actual = d.actual!;
      const predicted = d.predicted!;
      return Math.abs(actual - predicted) / (actual || 1);
    });
    const meanError = errors.reduce((a, b) => a + b, 0) / errors.length;
    accuracy = Math.max(0, (1 - meanError) * 100);
  }

  // Determine trend
  let trend: 'increasing' | 'decreasing' | 'stable' | undefined;
  const values = data
    .map(d => d.actual || d.predicted)
    .filter((v): v is number => v !== undefined);

  if (values.length >= 2) {
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const change = (secondAvg - firstAvg) / (firstAvg || 1);

    if (Math.abs(change) < 0.05) {
      trend = 'stable';
    } else if (change > 0) {
      trend = 'increasing';
    } else {
      trend = 'decreasing';
    }
  }

  return { accuracy, trend };
}
