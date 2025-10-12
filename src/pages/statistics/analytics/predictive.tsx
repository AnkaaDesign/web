/**
 * Predictive Analytics Page
 *
 * Advanced predictive analytics with demand forecasting,
 * task completion forecasting, cost forecasting, and trend analysis.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PredictionChart } from './components/PredictionChart';
import {
  forecastDemand,
  forecastTaskCompletion,
  forecastCosts,
  detectAnomalies,
  identifyTrends,
  type TimeSeriesData,
  type ForecastResult
} from './utils/predictive-models';
import { IconRefresh, IconDownload, IconAlertTriangle, IconTrendingUp } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

export default function PredictiveAnalyticsPage() {
  const [forecastPeriod, setForecastPeriod] = useState<number>(7);
  const [confidenceLevel, setConfidenceLevel] = useState<number>(0.95);
  const [loading, setLoading] = useState(false);

  // Demo data - in production, fetch from API
  const [inventoryData, setInventoryData] = useState<TimeSeriesData[]>([]);
  const [taskData, setTaskData] = useState<TimeSeriesData[]>([]);
  const [costData, setCostData] = useState<TimeSeriesData[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // In production, fetch from API
      // For now, generate sample data
      setInventoryData(generateSampleData(30, 100, 20));
      setTaskData(generateSampleData(30, 50, 10));
      setCostData(generateSampleData(30, 10000, 2000));
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Demand Forecasting
  const demandForecast = forecastDemand(inventoryData, forecastPeriod, confidenceLevel);
  const demandAnomalies = detectAnomalies(inventoryData);
  const demandTrend = identifyTrends(inventoryData);

  // Task Completion Forecasting
  const taskForecast = forecastTaskCompletion(100, taskData, 5);

  // Cost Forecasting
  const costForecast = forecastCosts(costData, forecastPeriod);

  // Prepare chart data
  const demandChartData = [
    ...inventoryData.map(d => ({
      timestamp: d.timestamp,
      actual: d.value
    })),
    ...demandForecast.predicted.map((value, i) => ({
      timestamp: demandForecast.timestamps[i],
      predicted: value,
      lower: demandForecast.confidenceIntervals.lower[i],
      upper: demandForecast.confidenceIntervals.upper[i]
    }))
  ];

  const costChartData = [
    ...costData.map(d => ({
      timestamp: d.timestamp,
      actual: d.value
    })),
    ...costForecast.predicted.map((value, i) => ({
      timestamp: costForecast.months[i],
      predicted: value,
      lower: costForecast.riskAnalysis.confidenceIntervals.lower[i],
      upper: costForecast.riskAnalysis.confidenceIntervals.upper[i]
    }))
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Predictive Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Forecast future trends and make data-driven predictions
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadData} disabled={loading}>
            <IconRefresh className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
            Refresh
          </Button>
          <Button variant="outline">
            <IconDownload className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Configuration Panel */}
      <Card>
        <CardHeader>
          <CardTitle>Forecast Configuration</CardTitle>
          <CardDescription>Configure prediction parameters</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="forecast-period">Forecast Period (days)</Label>
              <Input
                id="forecast-period"
                type="number"
                min={1}
                max={90}
                value={forecastPeriod}
                onChange={(e) => setForecastPeriod(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confidence">Confidence Level</Label>
              <Select
                value={confidenceLevel.toString()}
                onValueChange={(v) => setConfidenceLevel(Number(v))}
              >
                <SelectTrigger id="confidence">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.90">90%</SelectItem>
                  <SelectItem value="0.95">95%</SelectItem>
                  <SelectItem value="0.99">99%</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Forecast Model</Label>
              <Select defaultValue="auto">
                <SelectTrigger id="model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (Recommended)</SelectItem>
                  <SelectItem value="linear">Linear Regression</SelectItem>
                  <SelectItem value="seasonal">Seasonal Decomposition</SelectItem>
                  <SelectItem value="exponential">Exponential Smoothing</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for different forecast types */}
      <Tabs defaultValue="demand" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="demand">Demand Forecasting</TabsTrigger>
          <TabsTrigger value="tasks">Task Completion</TabsTrigger>
          <TabsTrigger value="costs">Cost Forecasting</TabsTrigger>
          <TabsTrigger value="trends">Trend Analysis</TabsTrigger>
        </TabsList>

        {/* Demand Forecasting Tab */}
        <TabsContent value="demand" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Trend Direction</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={cn(
                  'text-2xl font-bold',
                  demandForecast.trend === 'increasing' && 'text-green-600',
                  demandForecast.trend === 'decreasing' && 'text-red-600',
                  demandForecast.trend === 'stable' && 'text-gray-600'
                )}>
                  {demandForecast.trend === 'increasing' && '↗ Increasing'}
                  {demandForecast.trend === 'decreasing' && '↘ Decreasing'}
                  {demandForecast.trend === 'stable' && '→ Stable'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Seasonality</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {demandForecast.seasonality?.detected ? (
                    <span className="text-blue-600">
                      Detected ({demandForecast.seasonality.period} days)
                    </span>
                  ) : (
                    <span className="text-gray-600">Not Detected</span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Anomalies Detected</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {demandAnomalies.summary.total}
                  <span className="text-sm text-muted-foreground ml-2">
                    ({demandAnomalies.summary.percentage.toFixed(1)}%)
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <PredictionChart
            data={demandChartData}
            title="Inventory Demand Forecast"
            description="Predicted inventory demand with confidence intervals"
            valueFormatter={(value) => value.toFixed(0)}
            showConfidenceIntervals={true}
          />

          {demandAnomalies.anomalies.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconAlertTriangle className="h-5 w-5 text-orange-600" />
                  Anomalies Detected
                </CardTitle>
                <CardDescription>Unusual patterns that require attention</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {demandAnomalies.anomalies.slice(0, 5).map((anomaly, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                      <div>
                        <div className="font-medium">{anomaly.timestamp.toLocaleDateString()}</div>
                        <div className="text-sm text-muted-foreground">
                          Value: {anomaly.value.toFixed(2)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">Z-Score</div>
                        <div className="font-semibold text-orange-600">
                          {anomaly.score.toFixed(2)}σ
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Task Completion Tab */}
        <TabsContent value="tasks" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Estimated Completion</CardTitle>
                <CardDescription>When will all tasks be completed?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground">Estimated Date</div>
                  <div className="text-2xl font-bold">
                    {taskForecast.estimatedCompletionDate.toLocaleDateString()}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground">Earliest</div>
                    <div className="font-semibold">
                      {taskForecast.confidenceInterval.earliest.toLocaleDateString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Latest</div>
                    <div className="font-semibold">
                      {taskForecast.confidenceInterval.latest.toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Velocity Metrics</CardTitle>
                <CardDescription>Task completion rates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground">Current Velocity</div>
                  <div className="text-2xl font-bold">
                    {taskForecast.projectedVelocity.toFixed(1)} tasks/day
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Average Velocity</div>
                  <div className="font-semibold">
                    {taskForecast.averageVelocity.toFixed(1)} tasks/day
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>What-If Scenarios</CardTitle>
              <CardDescription>Explore different scenarios</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { name: 'Increase velocity by 20%', velocity: taskForecast.projectedVelocity * 1.2 },
                  { name: 'Decrease velocity by 20%', velocity: taskForecast.projectedVelocity * 0.8 },
                  { name: 'Double current velocity', velocity: taskForecast.projectedVelocity * 2 }
                ].map((scenario, i) => {
                  const daysNeeded = Math.ceil(100 / scenario.velocity);
                  const completionDate = new Date();
                  completionDate.setDate(completionDate.getDate() + daysNeeded);

                  return (
                    <div key={i} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="font-medium">{scenario.name}</div>
                      <div className="text-right">
                        <div className="font-semibold">{completionDate.toLocaleDateString()}</div>
                        <div className="text-xs text-muted-foreground">
                          {daysNeeded} days
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cost Forecasting Tab */}
        <TabsContent value="costs" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Total Predicted Cost</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                  }).format(costForecast.predicted.reduce((a, b) => a + b, 0))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Volatility</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={cn(
                  'text-2xl font-bold',
                  costForecast.riskAnalysis.volatility > 0.3 && 'text-red-600',
                  costForecast.riskAnalysis.volatility > 0.15 && costForecast.riskAnalysis.volatility <= 0.3 && 'text-yellow-600',
                  costForecast.riskAnalysis.volatility <= 0.15 && 'text-green-600'
                )}>
                  {(costForecast.riskAnalysis.volatility * 100).toFixed(1)}%
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Risk Level</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {costForecast.riskAnalysis.volatility > 0.3 ? (
                    <span className="text-red-600">High</span>
                  ) : costForecast.riskAnalysis.volatility > 0.15 ? (
                    <span className="text-yellow-600">Medium</span>
                  ) : (
                    <span className="text-green-600">Low</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <PredictionChart
            data={costChartData}
            title="Cost Forecast"
            description="Predicted costs with confidence intervals"
            valueFormatter={(value) => new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL'
            }).format(value)}
            showConfidenceIntervals={true}
          />
        </TabsContent>

        {/* Trend Analysis Tab */}
        <TabsContent value="trends" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Inventory Trend</CardTitle>
                  <IconTrendingUp className={cn(
                    'h-5 w-5',
                    demandTrend.currentTrend === 'increasing' && 'text-green-600',
                    demandTrend.currentTrend === 'decreasing' && 'text-red-600',
                    demandTrend.currentTrend === 'stable' && 'text-gray-600'
                  )} />
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <div className="text-sm text-muted-foreground">Direction</div>
                  <div className="text-lg font-semibold capitalize">{demandTrend.currentTrend}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Strength</div>
                  <div className="text-lg font-semibold">{(demandTrend.strength * 100).toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Change Rate</div>
                  <div className="text-lg font-semibold">{demandTrend.changeRate.toFixed(2)}%/day</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pattern Recognition</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="text-sm">Cyclic Pattern</span>
                    <span className="font-semibold">
                      {demandForecast.seasonality?.detected ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="text-sm">Outliers</span>
                    <span className="font-semibold">{demandAnomalies.summary.total}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="text-sm">Data Quality</span>
                    <span className="font-semibold text-green-600">Good</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {demandTrend.currentTrend === 'increasing' && (
                    <li className="flex items-start gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-blue-600 mt-1.5"></div>
                      <span>Consider increasing inventory buffer</span>
                    </li>
                  )}
                  {demandAnomalies.summary.total > 0 && (
                    <li className="flex items-start gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-orange-600 mt-1.5"></div>
                      <span>Investigate recent anomalies</span>
                    </li>
                  )}
                  {demandForecast.seasonality?.detected && (
                    <li className="flex items-start gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-green-600 mt-1.5"></div>
                      <span>Plan for seasonal variations</span>
                    </li>
                  )}
                  <li className="flex items-start gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-blue-600 mt-1.5"></div>
                    <span>Monitor trends weekly for changes</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Helper function to generate sample data
function generateSampleData(days: number, mean: number, variance: number): TimeSeriesData[] {
  const data: TimeSeriesData[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    // Generate value with some trend and randomness
    const trend = (days - i) * 0.5;
    const random = (Math.random() - 0.5) * variance;
    const value = mean + trend + random;

    data.push({
      timestamp: date,
      value: Math.max(0, value)
    });
  }

  return data;
}
