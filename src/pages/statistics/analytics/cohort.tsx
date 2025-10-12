/**
 * Cohort Analysis Page
 *
 * Analyze customer and employee cohorts over time,
 * track retention, and compare cohort performance.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CohortGrid, type CohortData } from './components/CohortGrid';
import { IconRefresh, IconDownload } from '@tabler/icons-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function CohortAnalysisPage() {
  const [cohortType, setCohortType] = useState<'customer' | 'employee'>('customer');
  const [metricType, setMetricType] = useState<'retention' | 'value' | 'engagement'>('retention');

  // Sample customer cohort data
  const customerCohorts: CohortData[] = [
    {
      cohort: 'Jan 2025',
      cohortDate: new Date(2025, 0, 1),
      periods: [
        { period: 0, value: 100, percentage: 100 },
        { period: 1, value: 87, percentage: 87 },
        { period: 2, value: 78, percentage: 78 },
        { period: 3, value: 72, percentage: 72 },
        { period: 4, value: 68, percentage: 68 },
        { period: 5, value: 65, percentage: 65 }
      ]
    },
    {
      cohort: 'Feb 2025',
      cohortDate: new Date(2025, 1, 1),
      periods: [
        { period: 0, value: 120, percentage: 100 },
        { period: 1, value: 102, percentage: 85 },
        { period: 2, value: 90, percentage: 75 },
        { period: 3, value: 84, percentage: 70 },
        { period: 4, value: 78, percentage: 65 }
      ]
    },
    {
      cohort: 'Mar 2025',
      cohortDate: new Date(2025, 2, 1),
      periods: [
        { period: 0, value: 150, percentage: 100 },
        { period: 1, value: 135, percentage: 90 },
        { period: 2, value: 123, percentage: 82 },
        { period: 3, value: 114, percentage: 76 }
      ]
    },
    {
      cohort: 'Apr 2025',
      cohortDate: new Date(2025, 3, 1),
      periods: [
        { period: 0, value: 180, percentage: 100 },
        { period: 1, value: 167, percentage: 93 },
        { period: 2, value: 153, percentage: 85 }
      ]
    },
    {
      cohort: 'May 2025',
      cohortDate: new Date(2025, 4, 1),
      periods: [
        { period: 0, value: 200, percentage: 100 },
        { period: 1, value: 188, percentage: 94 }
      ]
    },
    {
      cohort: 'Jun 2025',
      cohortDate: new Date(2025, 5, 1),
      periods: [
        { period: 0, value: 220, percentage: 100 }
      ]
    }
  ];

  // Sample employee cohort data
  const employeeCohorts: CohortData[] = [
    {
      cohort: 'Q1 2024',
      cohortDate: new Date(2024, 0, 1),
      periods: [
        { period: 0, value: 25, percentage: 100 },
        { period: 1, value: 24, percentage: 96 },
        { period: 2, value: 23, percentage: 92 },
        { period: 3, value: 22, percentage: 88 },
        { period: 4, value: 21, percentage: 84 }
      ]
    },
    {
      cohort: 'Q2 2024',
      cohortDate: new Date(2024, 3, 1),
      periods: [
        { period: 0, value: 30, percentage: 100 },
        { period: 1, value: 29, percentage: 97 },
        { period: 2, value: 28, percentage: 93 },
        { period: 3, value: 27, percentage: 90 }
      ]
    },
    {
      cohort: 'Q3 2024',
      cohortDate: new Date(2024, 6, 1),
      periods: [
        { period: 0, value: 28, percentage: 100 },
        { period: 1, value: 27, percentage: 96 },
        { period: 2, value: 26, percentage: 93 }
      ]
    },
    {
      cohort: 'Q4 2024',
      cohortDate: new Date(2024, 9, 1),
      periods: [
        { period: 0, value: 32, percentage: 100 },
        { period: 1, value: 31, percentage: 97 }
      ]
    }
  ];

  // Cohort comparison chart data
  const comparisonData = customerCohorts.map(cohort => {
    const lastPeriod = cohort.periods[cohort.periods.length - 1];
    return {
      cohort: cohort.cohort,
      retention: lastPeriod.percentage,
      size: cohort.periods[0].value
    };
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cohort Analysis</h1>
          <p className="text-muted-foreground mt-1">
            Track retention and performance across different cohorts
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

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Analysis Configuration</CardTitle>
          <CardDescription>Select cohort type and metrics to analyze</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Cohort Type</label>
              <Select value={cohortType} onValueChange={(v) => setCohortType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer Cohorts</SelectItem>
                  <SelectItem value="employee">Employee Cohorts</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Metric</label>
              <Select value={metricType} onValueChange={(v) => setMetricType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="retention">Retention Rate</SelectItem>
                  <SelectItem value="value">Lifetime Value</SelectItem>
                  <SelectItem value="engagement">Engagement Score</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="grid" className="space-y-4">
        <TabsList>
          <TabsTrigger value="grid">Cohort Grid</TabsTrigger>
          <TabsTrigger value="comparison">Cohort Comparison</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        {/* Cohort Grid Tab */}
        <TabsContent value="grid">
          {cohortType === 'customer' && (
            <CohortGrid
              data={customerCohorts}
              title="Customer Retention Cohorts"
              description="Monthly customer cohorts showing retention over time"
              percentageMode={true}
              colorScheme="green"
            />
          )}
          {cohortType === 'employee' && (
            <CohortGrid
              data={employeeCohorts}
              title="Employee Retention Cohorts"
              description="Quarterly employee cohorts showing retention over time"
              percentageMode={true}
              colorScheme="blue"
            />
          )}
        </TabsContent>

        {/* Comparison Tab */}
        <TabsContent value="comparison" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cohort Performance Comparison</CardTitle>
              <CardDescription>Compare retention rates across cohorts</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="cohort" className="text-xs" />
                  <YAxis className="text-xs" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '0.5rem'
                    }}
                    formatter={(value: any) => [`${value}%`, 'Retention']}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="retention"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="Retention Rate"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Best Performing Cohort</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-2xl font-bold text-green-600">
                    {comparisonData[0]?.cohort}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {comparisonData[0]?.retention.toFixed(1)}% retention rate
                  </div>
                  <div className="text-sm">
                    Initial size: {comparisonData[0]?.size} {cohortType === 'customer' ? 'customers' : 'employees'}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Average Retention</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-2xl font-bold">
                    {(comparisonData.reduce((sum, c) => sum + c.retention, 0) / comparisonData.length).toFixed(1)}%
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Across all cohorts
                  </div>
                  <div className="text-sm">
                    Total {cohortType === 'customer' ? 'customers' : 'employees'}: {comparisonData.reduce((sum, c) => sum + c.size, 0)}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights">
          <Card>
            <CardHeader>
              <CardTitle>Key Insights & Recommendations</CardTitle>
              <CardDescription>Analysis based on cohort data</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-green-50 dark:bg-green-950/20 border-l-4 border-green-600 rounded">
                  <h4 className="font-semibold text-green-900 dark:text-green-100 mb-1">
                    Strong Retention Trend
                  </h4>
                  <p className="text-sm text-green-800 dark:text-green-200">
                    Recent cohorts show improved retention rates, indicating better onboarding or product improvements are working.
                  </p>
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border-l-4 border-blue-600 rounded">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                    Period 1-2 Critical
                  </h4>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Largest drop-off occurs between period 1 and 2. Focus retention efforts during this critical window.
                  </p>
                </div>

                <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border-l-4 border-purple-600 rounded">
                  <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">
                    Cohort Size Impact
                  </h4>
                  <p className="text-sm text-purple-800 dark:text-purple-200">
                    Larger cohorts tend to maintain slightly higher retention rates, suggesting network effects or better resource allocation.
                  </p>
                </div>

                <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border-l-4 border-yellow-600 rounded">
                  <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-1">
                    Seasonal Patterns
                  </h4>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    Q1 cohorts show different behavior than Q3 cohorts. Consider seasonal factors in retention strategies.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
