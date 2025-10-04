import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconCalendar, IconShield, IconUser, IconPackage, IconHash, IconAlertCircle, IconCircleCheck, IconCircleX, IconTruck } from "@tabler/icons-react";
import type { PpeDelivery } from "../../../../../types";
import { PPE_DELIVERY_STATUS, PPE_DELIVERY_STATUS_LABELS, PPE_TYPE_LABELS } from "../../../../../constants";
import { formatDate, formatDateTime, formatRelativeTime } from "../../../../../utils";
import { cn } from "@/lib/utils";

interface PpeDeliveryInfoCardProps {
  ppeDelivery: PpeDelivery;
  className?: string;
}

export function PpeDeliveryInfoCard({ ppeDelivery, className }: PpeDeliveryInfoCardProps) {
  const getStatusColor = (status: PPE_DELIVERY_STATUS) => {
    switch (status) {
      case PPE_DELIVERY_STATUS.PENDING:
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      case PPE_DELIVERY_STATUS.DELIVERED:
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case PPE_DELIVERY_STATUS.CANCELLED:
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  const getStatusIcon = (status: PPE_DELIVERY_STATUS) => {
    switch (status) {
      case PPE_DELIVERY_STATUS.PENDING:
        return <IconAlertCircle className="h-4 w-4" />;
      case PPE_DELIVERY_STATUS.DELIVERED:
        return <IconCircleCheck className="h-4 w-4" />;
      case PPE_DELIVERY_STATUS.CANCELLED:
        return <IconCircleX className="h-4 w-4" />;
      default:
        return <IconAlertCircle className="h-4 w-4" />;
    }
  };

  return (
    <Card className={cn("shadow-sm border border-border", className)} level={1}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3 text-xl">
          <div className="p-2 rounded-lg bg-primary/10">
            <IconShield className="h-5 w-5 text-primary" />
          </div>
          Informações da Entrega
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Status</span>
          <Badge className={cn("gap-1.5", getStatusColor(ppeDelivery.status))}>
            {getStatusIcon(ppeDelivery.status)}
            {PPE_DELIVERY_STATUS_LABELS[ppeDelivery.status]}
          </Badge>
        </div>

        {/* ID da Entrega */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <IconHash className="h-4 w-4" />
            ID da Entrega
          </div>
          <span className="font-mono text-sm">#{ppeDelivery.id.slice(-8)}</span>
        </div>

        {/* Item */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <IconPackage className="h-4 w-4" />
            Item
          </div>
          <div className="text-right">
            <p className="font-medium">{ppeDelivery.item?.name || "-"}</p>
            {ppeDelivery.item?.ppeType && <p className="text-xs text-muted-foreground">{PPE_TYPE_LABELS[ppeDelivery.item.ppeType]}</p>}
          </div>
        </div>

        {/* Funcionário */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <IconUser className="h-4 w-4" />
            Funcionário
          </div>
          <div className="text-right">
            <p className="font-medium">{ppeDelivery.user?.name || "-"}</p>
            {ppeDelivery.user?.position && <p className="text-xs text-muted-foreground">{ppeDelivery.user.position.name}</p>}
          </div>
        </div>

        {/* Quantidade */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <IconPackage className="h-4 w-4" />
            Quantidade
          </div>
          <span className="font-mono font-semibold text-lg">{ppeDelivery.quantity || 0}</span>
        </div>

        {/* Data de Criação */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <IconCalendar className="h-4 w-4" />
            Data de Criação
          </div>
          <div className="text-right">
            <p className="text-sm">{formatDate(ppeDelivery.createdAt)}</p>
            <p className="text-xs text-muted-foreground">{formatRelativeTime(ppeDelivery.createdAt)}</p>
          </div>
        </div>

        {/* Data de Entrega */}
        {ppeDelivery.actualDeliveryDate && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <IconTruck className="h-4 w-4" />
              Data de Entrega
            </div>
            <div className="text-right">
              <p className="text-sm">{formatDateTime(ppeDelivery.actualDeliveryDate)}</p>
              <p className="text-xs text-muted-foreground">{formatRelativeTime(ppeDelivery.actualDeliveryDate)}</p>
            </div>
          </div>
        )}

        {/* Revisado Por */}
        {ppeDelivery.reviewedByUser && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <IconCircleCheck className="h-4 w-4" />
              Revisado por
            </div>
            <div className="text-right">
              <p className="font-medium">{ppeDelivery.reviewedByUser.name}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
