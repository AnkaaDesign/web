import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { OrderStatusBadge } from "../common/order-status-badge";
import { OrderTotalBadge } from "../common/order-total-calculator";
import { IconPackage, IconCalendar, IconCurrencyReal, IconTruck, IconNotes, IconFile, IconFileInvoice, IconReceipt, IconFileText, IconId } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { formatDate, formatDateTime, formatCNPJ } from "../../../../utils";
import type { Order } from "../../../../types";
import { FilePreviewCard } from "@/components/file";
import { SupplierLogoDisplay } from "@/components/ui/avatar-display";

interface OrderInfoCardProps {
  order: Order;
  className?: string;
}

export function OrderInfoCard({ order, className }: OrderInfoCardProps) {
  // Check if order has temporary items
  const hasTemporaryItems = order.items?.some((item) => item.temporaryItemDescription);

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)} level={1}>
      <CardHeader className="pb-6">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-primary/10">
              <IconPackage className="h-5 w-5 text-primary" />
            </div>
            Informações do Pedido
          </CardTitle>
          <div className="flex items-center gap-2">
            <OrderStatusBadge status={order.status} />
            {hasTemporaryItems && (
              <Badge variant="outline" className="text-xs">
                Temporário
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 flex-1 space-y-6">
        {/* Supplier Information */}
        <div className="space-y-4">
          <h3 className="text-base font-semibold mb-4 text-foreground">Fornecedor</h3>
          <div className="space-y-4">
            {order.supplier ? (
              <>
                {/* Logo and Fantasy Name Section */}
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconTruck className="h-4 w-4" />
                    Nome Fantasia
                  </span>
                  <div className="flex items-center gap-3">
                    <SupplierLogoDisplay
                      logo={order.supplier.logo}
                      supplierName={order.supplier.fantasyName}
                      size="md"
                      shape="rounded"
                    />
                    <span className="text-sm font-semibold text-foreground">{order.supplier.fantasyName}</span>
                  </div>
                </div>

                {order.supplier.cnpj && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconId className="h-4 w-4" />
                      CNPJ
                    </span>
                    <span className="text-sm text-foreground">{formatCNPJ(order.supplier.cnpj)}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-muted-foreground italic">Nenhum fornecedor associado</div>
            )}
          </div>
        </div>

        <Separator className="bg-border/50" />

        {/* Order Details */}
        <div className="space-y-4">
          <h3 className="text-base font-semibold mb-4 text-foreground">Detalhes do Pedido</h3>

          <div className="space-y-4">
            <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <IconFileText className="h-4 w-4" />
                Descrição
              </span>
              <span className="text-sm font-semibold text-foreground">{order.description || "-"}</span>
            </div>

            <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <IconCurrencyReal className="h-4 w-4" />
                Valor Total
              </span>
              <OrderTotalBadge orderItems={order.items} />
            </div>

            <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <IconCalendar className="h-4 w-4" />
                Previsão de Entrega
              </span>
              <span className="text-sm font-semibold text-foreground">{order.forecast ? formatDate(order.forecast) : "-"}</span>
            </div>

            <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <IconCalendar className="h-4 w-4" />
                Data do Pedido
              </span>
              <span className="text-sm font-semibold text-foreground">{formatDateTime(order.createdAt)}</span>
            </div>

            {order.updatedAt && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconCalendar className="h-4 w-4" />
                  Atualizado em
                </span>
                <span className="text-sm font-semibold text-foreground">{formatDateTime(order.updatedAt)}</span>
              </div>
            )}

            <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
              <span className="text-sm font-medium text-muted-foreground">Total de Itens</span>
              <Badge variant="secondary" className="text-sm">{order.items?.length || 0} itens</Badge>
            </div>

            {order.orderSchedule && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">Origem</span>
                <Badge variant="outline">Agendado</Badge>
              </div>
            )}

            {order.notes && (
              <div className="bg-muted/50 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <IconNotes className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Observações</span>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap">{order.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* File Attachments */}
        {(order.budget || order.nfe || order.receipt) && (
          <>
            <Separator className="bg-border/50" />
            <div className="space-y-6">
              <h3 className="text-base font-semibold text-foreground">Documentos Anexados</h3>

              {order.budget && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <IconCurrencyReal className="h-4 w-4 text-muted-foreground" />
                    <h4 className="text-sm font-semibold">Orçamento</h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <FilePreviewCard file={order.budget} size="md" showMetadata={true} />
                  </div>
                </div>
              )}

              {order.nfe && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <IconFileInvoice className="h-4 w-4 text-muted-foreground" />
                    <h4 className="text-sm font-semibold">Nota Fiscal</h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <FilePreviewCard file={order.nfe} size="md" showMetadata={true} />
                  </div>
                </div>
              )}

              {order.receipt && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <IconReceipt className="h-4 w-4 text-muted-foreground" />
                    <h4 className="text-sm font-semibold">Recibo</h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <FilePreviewCard file={order.receipt} size="md" showMetadata={true} />
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
