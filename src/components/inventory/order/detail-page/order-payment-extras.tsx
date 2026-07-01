import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { IconCalendar, IconReceipt2, IconCircleCheck } from "@tabler/icons-react";
import { formatDate, formatCurrency } from "../../../../utils";
import { useOrderMutations } from "../../../../hooks";
import { useAuth } from "@/contexts/auth-context";
import { hasAnyPrivilege } from "@/utils/user";
import type { Order, OrderInstallment } from "../../../../types";
import { ORDER_INSTALLMENT_STATUS_LABELS, ORDER_INSTALLMENT_STATUS, SECTOR_PRIVILEGES } from "../../../../constants";

interface OrderPaymentExtrasProps {
  order: Order;
}

const INSTALLMENT_STATUS_VARIANT: Record<string, string> = {
  [ORDER_INSTALLMENT_STATUS.PENDING]: "pending",
  [ORDER_INSTALLMENT_STATUS.PARTIALLY_PAID]: "orange",
  [ORDER_INSTALLMENT_STATUS.PAID]: "green",
  [ORDER_INSTALLMENT_STATUS.OVERDUE]: "red",
  [ORDER_INSTALLMENT_STATUS.CANCELLED]: "cancelled",
};

const rowCls = "flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3";

/**
 * The interactive / non-key-value parts of the legacy OrderPaymentCard that don't map cleanly to
 * DetailPage fields: the boleto due-date fallback rows (shown only when there's no per-parcela list)
 * and the boleto installment schedule with per-parcela settle. The scalar payment rows (status,
 * responsável, forma, pix, parcelas, pago em) live as fields on the Pagamento section, and the
 * order-level payment status is now set via the inline-editable "Status de Pagamento" field.
 * Financial-only.
 */
export function OrderPaymentExtras({ order }: OrderPaymentExtrasProps) {
  const { user } = useAuth();
  const { markInstallmentPaidAsync, isLoading: isSettling } = useOrderMutations();
  const canManagePayments = hasAnyPrivilege(user as any, [SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.ADMIN]);

  const isBoleto = order.paymentMethod === "BANK_SLIP";
  const installmentCount = order.installmentCount || 1;
  const installments: OrderInstallment[] = (order.installments || []).slice().sort((a, b) => (a.number || 0) - (b.number || 0));

  return (
    <div className="space-y-4">
      {/* Vencimento + intervalo fallback: only when the parcela list below is absent. */}
      {isBoleto && installments.length === 0 && order.paymentFirstDueDate && (
        <div className={rowCls}>
          <span className="text-sm font-medium text-muted-foreground">{installmentCount > 1 ? "1º Vencimento" : "Vencimento"}</span>
          <span className="text-sm font-semibold text-foreground">{formatDate(order.paymentFirstDueDate)}</span>
        </div>
      )}
      {isBoleto && installments.length === 0 && installmentCount > 1 && order.paymentDueDays && (
        <div className={rowCls}>
          <span className="text-sm font-medium text-muted-foreground">Intervalo entre Parcelas</span>
          <span className="text-sm font-semibold text-foreground">{order.paymentDueDays} dias</span>
        </div>
      )}

      {/* Installment schedule — orders now always carry ≥1 installment. Boleto
          orders list N parcelas; single-payment (PIX/cartão) orders show one
          "Parcela única" row. Each row surfaces its settle status + paid date
          (the bank-backed vs paid-on-paper clearance axis is derived only in the
          Conciliação / Contas a Pagar views — the order GET carries no match
          data). */}
      {installments.length > 0 && (
        <>
          <Separator className="bg-border" />
          <div className="space-y-4">
            <h3 className="text-base font-semibold mb-4 text-foreground flex items-center gap-2">
              <IconReceipt2 className="h-4 w-4 text-muted-foreground" />
              {isBoleto && installments.length > 1 ? "Parcelas do Boleto" : "Parcelas"}
            </h3>
            <div className="space-y-2">
              {installments.map((inst) => {
                const variant = (INSTALLMENT_STATUS_VARIANT[inst.status] || "outline") as any;
                const isPaid = inst.status === ORDER_INSTALLMENT_STATUS.PAID;
                return (
                  <div key={inst.id} className="flex justify-between items-start bg-muted/50 rounded-lg px-4 py-3 gap-3">
                    <div className="flex flex-col min-w-0 gap-1.5">
                      <span className="text-sm font-medium text-foreground">
                        {installments.length > 1 ? `${inst.number}ª parcela de ${installments.length}` : "Parcela única"}
                      </span>
                      {inst.dueDate && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <IconCalendar className="h-3 w-3" />
                          Vence em {formatDate(inst.dueDate)}
                        </span>
                      )}
                      {isPaid && inst.paidAt && (
                        <span className="text-xs text-green-700 flex items-center gap-1">
                          <IconCircleCheck className="h-3 w-3" />
                          Pago em {formatDate(inst.paidAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span className="text-sm font-semibold text-foreground tabular-nums">{formatCurrency(inst.amount)}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant={variant} className="whitespace-nowrap h-6">
                          {ORDER_INSTALLMENT_STATUS_LABELS[inst.status as keyof typeof ORDER_INSTALLMENT_STATUS_LABELS] || inst.status}
                        </Badge>
                        {canManagePayments && inst.status !== ORDER_INSTALLMENT_STATUS.PAID && inst.status !== ORDER_INSTALLMENT_STATUS.CANCELLED && (
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
    </div>
  );
}
