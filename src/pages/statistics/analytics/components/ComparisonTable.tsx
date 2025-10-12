/**
 * Comparison Table Component
 *
 * Side-by-side comparison table with difference highlighting
 * and percentage changes.
 */

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { IconTrendingUp, IconTrendingDown, IconMinus } from '@tabler/icons-react';

export interface ComparisonRow {
  metric: string;
  current: number;
  previous: number;
  unit?: string;
  format?: 'number' | 'currency' | 'percentage';
  higherIsBetter?: boolean;
}

export interface ComparisonTableProps {
  data: ComparisonRow[];
  title?: string;
  description?: string;
  currentLabel?: string;
  previousLabel?: string;
  showPercentage?: boolean;
  showDifference?: boolean;
  className?: string;
}

export function ComparisonTable({
  data,
  title = 'Comparison Analysis',
  description,
  currentLabel = 'Current',
  previousLabel = 'Previous',
  showPercentage = true,
  showDifference = true,
  className
}: ComparisonTableProps) {
  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Metric</TableHead>
                <TableHead className="text-right">{previousLabel}</TableHead>
                <TableHead className="text-right">{currentLabel}</TableHead>
                {showDifference && <TableHead className="text-right">Difference</TableHead>}
                {showPercentage && <TableHead className="text-right">Change %</TableHead>}
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={showDifference && showPercentage ? 6 : showDifference || showPercentage ? 5 : 4} className="text-center text-muted-foreground py-8">
                    No data available
                  </TableCell>
                </TableRow>
              ) : (
                data.map((row, index) => {
                  const diff = row.current - row.previous;
                  const percentChange = row.previous !== 0
                    ? (diff / row.previous) * 100
                    : 0;

                  const isPositive = diff > 0;
                  const isNegative = diff < 0;
                  const isNeutral = Math.abs(percentChange) < 0.1;

                  // Determine if change is good or bad
                  const isGoodChange = row.higherIsBetter !== false
                    ? isPositive
                    : isNegative;

                  const changeColor = isNeutral
                    ? 'text-muted-foreground'
                    : isGoodChange
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400';

                  return (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{row.metric}</TableCell>
                      <TableCell className="text-right">
                        {formatValue(row.previous, row.format, row.unit)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatValue(row.current, row.format, row.unit)}
                      </TableCell>
                      {showDifference && (
                        <TableCell className={cn('text-right font-medium', changeColor)}>
                          {isPositive && '+'}
                          {formatValue(diff, row.format, row.unit)}
                        </TableCell>
                      )}
                      {showPercentage && (
                        <TableCell className={cn('text-right font-medium', changeColor)}>
                          {isPositive && '+'}
                          {percentChange.toFixed(1)}%
                        </TableCell>
                      )}
                      <TableCell>
                        {!isNeutral && (
                          <div className={changeColor}>
                            {isPositive ? (
                              <IconTrendingUp className="h-4 w-4" />
                            ) : (
                              <IconTrendingDown className="h-4 w-4" />
                            )}
                          </div>
                        )}
                        {isNeutral && (
                          <IconMinus className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Summary Statistics */}
        {data.length > 0 && (
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Improved</div>
                <div className="text-lg font-semibold text-green-600">
                  {data.filter(row => {
                    const diff = row.current - row.previous;
                    const isImproved = row.higherIsBetter !== false ? diff > 0 : diff < 0;
                    return isImproved;
                  }).length}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Declined</div>
                <div className="text-lg font-semibold text-red-600">
                  {data.filter(row => {
                    const diff = row.current - row.previous;
                    const isDeclined = row.higherIsBetter !== false ? diff < 0 : diff > 0;
                    return isDeclined;
                  }).length}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Unchanged</div>
                <div className="text-lg font-semibold text-gray-600">
                  {data.filter(row => {
                    const diff = row.current - row.previous;
                    const percentChange = row.previous !== 0 ? Math.abs(diff / row.previous) * 100 : 0;
                    return percentChange < 0.1;
                  }).length}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper function to format values
function formatValue(
  value: number,
  format: 'number' | 'currency' | 'percentage' = 'number',
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
