import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconCalendar, IconShield, IconUser, IconPackage, IconTruck, IconCircleCheck } from "@tabler/icons-react";
import type { PpeDelivery } from "../../../../../types";
import { PPE_DELIVERY_STATUS_LABELS, getBadgeVariant } from "../../../../../constants";
import { formatDateTime } from "../../../../../utils";
import { cn } from "@/lib/utils";

interface PpeDeliveryInfoCardProps {
  ppeDelivery: PpeDelivery;
  className?: string;
}

export function PpeDeliveryInfoCard({ ppeDelivery, className }: PpeDeliveryInfoCardProps) {
  const statusLabel = PPE_DELIVERY_STATUS_LABELS[ppeDelivery.status] || ppeDelivery.status;
  const statusVariant = getBadgeVariant(ppeDelivery.status, "PPE_DELIVERY");

  return (
    <Card className={cn("shadow-sm border border-border", className)} level={1}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <IconShield className="h-5 w-5 text-muted-foreground" />
          Informações da Entrega
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Status */}
        <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
          <span className="text-sm font-medium text-muted-foreground">Status</span>
          <Badge variant={statusVariant} className="whitespace-nowrap">
            {statusLabel}
          </Badge>
        </div>

        {/* Item */}
        <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2">
            <IconPackage className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Item</span>
          </div>
          <span className="text-sm font-semibold text-foreground">{ppeDelivery.item?.name || "-"}</span>
        </div>

        {/* Funcionário */}
        <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2">
            <IconUser className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Funcionário</span>
          </div>
          <span className="text-sm font-semibold text-foreground">{ppeDelivery.user?.name || "-"}</span>
        </div>

        {/* Aprovado Por */}
        {ppeDelivery.reviewedByUser && (
          <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2">
              <IconCircleCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Aprovado Por</span>
            </div>
            <span className="text-sm font-semibold text-foreground">{ppeDelivery.reviewedByUser.name}</span>
          </div>
        )}

        {/* Quantidade */}
        <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2">
            <IconPackage className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Quantidade</span>
          </div>
          <span className="font-mono font-semibold text-lg">{ppeDelivery.quantity || 0}</span>
        </div>

        {/* Data de Requisição */}
        <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2">
            <IconCalendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Data de Requisição</span>
          </div>
          <span className="text-sm font-semibold text-foreground">{formatDateTime(ppeDelivery.createdAt)}</span>
        </div>

        {/* Data de Aprovação */}
        {ppeDelivery.reviewedBy && ppeDelivery.updatedAt && (
          <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2">
              <IconCircleCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Data de Aprovação</span>
            </div>
            <span className="text-sm font-semibold text-foreground">{formatDateTime(ppeDelivery.updatedAt)}</span>
          </div>
        )}

        {/* Data de Entrega */}
        {ppeDelivery.actualDeliveryDate && (
          <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2">
              <IconTruck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Data de Entrega</span>
            </div>
            <span className="text-sm font-semibold text-foreground">{formatDateTime(ppeDelivery.actualDeliveryDate)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
