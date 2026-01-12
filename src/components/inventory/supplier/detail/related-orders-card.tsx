import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { IconShoppingCart, IconAlertCircle, IconCircleCheckFilled, IconClock, IconTruck, IconPackage, IconAlertTriangle, IconX } from "@tabler/icons-react";
import type { Supplier } from "../../../../types";
import { formatCurrency, formatDate } from "../../../../utils";
import { ORDER_STATUS, ORDER_STATUS_LABELS } from "../../../../constants";
import { cn } from "@/lib/utils";
import { Link, useNavigate } from "react-router-dom";
import { routes } from "../../../../constants";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface RelatedOrdersCardProps {
  supplier: Supplier;
  className?: string;
}

// Status icons and colors (solid backgrounds with white text)
const ORDER_STATUS_CONFIG: Record<
  string,
  {
    icon: any;
    color: string;
    badgeClass: string;
  }
> = {
  [ORDER_STATUS.CREATED]: {
    icon: IconClock,
    color: "text-neutral-500",
    badgeClass: "bg-neutral-500 hover:bg-neutral-600 text-white border-neutral-500",
  },
  [ORDER_STATUS.PARTIALLY_FULFILLED]: {
    icon: IconPackage,
    color: "text-yellow-500",
    badgeClass: "bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500",
  },
  [ORDER_STATUS.FULFILLED]: {
    icon: IconTruck,
    color: "text-orange-500",
    badgeClass: "bg-orange-500 hover:bg-orange-600 text-white border-orange-500",
  },
  [ORDER_STATUS.PARTIALLY_RECEIVED]: {
    icon: IconPackage,
    color: "text-blue-500",
    badgeClass: "bg-blue-500 hover:bg-blue-600 text-white border-blue-500",
  },
  [ORDER_STATUS.RECEIVED]: {
    icon: IconCircleCheckFilled,
    color: "text-green-700",
    badgeClass: "bg-green-700 hover:bg-green-800 text-white border-green-700",
  },
  [ORDER_STATUS.OVERDUE]: {
    icon: IconAlertTriangle,
    color: "text-purple-600",
    badgeClass: "bg-purple-600 hover:bg-purple-700 text-white border-purple-600",
  },
  [ORDER_STATUS.CANCELLED]: {
    icon: IconX,
    color: "text-red-700",
    badgeClass: "bg-red-700 hover:bg-red-800 text-white border-red-700",
  },
};

export function RelatedOrdersCard({ supplier, className }: RelatedOrdersCardProps) {
  const navigate = useNavigate();
  const orders = supplier.orders || [];

  // Sort orders by status priority (active orders first) and then by date
  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      // Priority for active statuses
      const statusPriority: Record<string, number> = {
        [ORDER_STATUS.CREATED]: 1,
        [ORDER_STATUS.PARTIALLY_FULFILLED]: 2,
        [ORDER_STATUS.FULFILLED]: 3,
        [ORDER_STATUS.OVERDUE]: 4,
        [ORDER_STATUS.PARTIALLY_RECEIVED]: 5,
        [ORDER_STATUS.RECEIVED]: 6,
        [ORDER_STATUS.CANCELLED]: 7,
      };

      const aPriority = statusPriority[a.status] ?? 8;
      const bPriority = statusPriority[b.status] ?? 8;

      if (aPriority !== bPriority) return aPriority - bPriority;

      // Then sort by date (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [orders]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const totalOrders = orders.length;
    const activeOrders = orders.filter((order) => order.status !== ORDER_STATUS.CANCELLED && order.status !== ORDER_STATUS.RECEIVED).length;
    const completedOrders = orders.filter((order) => order.status === ORDER_STATUS.RECEIVED).length;

    const totalValue = orders.reduce((sum, order) => {
      const orderTotal = order.items?.reduce((itemSum, item) => itemSum + item.orderedQuantity * item.price, 0) || 0;
      return sum + orderTotal;
    }, 0);

    const statusCounts = orders.reduce(
      (acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      totalOrders,
      activeOrders,
      completedOrders,
      totalValue,
      statusCounts,
    };
  }, [orders]);

  if (orders.length === 0) {
    return (
      <Card className={cn("shadow-sm border border-border", className)}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
          <IconShoppingCart className="h-5 w-5 text-muted-foreground" />
          Pedidos Relacionados
        </CardTitle>
            {supplier.id && (
              <Button variant="outline" size="sm" onClick={() => navigate(`${routes.inventory.orders.list}?suppliers=${supplier.id}`)}>
                Ver todos os pedidos
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-center py-12">
            <IconAlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum pedido associado a este fornecedor.</p>
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
          <IconShoppingCart className="h-5 w-5 text-muted-foreground" />
          Pedidos Relacionados
        </CardTitle>
          {supplier.id && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`${routes.inventory.orders.list}?supplierId=${supplier.id}&supplierName=${encodeURIComponent(supplier.name || "")}`)}
            >
              Ver todos os pedidos
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Statistics Summary */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-card-nested rounded-lg p-3 border border-border">
            <span className="text-xs font-medium text-muted-foreground block">Total de Pedidos</span>
            <p className="text-xl font-bold mt-1">{statistics.totalOrders}</p>
          </div>

          <div className="bg-yellow-50/80 dark:bg-yellow-900/20 rounded-lg p-3 border border-yellow-200/40 dark:border-yellow-700/40">
            <span className="text-xs font-medium text-yellow-800 dark:text-yellow-200 block">Pedidos Ativos</span>
            <p className="text-xl font-bold mt-1 text-yellow-800 dark:text-yellow-200">{statistics.activeOrders}</p>
          </div>

          <div className="bg-blue-50/80 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200/40 dark:border-blue-700/40">
            <span className="text-xs font-medium text-blue-800 dark:text-blue-200 block">Valor Total</span>
            <p className="text-xl font-bold mt-1 text-blue-800 dark:text-blue-200">{formatCurrency(statistics.totalValue)}</p>
          </div>
        </div>

        {/* Status Summary */}
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            ORDER_STATUS.CREATED,
            ORDER_STATUS.PARTIALLY_FULFILLED,
            ORDER_STATUS.FULFILLED,
            ORDER_STATUS.OVERDUE,
            ORDER_STATUS.PARTIALLY_RECEIVED,
            ORDER_STATUS.RECEIVED,
            ORDER_STATUS.CANCELLED,
          ].map((status) => {
            const count = statistics.statusCounts[status] || 0;
            const config = ORDER_STATUS_CONFIG[status];
            return (
              <Badge key={status} className={cn("font-medium border", config.badgeClass)}>
                {ORDER_STATUS_LABELS[status]} ({count})
              </Badge>
            );
          })}
        </div>

        {/* Orders Grid */}
        <ScrollArea className="h-[320px]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pr-4">
            {sortedOrders.map((order) => {
              const orderTotal = order.items?.reduce((sum, item) => sum + item.orderedQuantity * item.price, 0) || 0;
              const itemCount = order.items?.length || 0;
              const config = ORDER_STATUS_CONFIG[order.status];
              const StatusIcon = config.icon;

              // Get order description (use invoice number or order ID)
              const orderDescription = `Pedido #${order.id.slice(-8).toUpperCase()}`;

              return (
                <Link key={order.id} to={routes.inventory.orders.details(order.id)} className="block">
                  <div className="group relative overflow-hidden rounded-lg border border-border/50 dark:border-border/40 bg-card hover:bg-muted/50 transition-colors cursor-pointer min-h-[140px] flex flex-col">
                    <div className="p-3 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm text-foreground truncate">{orderDescription}</h4>
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground truncate">
                          {itemCount} {itemCount === 1 ? "item" : "itens"}
                        </p>

                        {order.status === ORDER_STATUS.CANCELLED && (
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
                                  <StatusIcon className={cn("w-4 h-4 flex-shrink-0", config.color)} aria-label={ORDER_STATUS_LABELS[order.status]} />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="space-y-1">
                                    <p className="font-semibold">{ORDER_STATUS_LABELS[order.status]}</p>
                                    <p className="text-xs">Criado em {formatDate(order.createdAt)}</p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            <span className="font-medium tabular-nums text-sm">{formatDate(order.createdAt)}</span>
                          </div>

                          {orderTotal > 0 && <p className="text-xs text-muted-foreground font-medium">{formatCurrency(orderTotal)}</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
