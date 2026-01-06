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
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { routes } from "@/constants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Combobox } from "@/components/ui/combobox";
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
  IconQrcode,
  IconPlugConnected,
  IconPlugOff,
  IconPlus,
} from "@tabler/icons-react";
import ReactECharts from "echarts-for-react";
import { type DateRange } from "react-day-picker";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { whatsAppService, type WhatsAppStatus } from "@/api-client/services/notification.service";
import { notificationAdminService } from "@/services/notification.service";
import { useCurrentUser } from "@/hooks/useAuth";

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
    IN_APP: { sent: number; delivered: number; failed: number; seen: number };
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

// Fetch notification statistics from API
const fetchNotificationStats = async (filters: {
  dateRange?: DateRange;
  type?: string;
  channel?: string;
  status?: string;
}): Promise<NotificationStats> => {
  const [analyticsResponse, deliveryResponse] = await Promise.all([
    notificationAdminService.getAnalyticsOverview({
      dateFrom: filters.dateRange?.from?.toISOString(),
      dateTo: filters.dateRange?.to?.toISOString(),
    }),
    notificationAdminService.getDeliveryReport({
      dateFrom: filters.dateRange?.from?.toISOString(),
      dateTo: filters.dateRange?.to?.toISOString(),
      groupBy: 'day',
    }),
  ]);

  const analytics = analyticsResponse.data;
  const delivery = deliveryResponse.data;

  // Transform API data to match the expected format
  return {
    totalSent: analytics.total,
    averageDeliveryRate: analytics.deliveryRate,
    averageSeenRate: analytics.seenRate,
    failedDeliveries: analytics.failed,
    byChannel: {
      EMAIL: delivery.channelPerformance.find(c => c.channel === 'EMAIL')
        ? {
            sent: delivery.channelPerformance.find(c => c.channel === 'EMAIL')!.sent,
            delivered: delivery.channelPerformance.find(c => c.channel === 'EMAIL')!.delivered,
            failed: delivery.channelPerformance.find(c => c.channel === 'EMAIL')!.failed,
            seen: Math.floor(delivery.channelPerformance.find(c => c.channel === 'EMAIL')!.delivered * (analytics.seenRate / 100))
          }
        : { sent: 0, delivered: 0, failed: 0, seen: 0 },
      PUSH: delivery.channelPerformance.find(c => c.channel === 'PUSH')
        ? {
            sent: delivery.channelPerformance.find(c => c.channel === 'PUSH')!.sent,
            delivered: delivery.channelPerformance.find(c => c.channel === 'PUSH')!.delivered,
            failed: delivery.channelPerformance.find(c => c.channel === 'PUSH')!.failed,
            seen: Math.floor(delivery.channelPerformance.find(c => c.channel === 'PUSH')!.delivered * (analytics.seenRate / 100))
          }
        : { sent: 0, delivered: 0, failed: 0, seen: 0 },
      WHATSAPP: delivery.channelPerformance.find(c => c.channel === 'WHATSAPP')
        ? {
            sent: delivery.channelPerformance.find(c => c.channel === 'WHATSAPP')!.sent,
            delivered: delivery.channelPerformance.find(c => c.channel === 'WHATSAPP')!.delivered,
            failed: delivery.channelPerformance.find(c => c.channel === 'WHATSAPP')!.failed,
            seen: Math.floor(delivery.channelPerformance.find(c => c.channel === 'WHATSAPP')!.delivered * (analytics.seenRate / 100))
          }
        : { sent: 0, delivered: 0, failed: 0, seen: 0 },
      IN_APP: delivery.channelPerformance.find(c => c.channel === 'IN_APP')
        ? {
            sent: delivery.channelPerformance.find(c => c.channel === 'IN_APP')!.sent,
            delivered: delivery.channelPerformance.find(c => c.channel === 'IN_APP')!.delivered,
            failed: delivery.channelPerformance.find(c => c.channel === 'IN_APP')!.failed,
            seen: Math.floor(delivery.channelPerformance.find(c => c.channel === 'IN_APP')!.delivered * (analytics.seenRate / 100))
          }
        : { sent: 0, delivered: 0, failed: 0, seen: 0 },
    },
    overTime: delivery.timeSeries.map(point => ({
      date: point.date,
      sent: point.sent,
      delivered: point.delivered,
      failed: point.failed,
    })),
    topFailureReasons: delivery.topFailureReasons.map(reason => ({
      reason: reason.reason,
      count: reason.count,
    })),
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
  const response = await notificationAdminService.getNotifications({
    type: filters.type !== 'ALL' ? filters.type : undefined,
    channel: filters.channel !== 'ALL' ? filters.channel : undefined,
    status: filters.status !== 'ALL' ? filters.status as any : undefined,
    dateFrom: filters.dateRange?.from?.toISOString(),
    dateTo: filters.dateRange?.to?.toISOString(),
    page,
    limit: pageSize,
  });

  return {
    data: response.data.map(item => ({
      id: item.id,
      type: item.type,
      title: item.title,
      sentAt: item.sentAt || item.createdAt,
      channels: item.channel,
      delivered: item.deliveries.filter(d => d.status === 'DELIVERED').length,
      total: item.deliveries.length,
      seen: item.seenBy.length,
      status: item.sentAt ? 'SENT' : 'PENDING',
    })),
    total: response.meta.total,
  };
};

const fetchNotificationDetail = async (id: string): Promise<NotificationDetail> => {
  const response = await notificationAdminService.getNotificationById(id);
  const notification = response.data;

  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    sentAt: notification.sentAt,
    channels: notification.deliveries.map(d => ({
      channel: d.channel,
      status: d.status,
      deliveredAt: d.deliveredAt,
      error: d.errorMessage,
    })),
    recipients: notification.seenBy.map(s => ({
      id: s.userId,
      name: s.user.name,
      email: s.user.email,
      phone: null,
      status: 'SEEN' as any,
      deliveredAt: s.seenAt,
      seenAt: s.seenAt,
      channel: 'IN_APP',
    })),
    timeline: [
      {
        timestamp: notification.createdAt || notification.sentAt || new Date().toISOString(),
        event: "CREATED",
        description: "Notification created",
      },
      ...(notification.sentAt ? [{
        timestamp: notification.sentAt,
        event: "SENT" as const,
        description: "Notification sent to delivery service",
      }] : []),
      ...(notification.deliveries.some(d => d.status === 'DELIVERED') ? [{
        timestamp: notification.deliveries.find(d => d.deliveredAt)?.deliveredAt || new Date().toISOString(),
        event: "DELIVERED" as const,
        description: `Notification delivered to ${notification.metrics.delivery.deliveredCount} recipients`,
      }] : []),
    ],
  };
};

const resendNotification = async (id: string): Promise<void> => {
  await notificationAdminService.resendNotification(id);
};

// WhatsApp QR Code Component
const WhatsAppQRCard = () => {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();

  // Check if user is admin
  const isAdmin = currentUser?.sector?.privileges?.includes("ADMIN") ||
                  currentUser?.sector?.privileges?.includes("SUPER_ADMIN");

  console.log('[WhatsAppQR] isAdmin check:', {
    hasCurrentUser: !!currentUser,
    sectorPrivileges: currentUser?.sector?.privileges,
    isAdmin
  });

  // Queries
  const {
    data: statusData,
    isLoading: statusLoading,
    error: statusError,
  } = useQuery({
    queryKey: ["whatsapp-status"],
    queryFn: async () => {
      console.log('[WhatsAppQR] Fetching WhatsApp status...');
      const response = await whatsAppService.getWhatsAppStatus();
      console.log('[WhatsAppQR] Status response:', response.data);
      return response.data;
    },
    enabled: !!isAdmin,
    refetchInterval: (query) => {
      // Auto-refresh every 30 seconds if status is QR_READY
      const actualData = query?.state?.data;
      const shouldRefetch = actualData?.data?.status === "QR_READY";
      console.log('[WhatsAppQR] Query state data:', actualData, 'Status:', actualData?.data?.status, 'Should refetch:', shouldRefetch);
      return shouldRefetch ? 30000 : false;
    },
  });

  const {
    data: qrData,
    isLoading: qrLoading,
    refetch: refetchQR,
  } = useQuery({
    queryKey: ["whatsapp-qr"],
    queryFn: async () => {
      console.log('[WhatsAppQR] Fetching QR code...');
      const response = await whatsAppService.getWhatsAppQR();
      console.log('[WhatsAppQR] QR response:', response.data);
      return response.data;
    },
    enabled: statusData?.data?.status === "QR_READY", // Auto-fetch when QR is ready
  });

  // Mutations
  const regenerateMutation = useMutation({
    mutationFn: async () => {
      console.log('[WhatsAppQR] Regenerating QR code...');
      const result = await whatsAppService.regenerateQR();
      console.log('[WhatsAppQR] Regenerate result:', result);
      return result;
    },
    onSuccess: () => {
      console.log('[WhatsAppQR] Regenerate successful, invalidating queries...');
      queryClient.invalidateQueries({ queryKey: ["whatsapp-qr"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-status"] });
      refetchQR();
    },
  });

  const reconnectMutation = useMutation({
    mutationFn: async () => {
      console.log('[WhatsAppQR] Reconnecting WhatsApp client...');
      const result = await whatsAppService.reconnect();
      console.log('[WhatsAppQR] Reconnect result:', result);
      return result;
    },
    onSuccess: () => {
      console.log('[WhatsAppQR] Reconnect successful, invalidating queries...');
      queryClient.invalidateQueries({ queryKey: ["whatsapp-qr"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-status"] });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: whatsAppService.disconnect,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-status"] });
    },
  });

  // Auto-refresh QR code every 30 seconds when in qr_ready state
  useEffect(() => {
    if (statusData?.data?.status === "QR_READY") {
      const interval = setInterval(() => {
        refetchQR();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [statusData?.data?.status, refetchQR]);

  // Don't render if user is not admin
  if (!isAdmin) {
    return null;
  }

  const handleGenerateQR = () => {
    // Use reconnect to force client reinitialization
    reconnectMutation.mutate();
  };

  const handleRefreshQR = () => {
    // When QR already exists, just regenerate
    regenerateMutation.mutate();
  };

  const handleDisconnect = () => {
    disconnectMutation.mutate();
  };

  const getStatusBadge = (status: WhatsAppStatus) => {
    switch (status) {
      case "AUTHENTICATED":
      case "READY":
        return (
          <Badge variant="completed" className="flex items-center gap-1">
            <IconPlugConnected className="h-3 w-3" />
            Conectado
          </Badge>
        );
      case "QR_READY":
      case "CONNECTING":
        return (
          <Badge variant="pending" className="flex items-center gap-1">
            <IconQrcode className="h-3 w-3" />
            Aguardando QR
          </Badge>
        );
      case "AUTH_FAILURE":
        return (
          <Badge variant="failed" className="flex items-center gap-1">
            <IconAlertCircle className="h-3 w-3" />
            Falha na autenticação
          </Badge>
        );
      case "DISCONNECTED":
      default:
        return (
          <Badge variant="failed" className="flex items-center gap-1">
            <IconPlugOff className="h-3 w-3" />
            Desconectado
          </Badge>
        );
    }
  };

  return (
    <Card className="border-green-200 dark:border-green-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <IconBrandWhatsapp className="h-6 w-6 text-green-600" />
              WhatsApp Business
            </CardTitle>
            <CardDescription>
              Conecte sua conta WhatsApp para enviar notificações
            </CardDescription>
          </div>
          {statusData?.data?.status && getStatusBadge(statusData.data.status)}
        </div>
      </CardHeader>
      <CardContent>
        {statusLoading ? (
          <div className="flex justify-center py-8">
            <Skeleton className="h-64 w-64" />
          </div>
        ) : statusError ? (
          <Alert variant="destructive">
            <IconAlertCircle className="h-4 w-4" />
            <AlertDescription>
              Erro ao carregar status do WhatsApp. Tente novamente.
            </AlertDescription>
          </Alert>
        ) : statusData?.data?.status === "DISCONNECTED" || statusData?.data?.status === "AUTH_FAILURE" ? (
          // Not connected state
          <div className="flex flex-col items-center gap-4 py-8">
            <IconPlugOff className="h-16 w-16 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">
              WhatsApp não está conectado. Clique no botão abaixo para iniciar a conexão.
            </p>
            <Button onClick={handleGenerateQR} disabled={reconnectMutation.isPending}>
              {reconnectMutation.isPending ? (
                <>
                  <IconRefresh className="mr-2 h-4 w-4 animate-spin" />
                  Conectando...
                </>
              ) : (
                <>
                  <IconQrcode className="mr-2 h-4 w-4" />
                  Conectar WhatsApp
                </>
              )}
            </Button>
          </div>
        ) : statusData?.data?.status === "QR_READY" || statusData?.data?.status === "CONNECTING" ? (
          // QR ready state
          <div className="flex flex-col items-center gap-4 py-4">
            {(() => {
              console.log('[WhatsAppQR] Render state:', {
                qrLoading,
                hasQrData: !!qrData,
                qrDataStructure: qrData,
                hasDataProp: !!qrData?.data,
                hasQr: !!qrData?.data?.qr,
                qrLength: qrData?.data?.qr?.length,
                qrPreview: qrData?.data?.qr?.substring(0, 50)
              });
              return qrLoading || !qrData?.data?.qr ? (
                <Skeleton className="h-64 w-64" />
              ) : (
                <div className="p-4 bg-white rounded-lg border">
                  <img
                    src={qrData.data.qr.startsWith("data:") ? qrData.data.qr : `data:image/png;base64,${qrData.data.qr}`}
                    alt="WhatsApp QR Code"
                    className="h-64 w-64"
                  />
                </div>
              );
            })()}
            <p className="text-xs text-muted-foreground text-center">
              1. Abra o WhatsApp no seu telefone
              <br />
              2. Toque em Menu ou Configurações e selecione Dispositivos conectados
              <br />
              3. Toque em Conectar um dispositivo
              <br />
              4. Aponte seu telefone para esta tela para capturar o código QR
            </p>
            <Button onClick={handleRefreshQR} variant="outline" disabled={regenerateMutation.isPending}>
              {regenerateMutation.isPending ? (
                <>
                  <IconRefresh className="mr-2 h-4 w-4 animate-spin" />
                  Atualizando...
                </>
              ) : (
                <>
                  <IconRefresh className="mr-2 h-4 w-4" />
                  Atualizar QR Code
                </>
              )}
            </Button>
            {qrData?.data?.expiresAt && (
              <p className="text-xs text-muted-foreground">
                Expira em: {format(new Date(qrData.data.expiresAt), "dd/MM/yyyy HH:mm")}
              </p>
            )}
          </div>
        ) : statusData?.data?.status === "READY" || statusData?.data?.status === "AUTHENTICATED" ? (
          // Connected state
          <div className="flex flex-col items-center gap-4 py-8">
            <IconPlugConnected className="h-16 w-16 text-green-600" />
            <div className="text-center">
              <p className="font-medium text-green-600">WhatsApp conectado com sucesso!</p>
              <p className="text-sm text-muted-foreground mt-1">
                {statusData.data.message}
              </p>
            </div>
            <Button
              onClick={handleDisconnect}
              variant="destructive"
              disabled={disconnectMutation.isPending}
            >
              {disconnectMutation.isPending ? (
                <>
                  <IconRefresh className="mr-2 h-4 w-4 animate-spin" />
                  Desconectando...
                </>
              ) : (
                <>
                  <IconPlugOff className="mr-2 h-4 w-4" />
                  Desconectar
                </>
              )}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

export const NotificationListPage = () => {
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
          name: "Notificações por Canal",
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
        data: ["Enviado", "Entregue", "Falhou"],
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
          name: "Enviado",
          type: "line",
          data: stats.overTime.map((d) => d.sent),
          smooth: true,
          itemStyle: { color: "#3b82f6" },
        },
        {
          name: "Entregue",
          type: "line",
          data: stats.overTime.map((d) => d.delivered),
          smooth: true,
          itemStyle: { color: "#10b981" },
        },
        {
          name: "Falhou",
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
        data: ["Entregue", "Falhou"],
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
          name: "Entregue",
          type: "bar",
          stack: "total",
          data: delivered,
          itemStyle: { color: "#10b981" },
        },
        {
          name: "Falhou",
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
          name: "Contagem",
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
          name: "Engajamento de Usuários",
          type: "pie",
          radius: "50%",
          data: [
            { value: totalSeen, name: "Visto" },
            { value: unseen, name: "Não Visto" },
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
      case "IN_APP":
        return <IconBell className="h-4 w-4" />;
      default:
        return <IconBell className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, string> = {
      "SENT": "Enviado",
      "DELIVERED": "Entregue",
      "FAILED": "Falhou",
      "PENDING": "Pendente",
      "SEEN": "Visto"
    };

    const translatedStatus = statusMap[status] || status;

    switch (status) {
      case "SENT":
      case "DELIVERED":
        return <Badge variant="completed">{translatedStatus}</Badge>;
      case "FAILED":
        return <Badge variant="failed">{translatedStatus}</Badge>;
      case "PENDING":
        return <Badge variant="pending">{translatedStatus}</Badge>;
      case "SEEN":
        return <Badge variant="active">{translatedStatus}</Badge>;
      default:
        return <Badge variant="secondary">{translatedStatus}</Badge>;
    }
  };

  const navigate = useNavigate();
  const [showQrModal, setShowQrModal] = useState(false);

  return (
    <PrivilegeRoute>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Notificações"
          favoritePage={FAVORITE_PAGES.ADMINISTRACAO_NOTIFICACOES_LISTAR}
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Administração", href: "/administracao" },
            { label: "Notificações", href: "/administracao/notificacoes" },
            { label: "Análises" },
          ]}
          className="flex-shrink-0"
          actions={[
            {
              key: "qr-code",
              label: "QR Code WhatsApp",
              icon: IconQrcode,
              onClick: () => setShowQrModal(true),
              variant: "outline",
            },
            {
              key: "create",
              label: "Nova Notificação",
              icon: IconPlus,
              onClick: () => navigate(routes.administration.notifications.create),
              variant: "default",
            },
          ]}
        />

        <div className="flex-1 min-h-0 pb-6 flex flex-col gap-4">

          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Período</label>
                  <DateRangePicker
                    dateRange={dateRange}
                    onDateRangeChange={setDateRange}
                    placeholder="Selecionar período"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Tipo</label>
                  <Combobox
                    value={type}
                    onValueChange={(value) => setType(value || "ALL")}
                    options={[
                      { value: "ALL", label: "Todos os Tipos" },
                      { value: "TASK", label: "Tarefas" },
                      { value: "ORDER", label: "Pedidos" },
                      { value: "SYSTEM", label: "Sistema" },
                      { value: "MARKETING", label: "Marketing" },
                    ]}
                    placeholder="Todos os Tipos"
                    searchable={false}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Canal</label>
                  <Combobox
                    value={channel}
                    onValueChange={(value) => setChannel(value || "ALL")}
                    options={[
                      { value: "ALL", label: "Todos os Canais" },
                      { value: "EMAIL", label: "E-mail" },
                      { value: "PUSH", label: "Push" },
                      { value: "WHATSAPP", label: "WhatsApp" },
                      { value: "IN_APP", label: "No App" },
                    ]}
                    placeholder="Todos os Canais"
                    searchable={false}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Status</label>
                  <Combobox
                    value={status}
                    onValueChange={(value) => setStatus(value || "ALL")}
                    options={[
                      { value: "ALL", label: "Todos os Status" },
                      { value: "SENT", label: "Enviado" },
                      { value: "FAILED", label: "Falhou" },
                      { value: "PENDING", label: "Pendente" },
                    ]}
                    placeholder="Todos os Status"
                    searchable={false}
                  />
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
              <AlertDescription>Falha ao carregar estatísticas. Tente novamente.</AlertDescription>
            </Alert>
          ) : stats ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <IconSend className="h-4 w-4 text-blue-500" />
                    Total Enviado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{(stats?.totalSent || 0).toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground mt-1">Este mês</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <IconCheck className="h-4 w-4 text-green-500" />
                    Taxa de Entrega
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{(stats?.averageDeliveryRate || 0).toFixed(1)}%</div>
                  <p className="text-xs text-muted-foreground mt-1">Taxa média de entrega</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <IconEye className="h-4 w-4 text-purple-500" />
                    Taxa de Visualização
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{(stats?.averageSeenRate || 0).toFixed(1)}%</div>
                  <p className="text-xs text-muted-foreground mt-1">Taxa média de visualização</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <IconX className="h-4 w-4 text-red-500" />
                    Falharam
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{(stats?.failedDeliveries || 0).toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground mt-1">Entregas falhadas</p>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {/* Recent Notifications Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconClock className="h-5 w-5" />
                Notificações Recentes
              </CardTitle>
              <CardDescription>Clique em uma linha para ver detalhes de entrega</CardDescription>
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
                  <AlertDescription>Falha ao carregar notificações. Tente novamente.</AlertDescription>
                </Alert>
              ) : notifications && notifications.data.length > 0 ? (
                <>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Título</TableHead>
                          <TableHead>Enviado em</TableHead>
                          <TableHead>Canais</TableHead>
                          <TableHead>Entregue</TableHead>
                          <TableHead>Visto</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Ações</TableHead>
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
                      Mostrando {(page - 1) * pageSize + 1} a{" "}
                      {Math.min(page * pageSize, notifications.total)} de {notifications.total}{" "}
                      resultados
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        Anterior
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPage((p) => p + 1)}
                        disabled={page * pageSize >= notifications.total}
                      >
                        Próximo
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma notificação encontrada
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
            <DialogTitle>Detalhes da Notificação</DialogTitle>
            <DialogDescription>
              Visualize informações detalhadas de entrega e status dos destinatários
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
                <h3 className="font-semibold mb-2">Informações</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Tipo:</span>{" "}
                    <Badge variant="secondary">{notificationDetail.type}</Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Enviado em:</span>{" "}
                    {format(new Date(notificationDetail.sentAt), "dd/MM/yyyy HH:mm:ss")}
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Título:</span>{" "}
                    <span className="font-medium">{notificationDetail.title}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Mensagem:</span>{" "}
                    {notificationDetail.body}
                  </div>
                </div>
              </div>

              {/* Channel Status */}
              <div>
                <h3 className="font-semibold mb-2">Status de Entrega por Canal</h3>
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
                  Destinatários ({notificationDetail.recipients.length})
                </h3>
                <div className="rounded-md border max-h-64 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Contato</TableHead>
                        <TableHead>Canal</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Entregue em</TableHead>
                        <TableHead>Visto em</TableHead>
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
                <h3 className="font-semibold mb-2">Linha do Tempo</h3>
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

      {/* WhatsApp QR Code Modal */}
      <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconBrandWhatsapp className="w-5 h-5 text-green-500" />
              Conectar WhatsApp
            </DialogTitle>
            <DialogDescription>
              Escaneie o QR Code com seu WhatsApp para receber notificações
            </DialogDescription>
          </DialogHeader>
          <WhatsAppQRCard />
        </DialogContent>
      </Dialog>
    </PrivilegeRoute>
  );
};
