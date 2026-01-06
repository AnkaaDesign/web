import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconTruck, IconUser, IconCalendar, IconArrowRight, IconAlertCircle } from "@tabler/icons-react";
import { usePpeDeliveries } from "../../../../../hooks";
import type { PpeDelivery } from "../../../../../types";
import { PPE_DELIVERY_STATUS, PPE_DELIVERY_STATUS_LABELS } from "../../../../../constants";
import { formatDate, formatRelativeTime } from "../../../../../utils";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { routes } from "../../../../../constants";
import { Skeleton } from "@/components/ui/skeleton";

interface PpeScheduleDeliveriesCardProps {
  scheduleId: string;
  className?: string;
}

export function PpeScheduleDeliveriesCard({ scheduleId, className }: PpeScheduleDeliveriesCardProps) {
  const navigate = useNavigate();

  // Fetch recent deliveries for this schedule
  const { data: deliveriesData, isLoading } = usePpeDeliveries({
    where: {
      ppeScheduleId: scheduleId,
    },
    include: {
      user: {
        include: {
          position: true,
        },
      },
      item: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    limit: 5,
  });

  const deliveries = deliveriesData?.data || [];

  const getStatusColor = (status: PPE_DELIVERY_STATUS) => {
    switch (status) {
      case PPE_DELIVERY_STATUS.PENDING:
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      case PPE_DELIVERY_STATUS.APPROVED:
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case PPE_DELIVERY_STATUS.DELIVERED:
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case PPE_DELIVERY_STATUS.CANCELLED:
      case PPE_DELIVERY_STATUS.REPROVED:
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  return (
    <Card className={cn("shadow-sm border border-border", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <IconTruck className="h-5 w-5 text-muted-foreground" />
          Entregas Recentes
        </CardTitle>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 rounded-lg bg-muted/30">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : deliveries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <IconAlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Nenhuma entrega gerada ainda</p>
            <p className="text-xs mt-1">As entregas aparecerão aqui quando forem criadas pelo agendamento</p>
          </div>
        ) : (
          <div className="space-y-3">
            {deliveries.map((delivery: PpeDelivery) => (
              <div
                key={delivery.id}
                className="p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer group"
                onClick={() => navigate(routes.inventory.ppe.deliveries.details(delivery.id))}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <IconUser className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{delivery.user?.name || "Usuário desconhecido"}</p>
                      {delivery.user?.position && (
                        <p className="text-xs text-muted-foreground truncate">{delivery.user.position.name}</p>
                      )}
                    </div>
                  </div>
                  <Badge className={cn("ml-2 text-xs flex-shrink-0", getStatusColor(delivery.status))}>
                    {PPE_DELIVERY_STATUS_LABELS[delivery.status]}
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <IconCalendar className="h-3 w-3" />
                    <span>{formatRelativeTime(delivery.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span>Ver detalhes</span>
                    <IconArrowRight className="h-3 w-3" />
                  </div>
                </div>
              </div>
            ))}

            {/* View All Button */}
            {deliveries.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-4"
                onClick={() => navigate(`${routes.inventory.ppe.deliveries.root}?scheduleId=${scheduleId}`)}
              >
                Ver Todas as Entregas
                <IconArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
