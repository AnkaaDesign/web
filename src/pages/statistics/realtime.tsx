/**
 * Real-Time Monitoring Page
 *
 * Live metrics, activity feed, and alerts dashboard
 * with real-time updates and system events.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IconRefresh, IconAlertCircle, IconInfoCircle, IconCircleCheck, IconClock, IconUsers, IconPackage, IconActivity } from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface Activity {
  id: string;
  type: 'task' | 'order' | 'inventory' | 'user';
  message: string;
  timestamp: Date;
  user?: string;
}

interface Alert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
}

export default function RealTimeMonitoringPage() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Simulate real-time updates
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      setLastUpdate(new Date());
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Live metrics
  const liveMetrics = {
    activeTasks: 45,
    completedToday: 28,
    activeUsers: 32,
    systemLoad: 67,
    responseTime: 145,
    errorRate: 0.3
  };

  // Recent activities
  const [activities, setActivities] = useState<Activity[]>([
    { id: '1', type: 'task', message: 'Task #1234 completed by João Silva', timestamp: new Date(Date.now() - 2 * 60 * 1000), user: 'João Silva' },
    { id: '2', type: 'order', message: 'New order #5678 received', timestamp: new Date(Date.now() - 5 * 60 * 1000) },
    { id: '3', type: 'inventory', message: 'Low stock alert for Product A', timestamp: new Date(Date.now() - 8 * 60 * 1000) },
    { id: '4', type: 'user', message: 'Maria Santos logged in', timestamp: new Date(Date.now() - 12 * 60 * 1000), user: 'Maria Santos' },
    { id: '5', type: 'task', message: 'Task #1235 started by Pedro Costa', timestamp: new Date(Date.now() - 15 * 60 * 1000), user: 'Pedro Costa' }
  ]);

  // Alerts
  const [alerts, setAlerts] = useState<Alert[]>([
    { id: '1', severity: 'critical', message: 'Server disk space above 90%', timestamp: new Date(Date.now() - 10 * 60 * 1000), acknowledged: false },
    { id: '2', severity: 'warning', message: 'High response time detected', timestamp: new Date(Date.now() - 20 * 60 * 1000), acknowledged: false },
    { id: '3', severity: 'warning', message: '5 items below reorder point', timestamp: new Date(Date.now() - 30 * 60 * 1000), acknowledged: true },
    { id: '4', severity: 'info', message: 'Backup completed successfully', timestamp: new Date(Date.now() - 45 * 60 * 1000), acknowledged: true }
  ]);

  const acknowledgeAlert = (id: string) => {
    setAlerts(alerts.map(alert =>
      alert.id === id ? { ...alert, acknowledged: true } : alert
    ));
  };

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'task': return IconActivity;
      case 'order': return IconPackage;
      case 'inventory': return IconPackage;
      case 'user': return IconUsers;
    }
  };

  const getAlertIcon = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical': return IconAlertCircle;
      case 'warning': return IconAlertCircle;
      case 'info': return IconInfoCircle;
    }
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes === 1) return '1 minute ago';
    if (minutes < 60) return `${minutes} minutes ago`;

    const hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 hour ago';
    if (hours < 24) return `${hours} hours ago`;

    return date.toLocaleDateString();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Real-Time Monitoring</h1>
          <p className="text-muted-foreground mt-1">
            Live system metrics and activity monitoring
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <IconClock className="h-4 w-4" />
            <span>Last update: {lastUpdate.toLocaleTimeString()}</span>
          </div>
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <IconRefresh className={cn('h-4 w-4 mr-2', autoRefresh && 'animate-spin')} />
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </Button>
        </div>
      </div>

      {/* Live Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-bold">{liveMetrics.activeTasks}</div>
              <Badge variant="secondary">Live</Badge>
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {liveMetrics.completedToday} completed today
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-bold">{liveMetrics.activeUsers}</div>
              <Badge variant="secondary">Live</Badge>
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              Currently online
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">System Load</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <div className={cn(
                  'text-3xl font-bold',
                  liveMetrics.systemLoad > 80 ? 'text-red-600' : liveMetrics.systemLoad > 60 ? 'text-yellow-600' : 'text-green-600'
                )}>
                  {liveMetrics.systemLoad}%
                </div>
                <Badge variant="secondary">Live</Badge>
              </div>
              <Progress value={liveMetrics.systemLoad} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Response Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-bold">{liveMetrics.responseTime}</div>
              <span className="text-muted-foreground">ms</span>
              <Badge variant="secondary">Live</Badge>
            </div>
            <div className={cn(
              'text-sm mt-1',
              liveMetrics.responseTime < 200 ? 'text-green-600' : liveMetrics.responseTime < 500 ? 'text-yellow-600' : 'text-red-600'
            )}>
              {liveMetrics.responseTime < 200 ? 'Excellent' : liveMetrics.responseTime < 500 ? 'Good' : 'Slow'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Error Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className={cn(
                'text-3xl font-bold',
                liveMetrics.errorRate < 1 ? 'text-green-600' : liveMetrics.errorRate < 5 ? 'text-yellow-600' : 'text-red-600'
              )}>
                {liveMetrics.errorRate}%
              </div>
              <Badge variant="secondary">Live</Badge>
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              Last hour
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-600 animate-pulse"></div>
              <div className="text-2xl font-bold text-green-600">All Systems Operational</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Activities and Alerts */}
      <Tabs defaultValue="activities" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="activities">
            Activity Feed
            {activities.length > 0 && (
              <Badge variant="secondary" className="ml-2">{activities.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="alerts">
            Alerts
            {alerts.filter(a => !a.acknowledged).length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {alerts.filter(a => !a.acknowledged).length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Activity Feed Tab */}
        <TabsContent value="activities">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activities</CardTitle>
              <CardDescription>Real-time system and user activities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activities.map((activity) => {
                  const Icon = getActivityIcon(activity.type);
                  return (
                    <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex-shrink-0 mt-1">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{activity.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatTimestamp(activity.timestamp)}
                        </p>
                      </div>
                      <Badge variant="outline" className="flex-shrink-0 capitalize">
                        {activity.type}
                      </Badge>
                    </div>
                  );
                })}
              </div>
              <Button variant="outline" className="w-full mt-4">
                Load More Activities
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Critical</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {alerts.filter(a => a.severity === 'critical' && !a.acknowledged).length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Warnings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">
                  {alerts.filter(a => a.severity === 'warning' && !a.acknowledged).length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Info</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {alerts.filter(a => a.severity === 'info' && !a.acknowledged).length}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Active Alerts</CardTitle>
              <CardDescription>System alerts and notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alerts.map((alert) => {
                  const Icon = getAlertIcon(alert.severity);
                  return (
                    <div
                      key={alert.id}
                      className={cn(
                        'flex items-start gap-3 p-4 rounded-lg border-l-4 transition-opacity',
                        alert.severity === 'critical' && 'bg-red-50 dark:bg-red-950/20 border-red-600',
                        alert.severity === 'warning' && 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-600',
                        alert.severity === 'info' && 'bg-blue-50 dark:bg-blue-950/20 border-blue-600',
                        alert.acknowledged && 'opacity-50'
                      )}
                    >
                      <Icon className={cn(
                        'h-5 w-5 flex-shrink-0 mt-0.5',
                        alert.severity === 'critical' && 'text-red-600',
                        alert.severity === 'warning' && 'text-yellow-600',
                        alert.severity === 'info' && 'text-blue-600'
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{alert.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatTimestamp(alert.timestamp)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant="outline" className="capitalize">
                          {alert.severity}
                        </Badge>
                        {!alert.acknowledged && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => acknowledgeAlert(alert.id)}
                          >
                            <IconCircleCheck className="h-4 w-4 mr-1" />
                            Acknowledge
                          </Button>
                        )}
                        {alert.acknowledged && (
                          <Badge variant="secondary">Acknowledged</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
