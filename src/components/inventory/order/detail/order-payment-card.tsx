import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { OrderPaymentStatusBadge } from "../common/order-payment-status-badge";
import { IconCalendar, IconCreditCard, IconCopy, IconQrcode, IconUser, IconReceipt2, IconCircleCheck, IconHourglass } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { formatDate, formatDateTime, formatCurrency, formatPixKey } from "../../../../utils";
import { useCanViewPrices, useOrderMutations } from "../../../../hooks";
import { useAuth } from "@/contexts/auth-context";
import { hasAnyPrivilege } from "@/utils/user";
import type { Order, OrderInstallment } from "../../../../types";
import { PAYMENT_METHOD_LABELS, ORDER_INSTALLMENT_STATUS_LABELS, ORDER_INSTALLMENT_STATUS, ORDER_PAYMENT_STATUS, SECTOR_PRIVILEGES } from "../../../../constants";
import { toast } from "@/components/ui/sonner";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const { user } = useAuth();
  const { markInstallmentPaidAsync, markPaidAsync, markAwaitingPaymentAsync, isLoading: isSettling } = useOrderMutations();
  const isPaid = order.paymentStatus === ORDER_PAYMENT_STATUS.PAID;
  // Confirm before settling/undoing so the in-place toggle can't be triggered by accident.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const handleConfirmSettle = async () => {
    setConfirmOpen(false);
    if (isPaid) await markAwaitingPaymentAsync(order.id);
    else await markPaidAsync(order.id);
  };
  // Settling a parcela is a financial action (matches the mark-paid endpoint's roles).
  const canManagePayments = hasAnyPrivilege(user as any, [
    SECTOR_PRIVILEGES.FINANCIAL,
    SECTOR_PRIVILEGES.ACCOUNTING,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
  // Financial-only: WAREHOUSE manages the order but never sees its payment side.
  if (!canViewPrices) return null;

  const isBoleto = order.paymentMethod === "BANK_SLIP";
  const installmentCount = order.installmentCount || 1;
  // Open + paid parcelas, ordered by number. Single-payment (PIX/cartão) carry none.
  const installments: OrderInstallment[] = (order.installments || [])
    .slice()
    .sort((a, b) => (a.number || 0) - (b.number || 0));

  return (
    <>
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <IconCreditCard className="h-5 w-5 text-muted-foreground" />
            Pagamento
          </CardTitle>
          {/* Order-level settle action — available for ANY payment method (incl. Pix),
              not just boleto. Financial-only. */}
          {canManagePayments &&
            (isPaid ? (
              <Button variant="outline" size="sm" disabled={isSettling} onClick={() => setConfirmOpen(true)}>
                <IconHourglass className="h-4 w-4 mr-1" />
                Desfazer pagamento
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={isSettling}
                className="bg-green-700 hover:bg-green-800 text-white border-transparent"
                onClick={() => setConfirmOpen(true)}
              >
                <IconCircleCheck className="h-4 w-4 mr-1" />
                Marcar como Pago
              </Button>
            ))}
        </div>
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
              <OrderPaymentStatusBadge status={order.paymentStatus} paymentMethod={order.paymentMethod} />
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
            <div className={cn(rowCls, "items-start")}>
              <span className={labelCls}>
                <IconQrcode className="h-4 w-4" />
                Chave Pix
              </span>
              {/* Right side, like every other row: the Copiar button on top and the key value
                  right under it (right-aligned) — not full-width below the label. */}
              <div className="flex flex-col items-end gap-1 min-w-0 max-w-[65%]">
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
                <span className="text-sm font-semibold text-foreground font-mono break-all text-right">{formatPixKey(order.paymentPix!)}</span>
              </div>
            </div>
          )}

          {isBoleto && installmentCount > 1 && (
            <div className={rowCls}>
              <span className="text-sm font-medium text-muted-foreground">Parcelas</span>
              <span className={valueCls}>{installmentCount}x</span>
            </div>
          )}

          {/* Vencimento + intervalo are only a fallback: when the parcela list below exists it
              already shows each due date, so we don't duplicate them here. */}
          {isBoleto && installments.length === 0 && order.paymentFirstDueDate && (
            <div className={rowCls}>
              <span className="text-sm font-medium text-muted-foreground">
                {installmentCount > 1 ? "1º Vencimento" : "Vencimento"}
              </span>
              <span className={valueCls}>{formatDate(order.paymentFirstDueDate)}</span>
            </div>
          )}

          {isBoleto && installments.length === 0 && installmentCount > 1 && order.paymentDueDays && (
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
                    <div key={inst.id} className="flex justify-between items-start bg-muted/50 rounded-lg px-4 py-3 gap-3">
                      <div className="flex flex-col min-w-0 gap-1.5">
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
                      {/* Value on top; status badge + settle action grouped beneath, right-aligned. */}
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <span className="text-sm font-semibold text-foreground tabular-nums">{formatCurrency(inst.amount)}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant={variant} className="whitespace-nowrap h-6">
                            {ORDER_INSTALLMENT_STATUS_LABELS[inst.status as keyof typeof ORDER_INSTALLMENT_STATUS_LABELS] || inst.status}
                          </Badge>
                          {/* Settle a single parcela — financial-only. The mutation invalidates the
                              order query, so the card + order rollup (PARTIALLY_PAID/PAID) refresh. */}
                          {canManagePayments &&
                            inst.status !== ORDER_INSTALLMENT_STATUS.PAID &&
                            inst.status !== ORDER_INSTALLMENT_STATUS.CANCELLED && (
                              <Button
                                size="sm"
                                disabled={isSettling}
                                className="h-6 px-2 text-xs whitespace-nowrap bg-green-700 hover:bg-green-800 text-white border-transparent"
                                onClick={() => markInstallmentPaidAsync(inst.id)}
                              >
                                <IconCircleCheck className="h-3.5 w-3.5 mr-1" />
                                Marcar pago
                              </Button>
                            )}
                        </div>
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

    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{isPaid ? "Desfazer pagamento" : "Marcar como Pago"}</AlertDialogTitle>
          <AlertDialogDescription>
            {isPaid
              ? 'O pedido voltará para "Aguardando Pagamento" e as parcelas em aberto serão reabertas.'
              : "O pedido será registrado como pago e liquidado em Contas a Pagar."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmSettle}>
            {isPaid ? "Desfazer pagamento" : "Marcar como Pago"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
