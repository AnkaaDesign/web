/**
 * Correlation Matrix Component
 *
 * Displays a heatmap showing correlations between variables
 * with interactive cells for drill-down to scatter plots.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export interface CorrelationMatrixProps {
  data: Record<string, Record<string, number>>;
  variables: string[];
  title?: string;
  description?: string;
  onCellClick?: (var1: string, var2: string) => void;
  rawData?: Record<string, number[]>; // For scatter plots
  className?: string;
}

export function CorrelationMatrix({
  data,
  variables,
  title = 'Correlation Matrix',
  description,
  onCellClick,
  rawData,
  className
}: CorrelationMatrixProps) {
  const [selectedCell, setSelectedCell] = useState<{ var1: string; var2: string } | null>(null);

  const handleCellClick = (var1: string, var2: string) => {
    if (var1 !== var2) {
      setSelectedCell({ var1, var2 });
      onCellClick?.(var1, var2);
    }
  };

  const getCorrelationColor = (value: number): string => {
    if (value >= 0.7) return 'bg-green-600 text-white';
    if (value >= 0.5) return 'bg-green-500 text-white';
    if (value >= 0.3) return 'bg-green-400 text-black';
    if (value >= 0.1) return 'bg-green-300 text-black';
    if (value >= -0.1) return 'bg-gray-300 text-black';
    if (value >= -0.3) return 'bg-red-300 text-black';
    if (value >= -0.5) return 'bg-red-400 text-white';
    if (value >= -0.7) return 'bg-red-500 text-white';
    return 'bg-red-600 text-white';
  };

  const getCorrelationLabel = (value: number): string => {
    const abs = Math.abs(value);
    if (abs >= 0.9) return 'Very Strong';
    if (abs >= 0.7) return 'Strong';
    if (abs >= 0.5) return 'Moderate';
    if (abs >= 0.3) return 'Weak';
    if (abs >= 0.1) return 'Very Weak';
    return 'None';
  };

  // Prepare scatter plot data
  const scatterData = selectedCell && rawData ?
    rawData[selectedCell.var1]?.map((val, idx) => ({
      x: val,
      y: rawData[selectedCell.var2]?.[idx] || 0
    })) : [];

  return (
    <>
      <Card className={cn('w-full', className)}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}

          {/* Color Legend */}
          <div className="flex items-center gap-2 mt-4 text-xs">
            <span className="text-muted-foreground">Correlation:</span>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-red-600"></div>
              <span>Strong Negative</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-gray-300"></div>
              <span>None</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-green-600"></div>
              <span>Strong Positive</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="p-2 text-left text-sm font-medium text-muted-foreground border-b">
                    Variable
                  </th>
                  {variables.map((variable) => (
                    <th
                      key={variable}
                      className="p-2 text-center text-xs font-medium text-muted-foreground border-b"
                      style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                    >
                      {variable}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {variables.map((var1) => (
                  <tr key={var1}>
                    <td className="p-2 text-sm font-medium text-muted-foreground border-r">
                      {var1}
                    </td>
                    {variables.map((var2) => {
                      const value = data[var1]?.[var2] || 0;
                      const isDiagonal = var1 === var2;

                      return (
                        <td
                          key={var2}
                          className={cn(
                            'p-2 text-center text-xs font-semibold border transition-all',
                            getCorrelationColor(value),
                            !isDiagonal && 'cursor-pointer hover:opacity-80 hover:scale-105'
                          )}
                          onClick={() => handleCellClick(var1, var2)}
                          title={`${var1} vs ${var2}: ${value.toFixed(3)} (${getCorrelationLabel(value)})`}
                        >
                          {value.toFixed(2)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Statistics */}
          <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-muted-foreground text-xs">Strong Correlations</div>
              <div className="text-lg font-semibold">
                {Object.values(data).flatMap(row =>
                  Object.values(row).filter(val => Math.abs(val) >= 0.7 && val !== 1)
                ).length / 2}
              </div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-muted-foreground text-xs">Moderate Correlations</div>
              <div className="text-lg font-semibold">
                {Object.values(data).flatMap(row =>
                  Object.values(row).filter(val => Math.abs(val) >= 0.5 && Math.abs(val) < 0.7)
                ).length / 2}
              </div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-muted-foreground text-xs">Weak/No Correlation</div>
              <div className="text-lg font-semibold">
                {Object.values(data).flatMap(row =>
                  Object.values(row).filter(val => Math.abs(val) < 0.5 && val !== 1)
                ).length / 2}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scatter Plot Dialog */}
      <Dialog open={!!selectedCell} onOpenChange={() => setSelectedCell(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Correlation: {selectedCell?.var1} vs {selectedCell?.var2}
            </DialogTitle>
          </DialogHeader>
          {selectedCell && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Correlation: </span>
                  <span className="font-semibold">
                    {data[selectedCell.var1]?.[selectedCell.var2]?.toFixed(3)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Strength: </span>
                  <span className="font-semibold">
                    {getCorrelationLabel(data[selectedCell.var1]?.[selectedCell.var2] || 0)}
                  </span>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={400}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="x"
                    name={selectedCell.var1}
                    label={{ value: selectedCell.var1, position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis
                    dataKey="y"
                    name={selectedCell.var2}
                    label={{ value: selectedCell.var2, angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '0.5rem'
                    }}
                  />
                  <Scatter
                    data={scatterData}
                    fill="#3b82f6"
                    fillOpacity={0.6}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
