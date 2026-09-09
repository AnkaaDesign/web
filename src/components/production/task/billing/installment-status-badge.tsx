import { Badge } from '@/components/ui/badge';
import { INSTALLMENT_STATUS_LABELS } from '@/constants/enum-labels';
import type { INSTALLMENT_STATUS } from '@/constants/enums';
import { cn } from '@/lib/utils';
import { formatPaidInstallmentLabel } from '@/utils';

interface InstallmentStatusBadgeProps {
  status: INSTALLMENT_STATUS | string | null;
  className?: string;
  size?: 'default' | 'sm' | 'lg';
  /** When true, shows "Paga (por fora)" instead of just "Paga" */
  paidExternally?: boolean;
  /** Payment method used (PIX, CASH, TRANSFER, BANK_SLIP, etc.) */
  paymentMethod?: string | null;
  /**
   * Estado do BOLETO da parcela, quando existe.
   *
   * `paymentMethod` fica `BANK_SLIP` desde a geração do boleto, e a liquidação
   * manual do orçamento CANCELA o boleto e marca a parcela paga. Sem este dado o
   * selo dizia "Paga (Boleto)" ao lado de um "Boleto · Cancelado" — o dinheiro
   * não entrou por boleto nenhum, e as duas afirmações se contradiziam na mesma
   * linha.
   */
  bankSlipStatus?: string | null;
}

const statusVariantMap: Record<string, string> = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  PAID: 'green',
  OVERDUE: 'red',
  CANCELLED: 'cancelled',
};

export function InstallmentStatusBadge({ status, className, size = 'default', paidExternally, paymentMethod, bankSlipStatus }: InstallmentStatusBadgeProps) {
  if (!status) return null;

  const variant = (statusVariantMap[status] || 'default') as any;
  let label = INSTALLMENT_STATUS_LABELS[status as INSTALLMENT_STATUS] || status;

  if (status === 'PAID' && bankSlipStatus === 'CANCELLED') {
    // Boleto cancelado + parcela paga = baixa manual. Ver `bankSlipStatus`.
    label = 'Paga (baixa manual)';
  } else if (status === 'PAID' && paymentMethod) {
    // Normalize so raw "BOLETO" and enum "BANK_SLIP" render one consistent label.
    label = formatPaidInstallmentLabel(paymentMethod) ?? label;
  } else if (status === 'PAID' && paidExternally) {
    label = 'Paga (por fora)';
  }

  return (
    <Badge variant={variant} size={size} className={cn('font-medium whitespace-nowrap', className)}>
      {label}
    </Badge>
  );
}
