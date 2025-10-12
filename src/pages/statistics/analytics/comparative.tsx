/**
 * Comparative Analysis Page
 *
 * Compare metrics across different time periods, entities,
 * and benchmarks with side-by-side visualizations.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ComparisonTable, type ComparisonRow } from './components/ComparisonTable';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { IconRefresh, IconDownload } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

type ComparisonType = 'period' | 'entity' | 'benchmark';
type PeriodType = 'mom' | 'yoy' | 'custom';

export default function ComparativeAnalysisPage() {
  const [comparisonType, setComparisonType] = useState<ComparisonType>('period');
  const [periodType, setPeriodType] = useState<PeriodType>('mom');
  const [loading, setLoading] = useState(false);

  // Sample comparison data
  const periodComparisonData: ComparisonRow[] = [
    { metric: 'Revenue', current: 150000, previous: 120000, format: 'currency', higherIsBetter: true },
    { metric: 'Orders Completed', current: 450, previous: 380, format: 'number', higherIsBetter: true },
    { metric: 'Average Order Value', current: 333.33, previous: 315.79, format: 'currency', higherIsBetter: true },
    { metric: 'Production Efficiency', current: 87.5, previous: 82.3, format: 'percentage', higherIsBetter: true },
    { metric: 'Cost per Unit', current: 45.20, previous: 48.50, format: 'currency', higherIsBetter: false },
    { metric: 'Employee Count', current: 125, previous: 120, format: 'number', higherIsBetter: true },
    { metric: 'Inventory Turnover', current: 6.5, previous: 5.8, format: 'number', higherIsBetter: true },
    { metric: 'Customer Satisfaction', current: 4.6, previous: 4.4, format: 'number', higherIsBetter: true }
  ];

  const entityComparisonData: ComparisonRow[] = [
    { metric: 'Production Volume', current: 5200, previous: 4800, format: 'number', higherIsBetter: true },
    { metric: 'Efficiency Rate', current: 89.2, previous: 85.7, format: 'percentage', higherIsBetter: true },
    { metric: 'Quality Score', current: 96.5, previous: 94.2, format: 'percentage', higherIsBetter: true },
    { metric: 'Downtime Hours', current: 12, previous: 18, format: 'number', higherIsBetter: false },
    { metric: 'Cost per Unit', current: 42.30, previous: 45.80, format: 'currency', higherIsBetter: false }
  ];

  const benchmarkComparisonData: ComparisonRow[] = [
    { metric: 'Revenue Growth', current: 25.0, previous: 15.0, format: 'percentage', higherIsBetter: true },
    { metric: 'Profit Margin', current: 22.5, previous: 20.0, format: 'percentage', higherIsBetter: true },
    { metric: 'Employee Productivity', current: 1200, previous: 1000, format: 'number', higherIsBetter: true },
    { metric: 'Customer Retention', current: 85.3, previous: 80.0, format: 'percentage', higherIsBetter: true },
    { metric: 'Inventory Days', current: 45, previous: 60, format: 'number', higherIsBetter: false }
  ];

  // Sample chart data
  const monthlyComparisonChart = [
    { month: 'Jan', current: 120000, previous: 100000 },
    { month: 'Feb', current: 135000, previous: 110000 },
    { month: 'Mar', current: 150000, previous: 120000 },
    { month: 'Apr', current: 145000, previous: 125000 },
    { month: 'May', current: 160000, previous: 130000 },
    { month: 'Jun', current: 155000, previous: 135000 }
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Comparative Analysis</h1>
          <p className="text-muted-foreground mt-1">
            Compare performance across time periods, entities, and benchmarks
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setLoading(true)} disabled={loading}>
            <IconRefresh className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
            Refresh
          </Button>
          <Button variant="outline">
            <IconDownload className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Comparison Type Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Comparison Configuration</CardTitle>
          <CardDescription>Select what you want to compare</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select value={comparisonType} onValueChange={(v) => setComparisonType(v as ComparisonType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="period">Period Comparison</SelectItem>
                <SelectItem value="entity">Entity Comparison</SelectItem>
                <SelectItem value="benchmark">Benchmark Analysis</SelectItem>
              </SelectContent>
            </Select>

            {comparisonType === 'period' && (
              <Select value={periodType} onValueChange={(v) => setPeriodType(v as PeriodType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mom">Month over Month</SelectItem>
                  <SelectItem value="yoy">Year over Year</SelectItem>
                  <SelectItem value="custom">Custom Period</SelectItem>
                </SelectContent>
              </Select>
            )}

            {comparisonType === 'entity' && (
              <>
                <Select defaultValue="sector-a">
                  <SelectTrigger>
                    <SelectValue placeholder="Select first entity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sector-a">Sector A</SelectItem>
                    <SelectItem value="sector-b">Sector B</SelectItem>
                    <SelectItem value="sector-c">Sector C</SelectItem>
                  </SelectContent>
                </Select>
                <Select defaultValue="sector-b">
                  <SelectTrigger>
                    <SelectValue placeholder="Select second entity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sector-a">Sector A</SelectItem>
                    <SelectItem value="sector-b">Sector B</SelectItem>
                    <SelectItem value="sector-c">Sector C</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}

            {comparisonType === 'benchmark' && (
              <Select defaultValue="industry">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="industry">Industry Average</SelectItem>
                  <SelectItem value="target">Target Goals</SelectItem>
                  <SelectItem value="historical">Historical Average</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Content based on comparison type */}
      {comparisonType === 'period' && (
        <div className="space-y-6">
          {/* Visual Comparison */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue Trend Comparison</CardTitle>
              <CardDescription>
                Current period vs previous period
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={monthlyComparisonChart}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(value) =>
                    new Intl.NumberFormat('pt-BR', {
                      notation: 'compact',
                      compactDisplay: 'short'
                    }).format(value)
                  } />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '0.5rem'
                    }}
                    formatter={(value: any) =>
                      new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL'
                      }).format(value)
                    }
                  />
                  <Legend />
                  <Line type="monotone" dataKey="previous" stroke="#94a3b8" strokeWidth={2} name="Previous Period" />
                  <Line type="monotone" dataKey="current" stroke="#3b82f6" strokeWidth={2} name="Current Period" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <ComparisonTable
            data={periodComparisonData}
            title="Period Comparison Metrics"
            description={`Comparing ${periodType === 'mom' ? 'this month vs last month' : periodType === 'yoy' ? 'this year vs last year' : 'selected periods'}`}
            currentLabel="Current Period"
            previousLabel="Previous Period"
            showPercentage={true}
            showDifference={true}
          />
        </div>
      )}

      {comparisonType === 'entity' && (
        <div className="space-y-6">
          {/* Bar Chart Comparison */}
          <Card>
            <CardHeader>
              <CardTitle>Entity Performance Comparison</CardTitle>
              <CardDescription>Sector A vs Sector B</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={entityComparisonData.map(row => ({
                    metric: row.metric,
                    'Sector A': row.current,
                    'Sector B': row.previous
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="metric" className="text-xs" angle={-45} textAnchor="end" height={100} />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '0.5rem'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="Sector A" fill="#3b82f6" />
                  <Bar dataKey="Sector B" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <ComparisonTable
            data={entityComparisonData}
            title="Detailed Entity Comparison"
            description="Side-by-side comparison of key metrics"
            currentLabel="Sector A"
            previousLabel="Sector B"
            showPercentage={true}
            showDifference={true}
          />
        </div>
      )}

      {comparisonType === 'benchmark' && (
        <div className="space-y-6">
          {/* Benchmark Comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Metrics Above Benchmark</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {benchmarkComparisonData.filter(row => row.current > row.previous).length}
                  <span className="text-sm text-muted-foreground ml-2">
                    / {benchmarkComparisonData.length}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Average Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {(benchmarkComparisonData.reduce((sum, row) =>
                    sum + ((row.current / row.previous) * 100), 0) / benchmarkComparisonData.length
                  ).toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">vs benchmark</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Overall Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  Exceeding
                </div>
                <div className="text-xs text-muted-foreground">industry standards</div>
              </CardContent>
            </Card>
          </div>

          <ComparisonTable
            data={benchmarkComparisonData}
            title="Benchmark Comparison"
            description="Your performance vs industry benchmarks"
            currentLabel="Your Company"
            previousLabel="Industry Avg"
            showPercentage={true}
            showDifference={true}
          />

          {/* Insights */}
          <Card>
            <CardHeader>
              <CardTitle>Key Insights</CardTitle>
              <CardDescription>Analysis and recommendations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-4 bg-green-50 dark:bg-green-950/20 border-l-4 border-green-600 rounded">
                  <h4 className="font-semibold text-green-900 dark:text-green-100">Strong Performance</h4>
                  <p className="text-sm text-green-800 dark:text-green-200 mt-1">
                    Revenue growth and profit margins exceed industry benchmarks significantly
                  </p>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border-l-4 border-blue-600 rounded">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100">Opportunity</h4>
                  <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                    Inventory management shows room for improvement compared to industry standards
                  </p>
                </div>
                <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border-l-4 border-purple-600 rounded">
                  <h4 className="font-semibold text-purple-900 dark:text-purple-100">Recommendation</h4>
                  <p className="text-sm text-purple-800 dark:text-purple-200 mt-1">
                    Consider implementing best practices from top performers in customer retention
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
