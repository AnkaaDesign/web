import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { OrderPaymentStatusBadge } from "../common/order-payment-status-badge";
import { IconCalendar, IconCreditCard, IconCopy, IconQrcode, IconUser, IconReceipt2 } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { formatDate, formatDateTime, formatCurrency, formatPixKey } from "../../../../utils";
import { useCanViewPrices } from "../../../../hooks";
import type { Order, OrderInstallment } from "../../../../types";
import { PAYMENT_METHOD_LABELS, ORDER_INSTALLMENT_STATUS_LABELS, ORDER_INSTALLMENT_STATUS } from "../../../../constants";
import { toast } from "@/components/ui/sonner";

interface OrderPaymentCardProps {
  order: Order;
  className?: string;
}

const INSTALLMENT_STATUS_VARIANT: Record<string, string> = {
  [ORDER_INSTALLMENT_STATUS.PENDING]: "pending",
  [ORDER_INSTALLMENT_STATUS.PARTIALLY_PAID]: "orange",
  [ORDER_INSTALLMENT_STATUS.PAID]: "green",
  [ORDER_INSTALLMENT_STATUS.OVERDUE]: "red",
  [ORDER_INSTALLMENT_STATUS.CANCELLED]: "cancelled",
};

const rowCls = "flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3";
const labelCls = "text-sm font-medium text-muted-foreground flex items-center gap-2";
const valueCls = "text-sm font-semibold text-foreground";

export function OrderPaymentCard({ order, className }: OrderPaymentCardProps) {
  const canViewPrices = useCanViewPrices();
  // Financial-only: WAREHOUSE manages the order but never sees its payment side.
  if (!canViewPrices) return null;

  const isBoleto = order.paymentMethod === "BANK_SLIP";
  const installmentCount = order.installmentCount || 1;
  // Open + paid parcelas, ordered by number. Single-payment (PIX/cartão) carry none.
  const installments: OrderInstallment[] = (order.installments || [])
    .slice()
    .sort((a, b) => (a.number || 0) - (b.number || 0));

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-2">
          <IconCreditCard className="h-5 w-5 text-muted-foreground" />
          Método de Pagamento
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-0 flex-1 space-y-6">
        {/* Payment summary */}
        <div className="space-y-4">
          {order.paymentStatus && (
            <div className={rowCls}>
              <span className={labelCls}>
                <IconCreditCard className="h-4 w-4" />
                Status de Pagamento
              </span>
              <OrderPaymentStatusBadge status={order.paymentStatus} />
            </div>
          )}

          {order.paymentResponsible && (
            <div className={rowCls}>
              <span className={labelCls}>
                <IconUser className="h-4 w-4" />
                Responsável pelo Pagamento
              </span>
              <span className={valueCls}>{order.paymentResponsible.name}</span>
            </div>
          )}

          {order.paymentMethod && (
            <div className={rowCls}>
              <span className={labelCls}>
                <IconCreditCard className="h-4 w-4" />
                Forma de Pagamento
              </span>
              <Badge variant="outline">{PAYMENT_METHOD_LABELS[order.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS]}</Badge>
            </div>
          )}

          {order.paymentMethod === "PIX" && order.paymentPix && (
            <div className="bg-muted/50 rounded-lg px-4 py-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className={labelCls}>
                  <IconQrcode className="h-4 w-4" />
                  Chave Pix
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    navigator.clipboard.writeText(order.paymentPix!);
                    toast.success("Chave Pix copiada!");
                  }}
                >
                  <IconCopy className="h-4 w-4 mr-1" />
                  Copiar
                </Button>
              </div>
              <p className="text-sm font-semibold text-foreground font-mono break-all">{formatPixKey(order.paymentPix!)}</p>
            </div>
          )}

          {isBoleto && installmentCount > 1 && (
            <div className={rowCls}>
              <span className="text-sm font-medium text-muted-foreground">Parcelas</span>
              <span className={valueCls}>{installmentCount}x</span>
            </div>
          )}

          {isBoleto && order.paymentFirstDueDate && (
            <div className={rowCls}>
              <span className="text-sm font-medium text-muted-foreground">
                {installmentCount > 1 ? "1º Vencimento" : "Vencimento"}
              </span>
              <span className={valueCls}>{formatDate(order.paymentFirstDueDate)}</span>
            </div>
          )}

          {isBoleto && installmentCount > 1 && order.paymentDueDays && (
            <div className={rowCls}>
              <span className="text-sm font-medium text-muted-foreground">Intervalo entre Parcelas</span>
              <span className={valueCls}>{order.paymentDueDays} dias</span>
            </div>
          )}

          {order.paidAt && (
            <div className={rowCls}>
              <span className={labelCls}>
                <IconCalendar className="h-4 w-4" />
                Pago em
              </span>
              <span className={valueCls}>{formatDateTime(order.paidAt)}</span>
            </div>
          )}
        </div>

        {/* Installment schedule (boleto 2x/3x) — one row per parcela. */}
        {installments.length > 0 && (
          <>
            <Separator className="bg-border" />
            <div className="space-y-4">
              <h3 className="text-base font-semibold mb-4 text-foreground flex items-center gap-2">
                <IconReceipt2 className="h-4 w-4 text-muted-foreground" />
                Parcelas do Boleto
              </h3>
              <div className="space-y-2">
                {installments.map((inst) => {
                  const variant = (INSTALLMENT_STATUS_VARIANT[inst.status] || "outline") as any;
                  return (
                    <div key={inst.id} className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3 gap-3">
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium text-foreground">
                          {inst.number}ª parcela de {installments.length}
                        </span>
                        {inst.dueDate && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <IconCalendar className="h-3 w-3" />
                            Vence em {formatDate(inst.dueDate)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-sm font-semibold text-foreground tabular-nums">{formatCurrency(inst.amount)}</span>
                        <Badge variant={variant} className="whitespace-nowrap">
                          {ORDER_INSTALLMENT_STATUS_LABELS[inst.status as keyof typeof ORDER_INSTALLMENT_STATUS_LABELS] || inst.status}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
