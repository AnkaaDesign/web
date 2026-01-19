import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { IconClipboardList, IconAlertCircle, IconCircleCheckFilled, IconClock, IconLoader, IconX } from "@tabler/icons-react";
import type { Customer, ServiceOrder } from "../../../../types";
import { formatDate, formatDateTime } from "../../../../utils";
import { SERVICE_ORDER_STATUS, SERVICE_ORDER_STATUS_LABELS } from "../../../../constants";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface RelatedServiceOrdersCardProps {
  customer: Customer;
  className?: string;
}

// Status icons and colors (solid backgrounds with white text)
const SERVICE_ORDER_STATUS_CONFIG: Record<
  string,
  {
    icon: any;
    color: string;
    badgeClass: string;
  }
> = {
  [SERVICE_ORDER_STATUS.PENDING]: {
    icon: IconClock,
    color: "text-neutral-500",
    badgeClass: "bg-neutral-500 hover:bg-neutral-600 text-white border-neutral-500",
  },
  [SERVICE_ORDER_STATUS.IN_PROGRESS]: {
    icon: IconLoader,
    color: "text-blue-500",
    badgeClass: "bg-blue-500 hover:bg-blue-600 text-white border-blue-500",
  },
  [SERVICE_ORDER_STATUS.COMPLETED]: {
    icon: IconCircleCheckFilled,
    color: "text-green-700",
    badgeClass: "bg-green-700 hover:bg-green-800 text-white border-green-700",
  },
  [SERVICE_ORDER_STATUS.CANCELLED]: {
    icon: IconX,
    color: "text-red-700",
    badgeClass: "bg-red-700 hover:bg-red-800 text-white border-red-700",
  },
};

export function RelatedServiceOrdersCard({ customer, className }: RelatedServiceOrdersCardProps) {
  // Since ServiceOrder is related to Task and Task is related to Customer,
  // we need to get service orders through tasks
  const serviceOrders = useMemo(() => {
    if (!customer.tasks) return [];

    const orders: ServiceOrder[] = [];
    customer.tasks.forEach((task) => {
      if (task.serviceOrders) {
        orders.push(...task.serviceOrders);
      }
    });
    return orders;
  }, [customer.tasks]);

  // Sort service orders by status priority (active orders first) and then by date
  const sortedServiceOrders = useMemo(() => {
    return [...serviceOrders].sort((a, b) => {
      // Priority for active statuses
      const statusPriority: Record<string, number> = {
        [SERVICE_ORDER_STATUS.IN_PROGRESS]: 1,
        [SERVICE_ORDER_STATUS.PENDING]: 2,
        [SERVICE_ORDER_STATUS.COMPLETED]: 3,
        [SERVICE_ORDER_STATUS.CANCELLED]: 4,
      };

      const aPriority = a.status ? (statusPriority[a.status] ?? 5) : 5;
      const bPriority = b.status ? (statusPriority[b.status] ?? 5) : 5;

      if (aPriority !== bPriority) return aPriority - bPriority;

      // Then sort by date (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [serviceOrders]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const totalOrders = serviceOrders.length;
    const activeOrders = serviceOrders.filter((order) => order.status && order.status !== SERVICE_ORDER_STATUS.CANCELLED && order.status !== SERVICE_ORDER_STATUS.COMPLETED).length;
    const completedOrders = serviceOrders.filter((order) => order.status === SERVICE_ORDER_STATUS.COMPLETED).length;

    const statusCounts = serviceOrders.reduce(
      (acc, order) => {
        if (order.status) {
          acc[order.status] = (acc[order.status] || 0) + 1;
        }
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      totalOrders,
      activeOrders,
      completedOrders,
      statusCounts,
    };
  }, [serviceOrders]);

  if (serviceOrders.length === 0) {
    return (
      <Card className={cn("shadow-sm border border-border", className)}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
          <IconClipboardList className="h-5 w-5 text-muted-foreground" />
          Ordens de Serviço Relacionadas
        </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-center py-12">
            <IconAlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhuma ordem de serviço associada a este cliente.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("shadow-sm border border-border", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
          <IconClipboardList className="h-5 w-5 text-muted-foreground" />
          Ordens de Serviço Relacionadas
        </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Statistics Summary */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-card-nested rounded-lg p-3 border border-border">
            <span className="text-xs font-medium text-muted-foreground block">Total de Ordens</span>
            <p className="text-xl font-bold mt-1">{statistics.totalOrders}</p>
          </div>

          <div className="bg-blue-50/80 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200/40 dark:border-blue-700/40">
            <span className="text-xs font-medium text-blue-800 dark:text-blue-200 block">Ordens Ativas</span>
            <p className="text-xl font-bold mt-1 text-blue-800 dark:text-blue-200">{statistics.activeOrders}</p>
          </div>

          <div className="bg-green-50/80 dark:bg-green-900/20 rounded-lg p-3 border border-green-200/40 dark:border-green-700/40">
            <span className="text-xs font-medium text-green-800 dark:text-green-200 block">Ordens Finalizadas</span>
            <p className="text-xl font-bold mt-1 text-green-800 dark:text-green-200">{statistics.completedOrders}</p>
          </div>
        </div>

        {/* Status Summary */}
        <div className="flex flex-wrap gap-2 mb-4">
          {[SERVICE_ORDER_STATUS.PENDING, SERVICE_ORDER_STATUS.IN_PROGRESS, SERVICE_ORDER_STATUS.COMPLETED, SERVICE_ORDER_STATUS.CANCELLED].map((status: string) => {
            const count = statistics.statusCounts[status] || 0;
            const config = SERVICE_ORDER_STATUS_CONFIG[status];
            return (
              <Badge key={status} className={cn("font-medium border", config.badgeClass)}>
                {SERVICE_ORDER_STATUS_LABELS[status as SERVICE_ORDER_STATUS]} ({count})
              </Badge>
            );
          })}
        </div>

        {/* Service Orders Grid */}
        <ScrollArea className="h-[320px]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pr-4">
            {sortedServiceOrders.map((serviceOrder: any) => {
              const status = serviceOrder.status || SERVICE_ORDER_STATUS.PENDING;
              const config = SERVICE_ORDER_STATUS_CONFIG[status];
              const StatusIcon = config.icon;

              // Get service order description
              const serviceOrderDescription = serviceOrder.description || `Ordem #${serviceOrder.id.slice(-8).toUpperCase()}`;

              return (
                <div key={serviceOrder.id} className="block">
                  <div className="group relative overflow-hidden rounded-lg border border-border/50 dark:border-border/40 bg-card hover:bg-muted/50 transition-colors cursor-pointer min-h-[140px] flex flex-col">
                    <div className="p-3 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm text-foreground truncate">{serviceOrderDescription}</h4>
                          </div>
                        </div>

                        {serviceOrder.task && (
                          <p className="text-xs text-muted-foreground truncate">
                            Tarefa: {serviceOrder.task.name || serviceOrder.task.details || `#${serviceOrder.task.id.slice(-8).toUpperCase()}`}
                          </p>
                        )}

                        {status === SERVICE_ORDER_STATUS.CANCELLED && (
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              Cancelado
                            </Badge>
                          </div>
                        )}
                      </div>

                      <div className="mt-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger className="inline-flex cursor-help">
                                  <StatusIcon className={cn("w-4 h-4 flex-shrink-0", config.color)} aria-label={SERVICE_ORDER_STATUS_LABELS[status as SERVICE_ORDER_STATUS]} />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="space-y-1">
                                    <p className="font-semibold">{SERVICE_ORDER_STATUS_LABELS[status as SERVICE_ORDER_STATUS]}</p>
                                    <p className="text-xs">Criado em {formatDate(serviceOrder.createdAt)}</p>
                                    {serviceOrder.startedAt && <p className="text-xs">Iniciado em {formatDateTime(serviceOrder.startedAt)}</p>}
                                    {serviceOrder.finishedAt && <p className="text-xs">Finalizado em {formatDateTime(serviceOrder.finishedAt)}</p>}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            <span className="font-medium tabular-nums text-sm">{formatDate(serviceOrder.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
