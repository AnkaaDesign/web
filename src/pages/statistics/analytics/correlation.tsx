/**
 * Correlation Analysis Page
 *
 * Discover relationships between metrics with correlation matrix,
 * scatter plots, and regression analysis.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CorrelationMatrix } from './components/CorrelationMatrix';
import { calculateCorrelation, correlationMatrix, calculateRegression } from './utils/correlation-helpers';
import { IconRefresh, IconDownload } from '@tabler/icons-react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function CorrelationAnalysisPage() {
  const [selectedVar1, setSelectedVar1] = useState('revenue');
  const [selectedVar2, setSelectedVar2] = useState('costs');

  // Sample data for analysis
  const rawData = {
    revenue: [120000, 135000, 150000, 145000, 160000, 155000, 170000, 165000, 180000, 175000],
    costs: [80000, 90000, 95000, 92000, 100000, 98000, 105000, 102000, 110000, 108000],
    employees: [120, 122, 125, 124, 128, 127, 130, 129, 132, 131],
    satisfaction: [4.2, 4.3, 4.5, 4.4, 4.6, 4.5, 4.7, 4.6, 4.8, 4.7],
    efficiency: [82, 84, 87, 85, 89, 88, 91, 90, 93, 92],
    orders: [450, 480, 520, 510, 550, 540, 580, 570, 610, 600]
  };

  const variables = Object.keys(rawData);

  // Calculate correlation matrix
  const corrMatrix = correlationMatrix(rawData);

  // Calculate regression for selected variables
  const regression = calculateRegression(rawData[selectedVar1], rawData[selectedVar2]);

  // Prepare scatter plot data
  const scatterData = rawData[selectedVar1].map((val, idx) => ({
    x: val,
    y: rawData[selectedVar2][idx]
  }));

  // Find strongest correlations
  const strongestCorrelations = [];
  for (const var1 of variables) {
    for (const var2 of variables) {
      if (var1 < var2) {
        const corr = corrMatrix[var1]?.[var2] || 0;
        if (Math.abs(corr) >= 0.5) {
          strongestCorrelations.push({
            var1,
            var2,
            correlation: corr,
            strength: Math.abs(corr) >= 0.7 ? 'Strong' : 'Moderate'
          });
        }
      }
    }
  }

  strongestCorrelations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Correlation Analysis</h1>
          <p className="text-muted-foreground mt-1">
            Discover relationships and dependencies between metrics
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <IconRefresh className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline">
            <IconDownload className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Strong Correlations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {strongestCorrelations.filter(c => c.strength === 'Strong').length}
            </div>
            <div className="text-sm text-muted-foreground">|r| ≥ 0.7</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Moderate Correlations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {strongestCorrelations.filter(c => c.strength === 'Moderate').length}
            </div>
            <div className="text-sm text-muted-foreground">0.5 ≤ |r| &lt; 0.7</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Variables Analyzed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{variables.length}</div>
            <div className="text-sm text-muted-foreground">Total metrics</div>
          </CardContent>
        </Card>
      </div>

      {/* Correlation Matrix */}
      <CorrelationMatrix
        data={corrMatrix}
        variables={variables}
        rawData={rawData}
        title="Correlation Matrix"
        description="Click any cell to view detailed scatter plot and regression analysis"
      />

      {/* Strongest Correlations */}
      <Card>
        <CardHeader>
          <CardTitle>Strongest Correlations</CardTitle>
          <CardDescription>Most significant relationships between variables</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {strongestCorrelations.slice(0, 5).map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <div className="font-medium capitalize">
                    {item.var1} vs {item.var2}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {item.strength} {item.correlation > 0 ? 'positive' : 'negative'} correlation
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold">
                    {item.correlation.toFixed(3)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {item.strength}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Analysis</CardTitle>
          <CardDescription>Scatter plot and regression for selected variables</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">X-Axis Variable</label>
              <Select value={selectedVar1} onValueChange={setSelectedVar1}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {variables.map(v => (
                    <SelectItem key={v} value={v} className="capitalize">{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Y-Axis Variable</label>
              <Select value={selectedVar2} onValueChange={setSelectedVar2}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {variables.map(v => (
                    <SelectItem key={v} value={v} className="capitalize">{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
            <div>
              <div className="text-sm text-muted-foreground">Correlation</div>
              <div className="text-xl font-bold">
                {(corrMatrix[selectedVar1]?.[selectedVar2] || 0).toFixed(3)}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">R² (Goodness of Fit)</div>
              <div className="text-xl font-bold">
                {regression.r2.toFixed(3)}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Slope</div>
              <div className="text-xl font-bold">
                {regression.slope.toFixed(4)}
              </div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="x"
                name={selectedVar1}
                label={{ value: selectedVar1, position: 'insideBottom', offset: -5 }}
                className="text-xs"
              />
              <YAxis
                dataKey="y"
                name={selectedVar2}
                label={{ value: selectedVar2, angle: -90, position: 'insideLeft' }}
                className="text-xs"
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

          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
            <h4 className="font-semibold mb-2">Interpretation</h4>
            <p className="text-sm text-muted-foreground">
              {Math.abs(corrMatrix[selectedVar1]?.[selectedVar2] || 0) >= 0.7
                ? `Strong ${corrMatrix[selectedVar1]?.[selectedVar2] > 0 ? 'positive' : 'negative'} correlation detected. Changes in ${selectedVar1} are strongly associated with changes in ${selectedVar2}.`
                : Math.abs(corrMatrix[selectedVar1]?.[selectedVar2] || 0) >= 0.5
                ? `Moderate correlation detected. There is a noticeable relationship between ${selectedVar1} and ${selectedVar2}.`
                : `Weak or no correlation detected. ${selectedVar1} and ${selectedVar2} show little linear relationship.`}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
