import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconCalendar, IconShield, IconUser, IconPackage, IconTruck, IconCircleCheck, IconFileText, IconPencil, IconExternalLink, IconRefresh } from "@tabler/icons-react";
import type { PpeDelivery } from "../../../../../types";
import { PPE_DELIVERY_STATUS_LABELS, getBadgeVariant, PPE_DELIVERY_STATUS } from "../../../../../constants";
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
    <Card className={cn("shadow-sm border border-border", className)}>
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

        {/* Signature Section - Only show for statuses related to signature */}
        {(ppeDelivery.status === PPE_DELIVERY_STATUS.WAITING_SIGNATURE ||
          ppeDelivery.status === PPE_DELIVERY_STATUS.COMPLETED ||
          ppeDelivery.status === PPE_DELIVERY_STATUS.SIGNATURE_REJECTED) && (
          <>
            {/* Divider */}
            <div className="border-t border-border my-4" />

            {/* Signature Header */}
            <div className="flex items-center gap-2 mb-3">
              <IconPencil className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Assinatura Digital</span>
            </div>

            {/* Signature Status */}
            <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
              <span className="text-sm font-medium text-muted-foreground">Status da Assinatura</span>
              <Badge
                variant={
                  ppeDelivery.status === PPE_DELIVERY_STATUS.COMPLETED
                    ? "success"
                    : ppeDelivery.status === PPE_DELIVERY_STATUS.SIGNATURE_REJECTED
                    ? "destructive"
                    : "warning"
                }
              >
                {ppeDelivery.status === PPE_DELIVERY_STATUS.COMPLETED
                  ? "Assinado"
                  : ppeDelivery.status === PPE_DELIVERY_STATUS.SIGNATURE_REJECTED
                  ? "Rejeitado"
                  : "Aguardando Assinatura"}
              </Badge>
            </div>

            {/* Signed At */}
            {ppeDelivery.clicksignSignedAt && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  <IconCircleCheck className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium text-muted-foreground">Data da Assinatura</span>
                </div>
                <span className="text-sm font-semibold text-foreground">
                  {formatDateTime(ppeDelivery.clicksignSignedAt)}
                </span>
              </div>
            )}

            {/* Delivery Document */}
            {ppeDelivery.deliveryDocument && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  <IconFileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Termo de Entrega</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="h-7"
                >
                  <a
                    href={`${import.meta.env.VITE_API_URL || ""}/files/${ppeDelivery.deliveryDocument.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1"
                  >
                    <IconExternalLink className="h-3.5 w-3.5" />
                    {ppeDelivery.clicksignSignedAt ? "Ver Documento Assinado" : "Ver Documento"}
                  </a>
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
