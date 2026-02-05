/**
 * Notification Analytics Dashboard
 *
 * This page provides comprehensive analytics for the notification system including:
 * - Overview statistics (total sent, delivery rate, seen rate, failures)
 * - Delivery distribution by channel (EMAIL, PUSH, WHATSAPP, SMS)
 * - Time-series charts for notifications over time
 * - Top failure reasons analysis
 * - User engagement metrics
 * - Recent notifications table with detail modal
 *
 * API Integration Guide:
 * =====================
 *
 * The following mock functions need to be replaced with actual API calls:
 *
 * 1. fetchNotificationStats(filters) -> GET /admin/notifications/stats
 *    Query params: dateFrom, dateTo, type, channel, status
 *    Response: NotificationStats interface
 *
 * 2. fetchNotifications(filters, page, pageSize) -> GET /admin/notifications
 *    Query params: dateFrom, dateTo, type, channel, status, page, pageSize
 *    Response: { data: NotificationListItem[], total: number }
 *
 * 3. fetchNotificationDetail(id) -> GET /admin/notifications/:id
 *    Response: NotificationDetail interface
 *
 * 4. resendNotification(id) -> POST /admin/notifications/resend/:id
 *    Response: void
 *
 * To integrate with the backend:
 * 1. Import the API client functions from your api-client package
 * 2. Replace the mock functions with actual API calls
 * 3. Update the interfaces to match your backend response types
 * 4. Add proper error handling and loading states
 */

import { PageHeader } from "@/components/ui/page-header";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { FAVORITE_PAGES } from "../../../constants";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  IconBell,
  IconMail,
  IconDeviceMobile,
  IconBrandWhatsapp,
  IconSend,
  IconCheck,
  IconX,
  IconEye,
  IconRefresh,
  IconChartPie,
  IconChartBar,
  IconTrendingUp,
  IconClock,
  IconAlertCircle,
  IconUsers,
} from "@tabler/icons-react";
import ReactECharts from "echarts-for-react";
import { type DateRange } from "react-day-picker";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// Types
interface NotificationStats {
  totalSent: number;
  averageDeliveryRate: number;
  averageSeenRate: number;
  failedDeliveries: number;
  byChannel: {
    EMAIL: { sent: number; delivered: number; failed: number; seen: number };
    PUSH: { sent: number; delivered: number; failed: number; seen: number };
    WHATSAPP: { sent: number; delivered: number; failed: number; seen: number };
    SMS: { sent: number; delivered: number; failed: number; seen: number };
  };
  overTime: Array<{ date: string; sent: number; delivered: number; failed: number }>;
  topFailureReasons: Array<{ reason: string; count: number }>;
}

interface NotificationListItem {
  id: string;
  type: string;
  title: string;
  sentAt: string;
  channels: string[];
  delivered: number;
  total: number;
  seen: number;
  status: "SENT" | "FAILED" | "PENDING";
}

interface NotificationDetail {
  id: string;
  type: string;
  title: string;
  body: string;
  sentAt: string;
  channels: Array<{
    channel: string;
    status: "DELIVERED" | "FAILED" | "PENDING";
    deliveredAt?: string;
    error?: string;
  }>;
  recipients: Array<{
    id: string;
    name: string;
    email?: string;
    phone?: string;
    status: "DELIVERED" | "FAILED" | "SEEN";
    deliveredAt?: string;
    seenAt?: string;
    channel: string;
  }>;
  timeline: Array<{
    timestamp: string;
    event: string;
    description: string;
  }>;
}

// Mock API functions - Replace with actual API calls
const fetchNotificationStats = async (filters: {
  dateRange?: DateRange;
  type?: string;
  channel?: string;
  status?: string;
}): Promise<NotificationStats> => {
  // Mock data - replace with actual API call
  return {
    totalSent: 12847,
    averageDeliveryRate: 94.2,
    averageSeenRate: 67.8,
    failedDeliveries: 745,
    byChannel: {
      EMAIL: { sent: 5200, delivered: 4950, failed: 250, seen: 3564 },
      PUSH: { sent: 4500, delivered: 4350, failed: 150, seen: 3045 },
      WHATSAPP: { sent: 2147, delivered: 2047, failed: 100, seen: 1638 },
      SMS: { sent: 1000, delivered: 900, failed: 100, seen: 630 },
    },
    overTime: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      sent: Math.floor(300 + Math.random() * 200),
      delivered: Math.floor(280 + Math.random() * 180),
      failed: Math.floor(10 + Math.random() * 30),
    })),
    topFailureReasons: [
      { reason: "Invalid email address", count: 245 },
      { reason: "User not found", count: 180 },
      { reason: "Delivery timeout", count: 125 },
      { reason: "Rate limit exceeded", count: 95 },
      { reason: "Spam filter", count: 100 },
    ],
  };
};

const fetchNotifications = async (
  filters: {
    dateRange?: DateRange;
    type?: string;
    channel?: string;
    status?: string;
  },
  page: number,
  pageSize: number
): Promise<{ data: NotificationListItem[]; total: number }> => {
  // Mock data - replace with actual API call
  const mockData: NotificationListItem[] = Array.from({ length: 50 }, (_, i) => ({
    id: `notif-${i + 1}`,
    type: ["TASK", "ORDER", "SYSTEM", "MARKETING"][Math.floor(Math.random() * 4)],
    title: `Notification ${i + 1}`,
    sentAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    channels: ["EMAIL", "PUSH", "WHATSAPP"].slice(0, Math.floor(Math.random() * 3) + 1),
    delivered: Math.floor(80 + Math.random() * 20),
    total: 100,
    seen: Math.floor(50 + Math.random() * 30),
    status: Math.random() > 0.1 ? "SENT" : "FAILED",
  }));

  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  return {
    data: mockData.slice(start, end),
    total: mockData.length,
  };
};

const fetchNotificationDetail = async (id: string): Promise<NotificationDetail> => {
  // Mock data - replace with actual API call
  return {
    id,
    type: "PRODUCTION",
    title: "New Task Assigned",
    body: "You have been assigned a new task: Complete project documentation",
    sentAt: new Date().toISOString(),
    channels: [
      { channel: "EMAIL", status: "DELIVERED", deliveredAt: new Date().toISOString() },
      { channel: "PUSH", status: "DELIVERED", deliveredAt: new Date().toISOString() },
      { channel: "WHATSAPP", status: "FAILED", error: "User not subscribed" },
    ],
    recipients: Array.from({ length: 10 }, (_, i) => ({
      id: `user-${i + 1}`,
      name: `User ${i + 1}`,
      email: `user${i + 1}@example.com`,
      phone: `+1234567890${i}`,
      status: ["DELIVERED", "SEEN", "FAILED"][Math.floor(Math.random() * 3)] as any,
      deliveredAt: Math.random() > 0.2 ? new Date().toISOString() : undefined,
      seenAt: Math.random() > 0.5 ? new Date().toISOString() : undefined,
      channel: ["EMAIL", "PUSH", "WHATSAPP"][Math.floor(Math.random() * 3)],
    })),
    timeline: [
      {
        timestamp: new Date(Date.now() - 5000).toISOString(),
        event: "CREATED",
        description: "Notification created",
      },
      {
        timestamp: new Date(Date.now() - 4000).toISOString(),
        event: "SENT",
        description: "Notification sent to delivery service",
      },
      {
        timestamp: new Date(Date.now() - 3000).toISOString(),
        event: "DELIVERED",
        description: "Notification delivered to 90% of recipients",
      },
    ],
  };
};

const resendNotification = async (id: string): Promise<void> => {
  // Mock implementation - replace with actual API call
  await new Promise((resolve) => setTimeout(resolve, 1000));
};

export const NotificationAnalyticsPage = () => {
  const queryClient = useQueryClient();

  // Filter states
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [type, setType] = useState<string>("ALL");
  const [channel, setChannel] = useState<string>("ALL");
  const [status, setStatus] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [selectedNotification, setSelectedNotification] = useState<string | null>(null);

  // Queries
  const filters = { dateRange, type, channel, status };

  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = useQuery({
    queryKey: ["notification-stats", filters],
    queryFn: () => fetchNotificationStats(filters),
    staleTime: 60000, // 1 minute
  });

  const {
    data: notifications,
    isLoading: notificationsLoading,
    error: notificationsError,
  } = useQuery({
    queryKey: ["notifications", filters, page, pageSize],
    queryFn: () => fetchNotifications(filters, page, pageSize),
    staleTime: 30000, // 30 seconds
  });

  const {
    data: notificationDetail,
    isLoading: detailLoading,
  } = useQuery({
    queryKey: ["notification-detail", selectedNotification],
    queryFn: () => fetchNotificationDetail(selectedNotification!),
    enabled: !!selectedNotification,
  });

  // Mutations
  const resendMutation = useMutation({
    mutationFn: resendNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notification-stats"] });
    },
  });

  // Chart configurations
  const deliveryByChannelOption = useMemo(() => {
    if (!stats) return {};

    const data = Object.entries(stats.byChannel).map(([channel, data]) => ({
      name: channel,
      value: data.sent,
    }));

    return {
      tooltip: {
        trigger: "item",
        formatter: "{b}: {c} ({d}%)",
      },
      legend: {
        orient: "vertical",
        left: "left",
      },
      series: [
        {
          name: "Notifications by Channel",
          type: "pie",
          radius: ["40%", "70%"],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: "#fff",
            borderWidth: 2,
          },
          label: {
            show: true,
            formatter: "{b}: {d}%",
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 16,
              fontWeight: "bold",
            },
          },
          data,
        },
      ],
    };
  }, [stats]);

  const notificationsOverTimeOption = useMemo(() => {
    if (!stats) return {};

    return {
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "cross",
        },
      },
      legend: {
        data: ["Sent", "Delivered", "Failed"],
      },
      xAxis: {
        type: "category",
        data: stats.overTime.map((d) => format(new Date(d.date), "dd/MM")),
      },
      yAxis: {
        type: "value",
      },
      series: [
        {
          name: "Sent",
          type: "line",
          data: stats.overTime.map((d) => d.sent),
          smooth: true,
          itemStyle: { color: "#3b82f6" },
        },
        {
          name: "Delivered",
          type: "line",
          data: stats.overTime.map((d) => d.delivered),
          smooth: true,
          itemStyle: { color: "#10b981" },
        },
        {
          name: "Failed",
          type: "line",
          data: stats.overTime.map((d) => d.failed),
          smooth: true,
          itemStyle: { color: "#ef4444" },
        },
      ],
    };
  }, [stats]);

  const deliverySuccessRateOption = useMemo(() => {
    if (!stats) return {};

    const channels = Object.keys(stats.byChannel);
    const delivered = channels.map((ch) => stats.byChannel[ch as keyof typeof stats.byChannel].delivered);
    const failed = channels.map((ch) => stats.byChannel[ch as keyof typeof stats.byChannel].failed);

    return {
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "shadow",
        },
      },
      legend: {
        data: ["Delivered", "Failed"],
      },
      xAxis: {
        type: "category",
        data: channels,
      },
      yAxis: {
        type: "value",
      },
      series: [
        {
          name: "Delivered",
          type: "bar",
          stack: "total",
          data: delivered,
          itemStyle: { color: "#10b981" },
        },
        {
          name: "Failed",
          type: "bar",
          stack: "total",
          data: failed,
          itemStyle: { color: "#ef4444" },
        },
      ],
    };
  }, [stats]);

  const topFailureReasonsOption = useMemo(() => {
    if (!stats) return {};

    return {
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "shadow",
        },
      },
      xAxis: {
        type: "value",
      },
      yAxis: {
        type: "category",
        data: stats.topFailureReasons.map((r) => r.reason),
      },
      series: [
        {
          name: "Count",
          type: "bar",
          data: stats.topFailureReasons.map((r) => r.count),
          itemStyle: { color: "#f59e0b" },
        },
      ],
    };
  }, [stats]);

  const userEngagementOption = useMemo(() => {
    if (!stats) return {};

    const totalDelivered = Object.values(stats.byChannel).reduce((acc, ch) => acc + ch.delivered, 0);
    const totalSeen = Object.values(stats.byChannel).reduce((acc, ch) => acc + ch.seen, 0);
    const unseen = totalDelivered - totalSeen;

    return {
      tooltip: {
        trigger: "item",
        formatter: "{b}: {c} ({d}%)",
      },
      legend: {
        orient: "horizontal",
        bottom: "bottom",
      },
      series: [
        {
          name: "User Engagement",
          type: "pie",
          radius: "50%",
          data: [
            { value: totalSeen, name: "Seen" },
            { value: unseen, name: "Unseen" },
          ],
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: "rgba(0, 0, 0, 0.5)",
            },
          },
        },
      ],
    };
  }, [stats]);

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "EMAIL":
        return <IconMail className="h-4 w-4" />;
      case "PUSH":
        return <IconDeviceMobile className="h-4 w-4" />;
      case "WHATSAPP":
        return <IconBrandWhatsapp className="h-4 w-4" />;
      case "SMS":
        return <IconDeviceMobile className="h-4 w-4" />;
      default:
        return <IconBell className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SENT":
      case "DELIVERED":
        return <Badge variant="completed">{status}</Badge>;
      case "FAILED":
        return <Badge variant="failed">{status}</Badge>;
      case "PENDING":
        return <Badge variant="pending">{status}</Badge>;
      case "SEEN":
        return <Badge variant="active">{status}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <PrivilegeRoute>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Notification Analytics"
          favoritePage={FAVORITE_PAGES.ADMINISTRACAO_NOTIFICACOES_LISTAR}
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Administração", href: "/administracao" },
            { label: "Notificações", href: "/administracao/notificacoes" },
            { label: "Analytics" },
          ]}
          className="flex-shrink-0"
        />

        <div className="flex-1 min-h-0 pb-6 flex flex-col gap-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Date Range</label>
                  <DateRangePicker
                    dateRange={dateRange}
                    onDateRangeChange={setDateRange}
                    placeholder="Select date range"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Type</label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Types</SelectItem>
                      <SelectItem value="TASK">Tasks</SelectItem>
                      <SelectItem value="ORDER">Orders</SelectItem>
                      <SelectItem value="SYSTEM">System</SelectItem>
                      <SelectItem value="MARKETING">Marketing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Channel</label>
                  <Select value={channel} onValueChange={setChannel}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Channels" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Channels</SelectItem>
                      <SelectItem value="EMAIL">Email</SelectItem>
                      <SelectItem value="PUSH">Push</SelectItem>
                      <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                      <SelectItem value="SMS">SMS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Status</label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Status</SelectItem>
                      <SelectItem value="SENT">Sent</SelectItem>
                      <SelectItem value="FAILED">Failed</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Statistics Cards */}
          {statsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <Skeleton className="h-24 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : statsError ? (
            <Alert variant="destructive">
              <IconAlertCircle className="h-4 w-4" />
              <AlertDescription>Failed to load statistics. Please try again.</AlertDescription>
            </Alert>
          ) : stats ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <IconSend className="h-4 w-4 text-blue-500" />
                    Total Sent
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalSent.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground mt-1">This month</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <IconCheck className="h-4 w-4 text-green-500" />
                    Delivery Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.averageDeliveryRate.toFixed(1)}%</div>
                  <p className="text-xs text-muted-foreground mt-1">Average delivery rate</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <IconEye className="h-4 w-4 text-purple-500" />
                    Seen Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.averageSeenRate.toFixed(1)}%</div>
                  <p className="text-xs text-muted-foreground mt-1">Average seen rate</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <IconX className="h-4 w-4 text-red-500" />
                    Failed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.failedDeliveries.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground mt-1">Failed deliveries</p>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {/* Charts */}
          {statsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <Skeleton className="h-64 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : stats ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <IconChartPie className="h-5 w-5" />
                      Delivery by Channel
                    </CardTitle>
                    <CardDescription>Distribution of notifications across channels</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ReactECharts option={deliveryByChannelOption} style={{ height: "300px" }} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <IconChartBar className="h-5 w-5" />
                      Delivery Success Rate
                    </CardTitle>
                    <CardDescription>Success vs failure by channel</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ReactECharts option={deliverySuccessRateOption} style={{ height: "300px" }} />
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconTrendingUp className="h-5 w-5" />
                    Notifications Over Time
                  </CardTitle>
                  <CardDescription>Last 30 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <ReactECharts option={notificationsOverTimeOption} style={{ height: "300px" }} />
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <IconAlertCircle className="h-5 w-5" />
                      Top Failure Reasons
                    </CardTitle>
                    <CardDescription>Most common delivery failures</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ReactECharts option={topFailureReasonsOption} style={{ height: "300px" }} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <IconUsers className="h-5 w-5" />
                      User Engagement
                    </CardTitle>
                    <CardDescription>Seen vs unseen notifications</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ReactECharts option={userEngagementOption} style={{ height: "300px" }} />
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}

          {/* Recent Notifications Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconClock className="h-5 w-5" />
                Recent Notifications
              </CardTitle>
              <CardDescription>Click a row to see delivery details</CardDescription>
            </CardHeader>
            <CardContent>
              {notificationsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : notificationsError ? (
                <Alert variant="destructive">
                  <IconAlertCircle className="h-4 w-4" />
                  <AlertDescription>Failed to load notifications. Please try again.</AlertDescription>
                </Alert>
              ) : notifications && notifications.data.length > 0 ? (
                <>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Sent At</TableHead>
                          <TableHead>Channels</TableHead>
                          <TableHead>Delivered</TableHead>
                          <TableHead>Seen</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {notifications.data.map((notification) => (
                          <TableRow
                            key={notification.id}
                            className="cursor-pointer"
                            onClick={() => setSelectedNotification(notification.id)}
                          >
                            <TableCell>
                              <Badge variant="secondary">{notification.type}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">{notification.title}</TableCell>
                            <TableCell>
                              {format(new Date(notification.sentAt), "dd/MM/yyyy HH:mm")}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {notification.channels.map((ch) => (
                                  <div key={ch} className="flex items-center gap-1">
                                    {getChannelIcon(ch)}
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              {notification.delivered}/{notification.total} (
                              {((notification.delivered / notification.total) * 100).toFixed(0)}%)
                            </TableCell>
                            <TableCell>
                              {notification.seen} (
                              {((notification.seen / notification.delivered) * 100).toFixed(0)}%)
                            </TableCell>
                            <TableCell>{getStatusBadge(notification.status)}</TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  resendMutation.mutate(notification.id);
                                }}
                                disabled={resendMutation.isPending}
                              >
                                <IconRefresh className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {(page - 1) * pageSize + 1} to{" "}
                      {Math.min(page * pageSize, notifications.total)} of {notifications.total}{" "}
                      results
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        Previous
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPage((p) => p + 1)}
                        disabled={page * pageSize >= notifications.total}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No notifications found
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Notification Detail Modal */}
      <Dialog open={!!selectedNotification} onOpenChange={() => setSelectedNotification(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Notification Details</DialogTitle>
            <DialogDescription>
              View detailed delivery information and recipient status
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : notificationDetail ? (
            <div className="space-y-6">
              {/* Notification Info */}
              <div>
                <h3 className="font-semibold mb-2">Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Type:</span>{" "}
                    <Badge variant="secondary">{notificationDetail.type}</Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Sent At:</span>{" "}
                    {format(new Date(notificationDetail.sentAt), "dd/MM/yyyy HH:mm:ss")}
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Title:</span>{" "}
                    <span className="font-medium">{notificationDetail.title}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Body:</span>{" "}
                    {notificationDetail.body}
                  </div>
                </div>
              </div>

              {/* Channel Status */}
              <div>
                <h3 className="font-semibold mb-2">Delivery Status by Channel</h3>
                <div className="space-y-2">
                  {notificationDetail.channels.map((channel, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-2">
                        {getChannelIcon(channel.channel)}
                        <span className="font-medium">{channel.channel}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        {channel.deliveredAt && (
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(channel.deliveredAt), "HH:mm:ss")}
                          </span>
                        )}
                        {channel.error && (
                          <span className="text-sm text-red-500">{channel.error}</span>
                        )}
                        {getStatusBadge(channel.status)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recipients */}
              <div>
                <h3 className="font-semibold mb-2">
                  Recipients ({notificationDetail.recipients.length})
                </h3>
                <div className="rounded-md border max-h-64 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Channel</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Delivered At</TableHead>
                        <TableHead>Seen At</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {notificationDetail.recipients.map((recipient) => (
                        <TableRow key={recipient.id}>
                          <TableCell className="font-medium">{recipient.name}</TableCell>
                          <TableCell className="text-sm">
                            {recipient.email || recipient.phone}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {getChannelIcon(recipient.channel)}
                              <span className="text-sm">{recipient.channel}</span>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(recipient.status)}</TableCell>
                          <TableCell className="text-sm">
                            {recipient.deliveredAt
                              ? format(new Date(recipient.deliveredAt), "HH:mm:ss")
                              : "-"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {recipient.seenAt
                              ? format(new Date(recipient.seenAt), "HH:mm:ss")
                              : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Timeline */}
              <div>
                <h3 className="font-semibold mb-2">Timeline</h3>
                <div className="space-y-2">
                  {notificationDetail.timeline.map((event, idx) => (
                    <div key={idx} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                        {idx < notificationDetail.timeline.length - 1 && (
                          <div className="w-0.5 h-full bg-border mt-1" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{event.event}</span>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(event.timestamp), "HH:mm:ss")}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{event.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </PrivilegeRoute>
  );
};
