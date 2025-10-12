/**
 * Cohort Grid Component
 *
 * Visualizes cohort analysis with color-coded cells
 * showing retention or performance over time.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface CohortData {
  cohort: string;
  cohortDate: Date;
  periods: Array<{
    period: number;
    value: number;
    percentage?: number;
  }>;
}

export interface CohortGridProps {
  data: CohortData[];
  title?: string;
  description?: string;
  valueFormatter?: (value: number) => string;
  percentageMode?: boolean;
  colorScheme?: 'green' | 'blue' | 'purple';
  className?: string;
}

export function CohortGrid({
  data,
  title = 'Cohort Analysis',
  description,
  valueFormatter = (value) => value.toString(),
  percentageMode = true,
  colorScheme = 'green',
  className
}: CohortGridProps) {
  // Find maximum periods across all cohorts
  const maxPeriods = Math.max(...data.map(d => d.periods.length), 0);

  // Calculate statistics
  const avgRetention = calculateAverageRetention(data);
  const bestCohort = findBestCohort(data);
  const worstCohort = findWorstCohort(data);

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}

        {/* Summary Stats */}
        <div className="flex gap-6 mt-4 text-sm">
          <div>
            <span className="text-muted-foreground">Avg Retention: </span>
            <span className="font-semibold">{avgRetention.toFixed(1)}%</span>
          </div>
          {bestCohort && (
            <div>
              <span className="text-muted-foreground">Best Cohort: </span>
              <span className="font-semibold">{bestCohort.cohort}</span>
            </div>
          )}
          {worstCohort && (
            <div>
              <span className="text-muted-foreground">Worst Cohort: </span>
              <span className="font-semibold">{worstCohort.cohort}</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="p-2 text-left text-sm font-medium text-muted-foreground border-b">
                  Cohort
                </th>
                <th className="p-2 text-center text-sm font-medium text-muted-foreground border-b">
                  Size
                </th>
                {Array.from({ length: maxPeriods }).map((_, i) => (
                  <th
                    key={i}
                    className="p-2 text-center text-sm font-medium text-muted-foreground border-b"
                  >
                    Period {i}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={maxPeriods + 2} className="text-center text-muted-foreground py-8">
                    No cohort data available
                  </td>
                </tr>
              ) : (
                data.map((cohort, cohortIndex) => {
                  const initialSize = cohort.periods[0]?.value || 1;

                  return (
                    <tr key={cohortIndex}>
                      <td className="p-2 text-sm font-medium border-r">
                        {cohort.cohort}
                      </td>
                      <td className="p-2 text-center text-sm font-semibold border-r">
                        {initialSize}
                      </td>
                      {Array.from({ length: maxPeriods }).map((_, periodIndex) => {
                        const period = cohort.periods[periodIndex];

                        if (!period) {
                          return (
                            <td
                              key={periodIndex}
                              className="p-2 text-center text-sm bg-gray-100 border"
                            >
                              -
                            </td>
                          );
                        }

                        const percentage = percentageMode && period.percentage !== undefined
                          ? period.percentage
                          : (period.value / initialSize) * 100;

                        const color = getColorForPercentage(percentage, colorScheme);

                        return (
                          <td
                            key={periodIndex}
                            className={cn(
                              'p-2 text-center text-xs font-semibold border transition-all hover:scale-105',
                              color
                            )}
                            title={`Period ${periodIndex}: ${period.value} (${percentage.toFixed(1)}%)`}
                          >
                            <div>{percentageMode ? `${percentage.toFixed(1)}%` : period.value}</div>
                            {percentageMode && (
                              <div className="text-xs opacity-75">
                                ({period.value})
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Color Legend */}
        <div className="mt-4 flex items-center justify-center gap-4 text-xs">
          <span className="text-muted-foreground">Retention Rate:</span>
          <div className="flex items-center gap-2">
            <div className={cn('w-6 h-4 rounded', getColorForPercentage(90, colorScheme))}></div>
            <span>80%+</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn('w-6 h-4 rounded', getColorForPercentage(60, colorScheme))}></div>
            <span>60-80%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn('w-6 h-4 rounded', getColorForPercentage(40, colorScheme))}></div>
            <span>40-60%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn('w-6 h-4 rounded', getColorForPercentage(20, colorScheme))}></div>
            <span>20-40%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn('w-6 h-4 rounded', getColorForPercentage(5, colorScheme))}></div>
            <span>&lt;20%</span>
          </div>
        </div>

        {/* Insights */}
        <div className="mt-4 p-4 bg-muted rounded-lg space-y-2">
          <h4 className="font-semibold text-sm">Key Insights</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Average retention rate across all cohorts: {avgRetention.toFixed(1)}%</li>
            <li>• Total cohorts analyzed: {data.length}</li>
            {bestCohort && (
              <li>• Best performing cohort shows {calculateCohortRetention(bestCohort).toFixed(1)}% retention</li>
            )}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

// Helper Functions

function getColorForPercentage(percentage: number, colorScheme: 'green' | 'blue' | 'purple'): string {
  const colors = {
    green: {
      veryHigh: 'bg-green-600 text-white',
      high: 'bg-green-500 text-white',
      medium: 'bg-green-400 text-black',
      low: 'bg-green-300 text-black',
      veryLow: 'bg-green-200 text-black'
    },
    blue: {
      veryHigh: 'bg-blue-600 text-white',
      high: 'bg-blue-500 text-white',
      medium: 'bg-blue-400 text-black',
      low: 'bg-blue-300 text-black',
      veryLow: 'bg-blue-200 text-black'
    },
    purple: {
      veryHigh: 'bg-purple-600 text-white',
      high: 'bg-purple-500 text-white',
      medium: 'bg-purple-400 text-black',
      low: 'bg-purple-300 text-black',
      veryLow: 'bg-purple-200 text-black'
    }
  };

  const scheme = colors[colorScheme];

  if (percentage >= 80) return scheme.veryHigh;
  if (percentage >= 60) return scheme.high;
  if (percentage >= 40) return scheme.medium;
  if (percentage >= 20) return scheme.low;
  return scheme.veryLow;
}

function calculateAverageRetention(data: CohortData[]): number {
  if (data.length === 0) return 0;

  let totalRetention = 0;
  let count = 0;

  for (const cohort of data) {
    const retention = calculateCohortRetention(cohort);
    if (!isNaN(retention)) {
      totalRetention += retention;
      count++;
    }
  }

  return count > 0 ? totalRetention / count : 0;
}

function calculateCohortRetention(cohort: CohortData): number {
  if (cohort.periods.length < 2) return 100;

  const initial = cohort.periods[0]?.value || 1;
  const latest = cohort.periods[cohort.periods.length - 1]?.value || 0;

  return (latest / initial) * 100;
}

function findBestCohort(data: CohortData[]): CohortData | null {
  if (data.length === 0) return null;

  return data.reduce((best, current) => {
    const bestRetention = calculateCohortRetention(best);
    const currentRetention = calculateCohortRetention(current);
    return currentRetention > bestRetention ? current : best;
  });
}

function findWorstCohort(data: CohortData[]): CohortData | null {
  if (data.length === 0) return null;

  return data.reduce((worst, current) => {
    const worstRetention = calculateCohortRetention(worst);
    const currentRetention = calculateCohortRetention(current);
    return currentRetention < worstRetention ? current : worst;
  });
}
