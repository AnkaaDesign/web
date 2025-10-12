/**
 * Executive Dashboard Page
 *
 * High-level overview with strategic KPIs, health scores,
 * and drill-down capabilities for executives.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  IconTrendingUp,
  IconTrendingDown,
  IconCircleCheck,
  IconAlertTriangle,
  IconCircleX,
  IconRefresh,
  IconDownload,
  IconChartBar,
  IconUsers,
  IconPackage,
  IconCash
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function ExecutiveDashboardPage() {
  const [loading, setLoading] = useState(false);

  // Company Health Score (0-100)
  const healthScore = 82;

  // Strategic KPIs
  const kpis = [
    {
      title: 'Revenue Growth',
      value: '28.5%',
      change: '+5.3%',
      trend: 'up',
      status: 'success',
      icon: IconCash,
      target: 25,
      current: 28.5
    },
    {
      title: 'Profit Margin',
      value: '22.8%',
      change: '+2.1%',
      trend: 'up',
      status: 'success',
      icon: IconChartBar,
      target: 20,
      current: 22.8
    },
    {
      title: 'Customer Satisfaction',
      value: '4.6/5.0',
      change: '+0.2',
      trend: 'up',
      status: 'success',
      icon: IconCircleCheck,
      target: 4.5,
      current: 4.6
    },
    {
      title: 'Employee Retention',
      value: '87.3%',
      change: '-1.2%',
      trend: 'down',
      status: 'warning',
      icon: IconUsers,
      target: 90,
      current: 87.3
    },
    {
      title: 'Inventory Efficiency',
      value: '76.2%',
      change: '+3.8%',
      trend: 'up',
      status: 'success',
      icon: IconPackage,
      target: 80,
      current: 76.2
    },
    {
      title: 'Operational Efficiency',
      value: '91.5%',
      change: '+4.2%',
      trend: 'up',
      status: 'success',
      icon: IconTrendingUp,
      target: 85,
      current: 91.5
    }
  ];

  // Revenue trend data
  const revenueData = [
    { month: 'Jan', revenue: 450000, target: 420000 },
    { month: 'Feb', revenue: 520000, target: 480000 },
    { month: 'Mar', revenue: 580000, target: 550000 },
    { month: 'Apr', revenue: 620000, target: 590000 },
    { month: 'May', revenue: 680000, target: 630000 },
    { month: 'Jun', revenue: 720000, target: 670000 }
  ];

  // Department performance
  const departmentData = [
    { name: 'Production', performance: 92 },
    { name: 'Sales', performance: 88 },
    { name: 'HR', performance: 85 },
    { name: 'Finance', performance: 90 },
    { name: 'IT', performance: 87 }
  ];

  // Market position
  const marketShare = [
    { name: 'Our Company', value: 28, color: '#3b82f6' },
    { name: 'Competitor A', value: 22, color: '#8b5cf6' },
    { name: 'Competitor B', value: 18, color: '#ec4899' },
    { name: 'Others', value: 32, color: '#94a3b8' }
  ];

  // Alerts and issues
  const alerts = [
    { severity: 'warning', message: 'Employee retention below target', action: 'View HR Report' },
    { severity: 'info', message: 'Q2 targets exceeded by 15%', action: 'View Details' },
    { severity: 'warning', message: 'Inventory turnover needs attention', action: 'View Inventory' }
  ];

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getHealthScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Poor';
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Executive Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Strategic overview and key performance indicators
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

      {/* Company Health Score */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle>Company Health Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-8">
            <div className="flex-shrink-0">
              <div className="relative w-40 h-40">
                <svg className="w-full h-full -rotate-90">
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    className="text-muted"
                  />
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 70}`}
                    strokeDashoffset={`${2 * Math.PI * 70 * (1 - healthScore / 100)}`}
                    className={cn(getHealthScoreColor(healthScore))}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className={cn('text-4xl font-bold', getHealthScoreColor(healthScore))}>
                    {healthScore}
                  </div>
                  <div className="text-sm text-muted-foreground">out of 100</div>
                </div>
              </div>
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <div className="text-2xl font-semibold mb-1">{getHealthScoreLabel(healthScore)}</div>
                <p className="text-muted-foreground">
                  Your company is performing well across all key metrics with room for improvement in specific areas.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <IconCircleCheck className="h-5 w-5 text-green-600" />
                  <div>
                    <div className="font-semibold">5</div>
                    <div className="text-muted-foreground">Excellent</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <IconAlertTriangle className="h-5 w-5 text-yellow-600" />
                  <div>
                    <div className="font-semibold">1</div>
                    <div className="text-muted-foreground">Needs Attention</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <IconCircleX className="h-5 w-5 text-red-600" />
                  <div>
                    <div className="font-semibold">0</div>
                    <div className="text-muted-foreground">Critical</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Strategic KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((kpi, index) => {
          const Icon = kpi.icon;
          const progress = (kpi.current / kpi.target) * 100;

          return (
            <Card
              key={index}
              className="cursor-pointer hover:shadow-lg transition-shadow"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {kpi.title}
                    </CardTitle>
                    <div className="text-2xl font-bold mt-2">{kpi.value}</div>
                  </div>
                  <Icon className={cn(
                    'h-8 w-8',
                    kpi.status === 'success' && 'text-green-600',
                    kpi.status === 'warning' && 'text-yellow-600',
                    kpi.status === 'danger' && 'text-red-600'
                  )} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm mb-2">
                  {kpi.trend === 'up' ? (
                    <IconTrendingUp className="h-4 w-4 text-green-600" />
                  ) : (
                    <IconTrendingDown className="h-4 w-4 text-red-600" />
                  )}
                  <span className={cn(
                    'font-medium',
                    kpi.trend === 'up' ? 'text-green-600' : 'text-red-600'
                  )}>
                    {kpi.change}
                  </span>
                  <span className="text-muted-foreground">vs last period</span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Progress to Target</span>
                    <span>{progress.toFixed(0)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
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
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#revenueGradient)"
                  name="Revenue"
                />
                <Area
                  type="monotone"
                  dataKey="target"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  fill="none"
                  name="Target"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Market Share */}
        <Card>
          <CardHeader>
            <CardTitle>Market Position</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={marketShare}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {marketShare.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '0.5rem'
                    }}
                    formatter={(value: any) => `${value}%`}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              {marketShare.map((item, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-medium">{item.name}</span>
                  <span className="text-muted-foreground">{item.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Department Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Department Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={departmentData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" domain={[0, 100]} className="text-xs" />
              <YAxis dataKey="name" type="category" className="text-xs" width={100} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '0.5rem'
                }}
                formatter={(value: any) => `${value}%`}
              />
              <Bar dataKey="performance" fill="#3b82f6" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Alerts and Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Alerts & Action Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {alerts.map((alert, index) => (
              <div
                key={index}
                className={cn(
                  'flex items-center justify-between p-4 rounded-lg border-l-4',
                  alert.severity === 'warning' && 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-600',
                  alert.severity === 'info' && 'bg-blue-50 dark:bg-blue-950/20 border-blue-600',
                  alert.severity === 'danger' && 'bg-red-50 dark:bg-red-950/20 border-red-600'
                )}
              >
                <div className="flex items-center gap-3">
                  {alert.severity === 'warning' && <IconAlertTriangle className="h-5 w-5 text-yellow-600" />}
                  {alert.severity === 'info' && <IconCircleCheck className="h-5 w-5 text-blue-600" />}
                  {alert.severity === 'danger' && <IconCircleX className="h-5 w-5 text-red-600" />}
                  <span className="font-medium">{alert.message}</span>
                </div>
                <Button variant="outline" size="sm">
                  {alert.action}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
